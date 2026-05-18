import {
  handleMemoryCommit,
  handleMemoryDeps,
  handleMemoryList,
  handleMemoryRead,
  handleMemoryStatus,
} from "./mcp-handlers.js";
import {
  createToolEnvelope,
  createToolErrorEnvelope,
  toMcpTextResult,
  type McpToolResult,
} from "./mcp-response.js";
import { handleCommitPreflight } from "./commit-preflight.js";
import {
  handleContextAudit,
  handleContextDiff,
  handleContextInventory,
  handleContextPlan,
} from "./context-tools.js";
import { handleMemoryAudit } from "./memory-audit.js";
import {
  type CartridgeToolDefinition,
  findToolDefinition,
} from "./tool-registry.js";
import { handleWorkspaceBrief } from "./workspace-brief.js";
import { extractProjectRoot, prepareToolArgs } from "./tool-workspace.js";

type ToolHandler = (args: unknown) => Promise<McpToolResult>;

const toolHandlers: Record<string, ToolHandler> = {
  memory_list: handleMemoryList,
  memory_read: handleMemoryRead,
  memory_status: handleMemoryStatus,
  memory_commit: handleMemoryCommit,
  memory_deps: handleMemoryDeps,
  memory_audit: handleMemoryAudit,
  workspace_brief: handleWorkspaceBrief,
  commit_preflight: handleCommitPreflight,
  context_inventory: handleContextInventory,
  context_audit: handleContextAudit,
  context_diff: handleContextDiff,
  context_plan: handleContextPlan,
};

export interface DispatchToolCallRequest {
  name: string;
  args: unknown;
  defaultProjectRoot?: string;
}

export function hasExplicitApproval(args: unknown): boolean {
  return (
    typeof args === "object" &&
    args !== null &&
    "confirm" in args &&
    (args as { confirm?: unknown }).confirm === true
  );
}

function createUnknownToolResult(
  name: string,
  args: unknown,
  defaultProjectRoot?: string,
): McpToolResult {
  return toMcpTextResult(
    createToolErrorEnvelope({
      tool: name,
      projectRoot: extractProjectRoot(args, defaultProjectRoot),
      code: "unknown_tool",
      message: `Unknown tool: ${name}`,
    }),
  );
}

function createApprovalRequiredResult(
  tool: CartridgeToolDefinition,
  args: unknown,
): McpToolResult {
  return toMcpTextResult(
    createToolEnvelope({
      tool: tool.name,
      readOnly: false,
      projectRoot: extractProjectRoot(args),
      status: "error",
      summary: {
        error: `Tool ${tool.name} requires explicit confirmation.`,
      },
      findings: [
        {
          severity: "error",
          code: "explicit_approval_required",
          message:
            `${tool.name} is a high-risk write tool. ` +
            "Pass confirm: true after updating SKILL.md intentionally.",
        },
      ],
      recommendedActions: [
        {
          type: "confirm_write_tool",
          tool: tool.name,
          requiredArgument: "confirm: true",
        },
      ],
    }),
  );
}

export async function dispatchToolCall(
  request: DispatchToolCallRequest,
): Promise<McpToolResult> {
  const tool = findToolDefinition(request.name);

  if (!tool) {
    return createUnknownToolResult(
      request.name,
      request.args,
      request.defaultProjectRoot,
    );
  }

  const handler = toolHandlers[request.name];
  if (!handler) {
    return createUnknownToolResult(
      request.name,
      request.args,
      request.defaultProjectRoot,
    );
  }

  const prepared = prepareToolArgs(
    tool,
    request.args,
    request.defaultProjectRoot,
  );
  if (!prepared.ok) {
    return prepared.result;
  }

  if (tool.requiresExplicitApproval && !hasExplicitApproval(prepared.args)) {
    return createApprovalRequiredResult(tool, prepared.args);
  }

  return handler(prepared.args);
}
