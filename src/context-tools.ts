import * as path from "path";
import * as z from "zod";
import { auditContextInventory, summarizeContextReadiness } from "./context-audit.js";
import { scanContextRegistry } from "./context-registry.js";
import { validateProjectRoot } from "./path-guard.js";
import {
  createToolEnvelope,
  createToolErrorEnvelope,
  toMcpTextResult,
  type CartridgeFinding,
  type CartridgeToolStatus,
  type McpToolResult,
} from "./mcp-response.js";

const projectRootField = z
  .string()
  .min(1)
  .refine((p) => path.isAbsolute(p) && !p.includes(".."), {
    message: "必須為絕對路徑且不含路徑穿越符號",
  });

const projectRootSchema = z.object({ projectRoot: projectRootField });
const contextDiffSchema = projectRootSchema.extend({
  leftId: z.string().min(1),
  rightId: z.string().min(1),
});

function toFindings(findings: ReturnType<typeof auditContextInventory>): CartridgeFinding[] {
  return findings.map((item) => ({
    severity: item.severity,
    code: item.code,
    message: item.explanation ? `${item.message} ${item.explanation}` : item.message,
    file: item.paths?.[0],
  }));
}

function toRecommendedActions(findings: ReturnType<typeof auditContextInventory>) {
  return findings
    .filter((item) => item.severity !== "info")
    .map((item) => ({
      priority: item.severity === "error" ? "P1" : "P2",
      action: item.recommendedAction ?? "review_context_finding",
      target: item.paths?.[0] ?? "workspace",
      reason: item.message,
      nextTool: item.recommendedTool ?? "context_audit",
      blocking: item.severity === "error",
    }));
}

function validationError(tool: string): McpToolResult {
  return toMcpTextResult(
    createToolErrorEnvelope({
      tool,
      projectRoot: "",
      code: "validation_error",
      message: "Validation Error: projectRoot is required (must be absolute path without ..)",
    }),
  );
}

export async function handleContextInventory(args: unknown): Promise<McpToolResult> {
  const parsed = projectRootSchema.safeParse(args);
  if (!parsed.success) return validationError("context_inventory");
  try {
    const projectRoot = validateProjectRoot(parsed.data.projectRoot);
    const inventory = await scanContextRegistry(projectRoot);
    return toMcpTextResult(
      createToolEnvelope({
        tool: "context_inventory",
        readOnly: true,
        projectRoot,
        status: "ready",
        summary: { ...inventory },
      }),
    );
  } catch (error) {
    return toMcpTextResult(
      createToolErrorEnvelope({
        tool: "context_inventory",
        projectRoot: parsed.data.projectRoot,
        code: "context_inventory_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

export async function handleContextAudit(args: unknown): Promise<McpToolResult> {
  const parsed = projectRootSchema.safeParse(args);
  if (!parsed.success) return validationError("context_audit");
  try {
    const projectRoot = validateProjectRoot(parsed.data.projectRoot);
    const inventory = await scanContextRegistry(projectRoot);
    const findings = auditContextInventory(inventory);
    const readiness = summarizeContextReadiness(findings);
    return toMcpTextResult(
      createToolEnvelope({
        tool: "context_audit",
        readOnly: true,
        projectRoot,
        status: readiness.status as CartridgeToolStatus,
        summary: { inventory: inventory.totals, readiness, findings },
        findings: toFindings(findings),
        recommendedActions: toRecommendedActions(findings),
      }),
    );
  } catch (error) {
    return toMcpTextResult(
      createToolErrorEnvelope({
        tool: "context_audit",
        projectRoot: parsed.data.projectRoot,
        code: "context_audit_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

export async function handleContextDiff(args: unknown): Promise<McpToolResult> {
  const parsed = contextDiffSchema.safeParse(args);
  if (!parsed.success) return validationError("context_diff");
  const projectRoot = validateProjectRoot(parsed.data.projectRoot);
  const inventory = await scanContextRegistry(projectRoot);
  const left = inventory.assets.find((asset) => asset.id === parsed.data.leftId);
  const right = inventory.assets.find((asset) => asset.id === parsed.data.rightId);
  if (!left || !right) {
    return toMcpTextResult(
      createToolErrorEnvelope({
        tool: "context_diff",
        projectRoot,
        code: "context_asset_not_found",
        message: "Context asset id not found.",
      }),
    );
  }
  const sharedSignals = left.signals.filter((signal) => right.signals.includes(signal));
  return toMcpTextResult(
    createToolEnvelope({
      tool: "context_diff",
      readOnly: true,
      projectRoot,
      status: "ready",
      summary: {
        left,
        right,
        sharedSignals,
        leftOnlySignals: left.signals.filter((signal) => !right.signals.includes(signal)),
        rightOnlySignals: right.signals.filter((signal) => !left.signals.includes(signal)),
      },
    }),
  );
}

export async function handleContextPlan(args: unknown): Promise<McpToolResult> {
  const parsed = projectRootSchema.safeParse(args);
  if (!parsed.success) return validationError("context_plan");
  const projectRoot = validateProjectRoot(parsed.data.projectRoot);
  const inventory = await scanContextRegistry(projectRoot);
  const findings = auditContextInventory(inventory);
  const readiness = summarizeContextReadiness(findings);
  return toMcpTextResult(
    createToolEnvelope({
      tool: "context_plan",
      readOnly: true,
      projectRoot,
      status: readiness.status as CartridgeToolStatus,
      summary: {
        phase: "v5-readonly-context-governance",
        readiness,
        actions: [
          "先查看 context_audit 的規則檔提醒。",
          "本版保持只讀，不自動改 AGENTS.md、CLAUDE.md 或記憶卡。",
          "提交前仍要執行 commit_preflight。",
        ],
      },
      findings: toFindings(findings),
      recommendedActions: toRecommendedActions(findings),
    }),
  );
}
