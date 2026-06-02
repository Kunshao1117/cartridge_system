import * as fs from "fs/promises";
import * as path from "path";
import * as z from "zod";
import { validateProjectRoot } from "./path-guard.js";
import {
  auditContextInventory,
  summarizeContextReadiness,
} from "./context-audit.js";
import { scanContextRegistry } from "./context-registry.js";
import { scanProjectContextCards } from "./project-context-registry.js";
import { summarizeProjectContexts } from "./project-context-validation.js";
import {
  createToolEnvelope,
  createToolErrorEnvelope,
  toMcpTextResult,
  type CartridgeFinding,
  type CartridgeToolStatus,
  type McpToolResult,
} from "./mcp-response.js";
import {
  buildWorkspaceBrief,
  type BriefIndex,
  type ProjectContextBrief,
} from "./workspace-brief-summary.js";

const projectRootField = z
  .string()
  .min(1)
  .refine((p) => path.isAbsolute(p) && !p.includes(".."), {
    message: "必須為絕對路徑且不含路徑穿越符號",
  });

export const workspaceBriefSchema = z.object({
  projectRoot: projectRootField,
});

const TOOL_NAME = "workspace_brief";

function readinessToFindings(
  reasons: string[],
  reviewReasons: string[],
): CartridgeFinding[] {
  return [
    ...reasons.map((reason) => ({
      severity: "error" as const,
      code: "workspace_readiness_blocker",
      message: reason,
    })),
    ...reviewReasons.map((reason) => ({
      severity: "warning" as const,
      code: "workspace_readiness_review",
      message: reason,
    })),
  ];
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

function contextToFindings(
  warnings: Array<{
    code: string;
    message: string;
    severity: "info" | "warning" | "error";
    explanation?: string;
    paths?: string[];
  }>,
): CartridgeFinding[] {
  return warnings.map((warning) => ({
    severity: warning.severity,
    code: warning.code,
    message: warning.explanation
      ? `${warning.message} ${warning.explanation}`
      : warning.message,
    file: warning.paths?.[0],
  }));
}

async function readPackageSummary(projectRoot: string) {
  try {
    const raw = await fs.readFile(
      path.join(projectRoot, "package.json"),
      "utf-8",
    );
    const pkg = JSON.parse(raw) as {
      name?: string;
      version?: string;
      description?: string;
    };
    return {
      name: pkg.name ?? "",
      version: pkg.version ?? "",
      description: pkg.description ?? "",
    };
  } catch {
    return { name: "", version: "", description: "" };
  }
}

async function readCartridgeIndex(projectRoot: string): Promise<{
  index: BriefIndex;
  indexAvailable: boolean;
}> {
  try {
    const raw = await fs.readFile(
      path.join(projectRoot, ".cartridge", "index.json"),
      "utf-8",
    );
    return { index: JSON.parse(raw) as BriefIndex, indexAvailable: true };
  } catch {
    return {
      index: { cartridges: {}, untrackedFiles: [] },
      indexAvailable: false,
    };
  }
}

async function readProjectContextBrief(projectRoot: string): Promise<ProjectContextBrief> {
  const cards = await scanProjectContextCards(projectRoot);
  const summary = await summarizeProjectContexts({ projectRoot, cards });
  return {
    totals: summary.totals,
    readiness: summary.readiness,
    usage: summary.usage,
    findings: summary.findings,
  };
}

export async function handleWorkspaceBrief(
  args: unknown,
): Promise<McpToolResult> {
  const parsed = workspaceBriefSchema.safeParse(args);
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
    const [project, indexResult, contextInventory, projectContext] = await Promise.all([
      readPackageSummary(projectRoot),
      readCartridgeIndex(projectRoot),
      scanContextRegistry(projectRoot),
      readProjectContextBrief(projectRoot),
    ]);
    const contextFindings = auditContextInventory(contextInventory);
    const contextReadiness = summarizeContextReadiness(contextFindings);
    const brief = buildWorkspaceBrief(project, indexResult.index, {
      indexAvailable: indexResult.indexAvailable,
      context: {
        inventory: contextInventory.totals,
        readiness: contextReadiness,
        findings: contextFindings,
      },
      projectContext,
    });
    const status =
      brief.readiness.status === "blocked" ||
      contextReadiness.status === "blocked"
        ? "blocked"
        : brief.readiness.status === "warning" ||
            brief.compatibility.mode === "compatibility" ||
            contextReadiness.status === "warning"
          ? "warning"
          : "ready";
    return toMcpTextResult(
      createToolEnvelope({
        tool: TOOL_NAME,
        readOnly: true,
        projectRoot,
        status: status as CartridgeToolStatus,
        summary: brief,
        findings: [
          ...compatibilityToFindings(brief.compatibility.warnings),
          ...contextToFindings(contextFindings),
          ...readinessToFindings(
            brief.readiness.reasons,
            brief.readiness.reviewReasons,
          ),
        ],
        recommendedActions: brief.recommendedActions,
      }),
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return toMcpTextResult(
      createToolErrorEnvelope({
        tool: TOOL_NAME,
        projectRoot: parsed.data.projectRoot,
        code: "workspace_brief_failed",
        message: `Error: ${msg}`,
      }),
    );
  }
}
