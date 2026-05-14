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
  type CartridgeToolDefinition,
  findToolDefinition,
} from "./tool-registry.js";
import { handleWorkspaceBrief } from "./workspace-brief.js";

type ToolHandler = (args: unknown) => Promise<McpToolResult>;

const toolHandlers: Record<string, ToolHandler> = {
  memory_list: handleMemoryList,
  memory_read: handleMemoryRead,
  memory_status: handleMemoryStatus,
  memory_commit: handleMemoryCommit,
  memory_deps: handleMemoryDeps,
  workspace_brief: handleWorkspaceBrief,
  commit_preflight: handleCommitPreflight,
};

export interface DispatchToolCallRequest {
  name: string;
  args: unknown;
}

export function hasExplicitApproval(args: unknown): boolean {
  return (
    typeof args === "object" &&
    args !== null &&
    "confirm" in args &&
    (args as { confirm?: unknown }).confirm === true
  );
}

function extractProjectRoot(args: unknown): string {
  if (typeof args !== "object" || args === null || !("projectRoot" in args)) {
    return "";
  }

  const projectRoot = (args as { projectRoot?: unknown }).projectRoot;
  return typeof projectRoot === "string" ? projectRoot : "";
}

function createUnknownToolResult(name: string, args: unknown): McpToolResult {
  return toMcpTextResult(
    createToolErrorEnvelope({
      tool: name,
      projectRoot: extractProjectRoot(args),
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
    return createUnknownToolResult(request.name, request.args);
  }

  const handler = toolHandlers[request.name];
  if (!handler) {
    return createUnknownToolResult(request.name, request.args);
  }

  if (tool.requiresExplicitApproval && !hasExplicitApproval(request.args)) {
    return createApprovalRequiredResult(tool, request.args);
  }

  return handler(request.args);
}
