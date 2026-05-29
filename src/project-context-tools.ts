import { validateProjectRoot } from "./path-guard.js";
import {
  readProjectContextCard,
  scanProjectContextCards,
} from "./project-context-registry.js";
import {
  summarizeProjectContexts,
  validateProjectContextWorkspace,
} from "./project-context-validation.js";
import {
  createToolEnvelope,
  createToolErrorEnvelope,
  toMcpTextResult,
  type CartridgeToolStatus,
  type McpToolResult,
} from "./mcp-response.js";
import {
  projectContextFindingsToMcp,
  projectContextProjectRootSchema,
  projectContextRecommendedActions,
  projectContextTargetSchema,
  projectContextValidateSchema,
  projectContextValidationError,
} from "./project-context-tool-shared.js";

export async function handleProjectContextList(args: unknown): Promise<McpToolResult> {
  const parsed = projectContextProjectRootSchema.safeParse(args);
  if (!parsed.success) return projectContextValidationError("project_context_list");
  try {
    const projectRoot = validateProjectRoot(parsed.data.projectRoot);
    const cards = await scanProjectContextCards(projectRoot);
    return toMcpTextResult(
      createToolEnvelope({
        tool: "project_context_list",
        readOnly: true,
        projectRoot,
        status: "ready",
        summary: {
          cards: cards.map((card) => ({
            id: card.id,
            name: card.name,
            path: card.path,
            contextType: card.contextType,
            status: card.status,
            scope: card.scope,
            confidence: card.confidence,
            lastReviewed: card.lastReviewed,
          })),
        },
      }),
    );
  } catch (error) {
    return toMcpTextResult(
      createToolErrorEnvelope({
        tool: "project_context_list",
        projectRoot: parsed.data.projectRoot,
        code: "project_context_list_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

export async function handleProjectContextRead(args: unknown): Promise<McpToolResult> {
  const parsed = projectContextTargetSchema.safeParse(args);
  if (!parsed.success) return projectContextValidationError("project_context_read");
  try {
    const projectRoot = validateProjectRoot(parsed.data.projectRoot);
    const card = await readProjectContextCard(projectRoot, parsed.data.target);
    if (!card) {
      return toMcpTextResult(
        createToolErrorEnvelope({
          tool: "project_context_read",
          projectRoot,
          code: "project_context_not_found",
          message: `Project context not found: ${parsed.data.target}`,
        }),
      );
    }
    return toMcpTextResult(
      createToolEnvelope({
        tool: "project_context_read",
        readOnly: true,
        projectRoot,
        status: "ready",
        summary: { card },
      }),
    );
  } catch (error) {
    return toMcpTextResult(
      createToolErrorEnvelope({
        tool: "project_context_read",
        projectRoot: parsed.data.projectRoot,
        code: "project_context_read_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

export async function handleProjectContextValidate(args: unknown): Promise<McpToolResult> {
  const parsed = projectContextValidateSchema.safeParse(args);
  if (!parsed.success) return projectContextValidationError("project_context_validate");
  try {
    const projectRoot = validateProjectRoot(parsed.data.projectRoot);
    const selected = parsed.data.target
      ? await readProjectContextCard(projectRoot, parsed.data.target)
      : null;
    if (parsed.data.target && !selected) {
      return toMcpTextResult(
        createToolErrorEnvelope({
          tool: "project_context_validate",
          projectRoot,
          code: "project_context_not_found",
          message: `Project context not found: ${parsed.data.target}`,
        }),
      );
    }
    const cards = parsed.data.target
      ? selected
        ? [selected]
        : []
      : await scanProjectContextCards(projectRoot);
    const findings = await validateProjectContextWorkspace({ projectRoot, cards });
    return toMcpTextResult(
      createToolEnvelope({
        tool: "project_context_validate",
        readOnly: true,
        projectRoot,
        status: findings.length > 0 ? "warning" : ("ready" as CartridgeToolStatus),
        summary: { checked: cards.length, findings },
        findings: projectContextFindingsToMcp(findings),
      }),
    );
  } catch (error) {
    return toMcpTextResult(
      createToolErrorEnvelope({
        tool: "project_context_validate",
        projectRoot: parsed.data.projectRoot,
        code: "project_context_validate_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

export async function handleProjectContextStatus(args: unknown): Promise<McpToolResult> {
  const parsed = projectContextProjectRootSchema.safeParse(args);
  if (!parsed.success) return projectContextValidationError("project_context_status");
  try {
    const projectRoot = validateProjectRoot(parsed.data.projectRoot);
    const cards = await scanProjectContextCards(projectRoot);
    const summary = await summarizeProjectContexts({ projectRoot, cards });
    return toMcpTextResult(
      createToolEnvelope({
        tool: "project_context_status",
        readOnly: true,
        projectRoot,
        status: summary.readiness.status,
        summary: summary as unknown as Record<string, unknown>,
        findings: projectContextFindingsToMcp(summary.findings),
        recommendedActions: projectContextRecommendedActions(summary),
      }),
    );
  } catch (error) {
    return toMcpTextResult(
      createToolErrorEnvelope({
        tool: "project_context_status",
        projectRoot: parsed.data.projectRoot,
        code: "project_context_status_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
