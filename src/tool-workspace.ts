import {
  createToolEnvelope,
  toMcpTextResult,
  type McpToolResult,
} from "./mcp-response.js";
import { isSameProjectRoot, validateProjectRoot } from "./path-guard.js";
import type { CartridgeToolDefinition } from "./tool-registry.js";

export function extractProjectRoot(
  args: unknown,
  fallbackProjectRoot = "",
): string {
  if (typeof args !== "object" || args === null || !("projectRoot" in args)) {
    return fallbackProjectRoot;
  }

  const projectRoot = (args as { projectRoot?: unknown }).projectRoot;
  return typeof projectRoot === "string" ? projectRoot : fallbackProjectRoot;
}

function createWorkspaceValidationResult(
  tool: CartridgeToolDefinition,
  args: unknown,
  code: string,
  message: string,
): McpToolResult {
  return toMcpTextResult(
    createToolEnvelope({
      tool: tool.name,
      readOnly: tool.readOnly,
      projectRoot: extractProjectRoot(args),
      status: "error",
      summary: { error: message },
      findings: [{ severity: "error", code, message }],
      legacy: { text: message },
    }),
  );
}

function injectProjectRoot(args: unknown, projectRoot: string): unknown {
  if (args === undefined || args === null) {
    return { projectRoot };
  }

  if (typeof args === "object" && !Array.isArray(args)) {
    return { ...args, projectRoot };
  }

  return args;
}

export function prepareToolArgs(
  tool: CartridgeToolDefinition,
  args: unknown,
  defaultProjectRoot?: string,
): { ok: true; args: unknown } | { ok: false; result: McpToolResult } {
  if (!defaultProjectRoot) {
    return { ok: true, args };
  }

  let trustedProjectRoot: string;
  try {
    trustedProjectRoot = validateProjectRoot(defaultProjectRoot);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      result: createWorkspaceValidationResult(
        tool,
        args,
        "workspace_validation_error",
        `Workspace Validation Error: ${message}`,
      ),
    };
  }

  const argumentProjectRoot = extractProjectRoot(args);
  if (!argumentProjectRoot) {
    return { ok: true, args: injectProjectRoot(args, trustedProjectRoot) };
  }

  try {
    if (isSameProjectRoot(trustedProjectRoot, argumentProjectRoot)) {
      return { ok: true, args: injectProjectRoot(args, trustedProjectRoot) };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      result: createWorkspaceValidationResult(
        tool,
        args,
        "project_root_validation_error",
        `ProjectRoot Validation Error: ${message}`,
      ),
    };
  }

  return {
    ok: false,
    result: createWorkspaceValidationResult(
      tool,
      args,
      "workspace_project_root_conflict",
      "Workspace/projectRoot conflict: Gateway or CLI workspace must match arguments.projectRoot.",
    ),
  };
}
