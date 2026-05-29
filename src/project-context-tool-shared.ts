import * as path from "path";
import * as z from "zod";
import {
  createToolErrorEnvelope,
  toMcpTextResult,
  type CartridgeFinding,
  type McpToolResult,
} from "./mcp-response.js";
import type {
  ProjectContextFinding,
  ProjectContextSummary,
} from "./project-context-types.js";

const projectRootField = z
  .string()
  .min(1)
  .refine((p) => path.isAbsolute(p) && !p.includes(".."), {
    message: "必須為絕對路徑且不含路徑穿越符號",
  });

const targetField = z.string().min(1);

export const projectContextProjectRootSchema = z.object({
  projectRoot: projectRootField,
});

export const projectContextTargetSchema = projectContextProjectRootSchema.extend({
  target: targetField,
});

export const projectContextValidateSchema = projectContextProjectRootSchema.extend({
  target: targetField.optional(),
});

export function projectContextValidationError(
  tool: string,
  message = "Validation Error",
): McpToolResult {
  return toMcpTextResult(
    createToolErrorEnvelope({
      tool,
      projectRoot: "",
      code: "validation_error",
      message,
    }),
  );
}

export function projectContextFindingsToMcp(
  findings: ProjectContextFinding[],
): CartridgeFinding[] {
  return findings.map((item) => ({
    severity: item.severity,
    code: item.code,
    message: item.message,
    file: item.file,
  }));
}

export function projectContextRecommendedActions(summary: ProjectContextSummary) {
  return [
    ...summary.usage.requiresDecision.map((contextId) => ({
      priority: "P2",
      action: "ask_director_for_context_decision",
      target: contextId,
      reason: "project context is marked conflict",
      nextTool: "project_context_read",
      blocking: false,
    })),
    ...summary.usage.review.map((contextId) => ({
      priority: "P2",
      action: "review_project_context_before_use",
      target: contextId,
      reason: "project context is marked review",
      nextTool: "project_context_read",
      blocking: false,
    })),
  ];
}
