import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import * as z from "zod";
import matter from "gray-matter";
import { validateDependencySemantics } from "./dependency-semantics.js";
import { validateProjectRoot } from "./path-guard.js";
import {
  createToolEnvelope,
  createToolErrorEnvelope,
  toMcpTextResult,
  type CartridgeFinding,
  type CartridgeToolStatus,
  type McpToolResult,
} from "./mcp-response.js";
import {
  buildCommitPreflight,
  parseGitStatusPorcelain,
  type DependencySemanticSummary,
  type PreflightIndex,
} from "./commit-preflight-summary.js";
import { filterVisibleUntrackedFiles } from "./index-manager.js";

const projectRootField = z
  .string()
  .min(1)
  .refine((p) => path.isAbsolute(p) && !p.includes(".."), {
    message: "必須為絕對路徑且不含路徑穿越符號",
  });

export const commitPreflightSchema = z.object({
  projectRoot: projectRootField,
});

const TOOL_NAME = "commit_preflight";

function blockersToFindings(
  blockers: Array<{ type: string; target: string; reason: string }>,
): CartridgeFinding[] {
  return blockers.map((blocker) => ({
    severity: "error",
    code: blocker.type,
    message: `${blocker.target}: ${blocker.reason}`,
  }));
}

function dependencySemanticsToFindings(
  summary: DependencySemanticSummary,
): CartridgeFinding[] {
  return summary.modules.map((item) => ({
    severity: "warning",
    code: "dependency_semantics_warning",
    message: `${item.module}: ${item.codes.join(", ")}`,
  }));
}

function reviewReasonsToFindings(reasons: string[]): CartridgeFinding[] {
  return reasons.map((reason) => ({
    severity: "warning",
    code: "memory_review_advisory",
    message: reason,
  }));
}

function compatibilityToFindings(
  warnings: Array<{ code: string; message: string; target: string }>,
): CartridgeFinding[] {
  return warnings.map((warning) => ({
    severity: "warning",
    code: warning.code,
    message: `${warning.target}: ${warning.message}`,
  }));
}

async function readCartridgeIndex(projectRoot: string): Promise<{
  index: PreflightIndex;
  indexAvailable: boolean;
}> {
  try {
    const raw = await fs.readFile(
      path.join(projectRoot, ".cartridge", "index.json"),
      "utf-8",
    );
    const index = JSON.parse(raw) as PreflightIndex;
    index.untrackedFiles = filterVisibleUntrackedFiles(index.untrackedFiles);
    return { index, indexAvailable: true };
  } catch {
    return {
      index: { cartridges: {}, fileMap: {}, untrackedFiles: [] },
      indexAvailable: false,
    };
  }
}

async function readGitStatus(projectRoot: string) {
  const stdout = await new Promise<string>((resolve, reject) => {
    execFile(
      "git",
      ["status", "--porcelain=v1"],
      { cwd: projectRoot, windowsHide: true },
      (error, stdoutValue, stderrValue) => {
        if (error) {
          reject(
            new Error(
              `git status failed: ${stderrValue || error.message || "unknown error"}`,
            ),
          );
          return;
        }
        resolve(stdoutValue);
      },
    );
  });
  return parseGitStatusPorcelain(stdout);
}

function getDirtyMemoryModules(
  index: PreflightIndex,
  gitStatus: Array<{ path: string }>,
): string[] {
  const modules = new Set<string>();
  for (const entry of gitStatus) {
    for (const owner of index.fileMap?.[entry.path] ?? []) {
      modules.add(owner);
    }
    for (const [moduleName, cartridge] of Object.entries(
      index.cartridges ?? {},
    )) {
      const mainPath = cartridge.mainFile?.activePath ?? cartridge.skillPath;
      if (mainPath === entry.path || cartridge.skillPath === entry.path) {
        modules.add(moduleName);
      }
    }
  }
  return [...modules];
}

async function buildDependencySemanticSummary(
  projectRoot: string,
  index: PreflightIndex,
  gitStatus: Array<{ path: string }>,
): Promise<DependencySemanticSummary> {
  const modules = getDirtyMemoryModules(index, gitStatus);
  const items: DependencySemanticSummary["modules"] = [];
  let warningCount = 0;

  for (const moduleName of modules) {
    const entry = index.cartridges?.[moduleName];
    if (!entry?.skillPath) continue;
    if (entry.mainFile?.type === "conflict" || entry.mainFile?.type === "missing") {
      continue;
    }
    const mainPath = entry.mainFile?.activePath ?? entry.skillPath;

    try {
      const raw = await fs.readFile(path.join(projectRoot, mainPath), "utf-8");
      const { content: body, data } = matter(raw);
      const dependencies = Array.isArray(data.dependencies)
        ? data.dependencies.filter(
            (dependency): dependency is string =>
              typeof dependency === "string" && dependency.trim().length > 0,
          )
        : [];
      if (dependencies.length === 0) continue;
      const warnings = validateDependencySemantics({
        moduleName,
        dependencies,
        body,
        parent: entry.parent ?? null,
      });
      if (warnings.length > 0) {
        warningCount += warnings.length;
        items.push({
          module: moduleName,
          codes: [...new Set(warnings.map((warning) => warning.code))],
        });
      }
    } catch {
      /* Dependency semantic summary is best-effort and must not block preflight. */
    }
  }

  return {
    warnings: warningCount,
    modules: items,
  };
}

export async function handleCommitPreflight(
  args: unknown,
): Promise<McpToolResult> {
  const parsed = commitPreflightSchema.safeParse(args);
  if (!parsed.success) {
    return toMcpTextResult(
      createToolErrorEnvelope({
        tool: TOOL_NAME,
        projectRoot: "",
        code: "validation_error",
        message:
          "Validation Error: projectRoot is required (must be absolute path without ..)",
      }),
    );
  }

  try {
    const projectRoot = validateProjectRoot(parsed.data.projectRoot);
    const [indexResult, gitStatus] = await Promise.all([
      readCartridgeIndex(projectRoot),
      readGitStatus(projectRoot),
    ]);
    const dependencySemantics = await buildDependencySemanticSummary(
      projectRoot,
      indexResult.index,
      gitStatus,
    );
    const preflight = buildCommitPreflight(
      indexResult.index,
      gitStatus,
      dependencySemantics,
      { indexAvailable: indexResult.indexAvailable },
    );
    return toMcpTextResult(
      createToolEnvelope({
        tool: TOOL_NAME,
        readOnly: true,
        projectRoot,
        status: preflight.status as CartridgeToolStatus,
        summary: preflight,
        findings: [
          ...compatibilityToFindings(preflight.summary.compatibility.warnings),
          ...blockersToFindings(preflight.blockers),
          ...reviewReasonsToFindings(
            preflight.summary.readiness.warningReasons.filter(
              (reason) => reason.includes("indirectStaleness=") || reason.includes("childrenNeedReview="),
            ),
          ),
          ...dependencySemanticsToFindings(dependencySemantics),
        ],
        recommendedActions: preflight.recommendedActions,
      }),
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return toMcpTextResult(
      createToolErrorEnvelope({
        tool: TOOL_NAME,
        projectRoot: parsed.data.projectRoot,
        code: "commit_preflight_failed",
        message: `Error: ${msg}`,
      }),
    );
  }
}
