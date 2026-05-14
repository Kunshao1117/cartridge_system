import * as fs from "fs/promises";
import * as path from "path";
import * as z from "zod";
import { validateProjectRoot } from "./path-guard.js";
import { type McpToolResult } from "./mcp-handlers.js";
import {
  createToolEnvelope,
  createToolErrorEnvelope,
  toMcpTextResult,
  type CartridgeFinding,
  type CartridgeToolStatus,
} from "./mcp-response.js";
import {
  buildWorkspaceBrief,
  type BriefIndex,
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

function readinessToFindings(reasons: string[]): CartridgeFinding[] {
  return reasons.map((reason) => ({
    severity: "warning",
    code: "workspace_readiness_blocker",
    message: reason,
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

async function readCartridgeIndex(projectRoot: string): Promise<BriefIndex> {
  const raw = await fs.readFile(
    path.join(projectRoot, ".cartridge", "index.json"),
    "utf-8",
  );
  return JSON.parse(raw) as BriefIndex;
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
    const [project, index] = await Promise.all([
      readPackageSummary(projectRoot),
      readCartridgeIndex(projectRoot),
    ]);
    const brief = buildWorkspaceBrief(project, index);
    return toMcpTextResult(
      createToolEnvelope({
        tool: TOOL_NAME,
        readOnly: true,
        projectRoot,
        status: brief.readiness.status as CartridgeToolStatus,
        summary: brief,
        findings: readinessToFindings(brief.readiness.reasons),
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
