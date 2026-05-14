import { getTaiwanISO } from "./timestamp.js";

export type CartridgeToolStatus = "ready" | "warning" | "blocked" | "error";

export interface McpToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export interface CartridgeFinding {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  file?: string;
}

export interface CartridgeToolMetadata {
  tool: string;
  readOnly: boolean;
  generatedAt: string;
  projectRoot: string;
}

export interface CartridgeToolEnvelope {
  status: CartridgeToolStatus;
  summary: Record<string, unknown>;
  findings: CartridgeFinding[];
  recommendedActions: unknown[];
  metadata: CartridgeToolMetadata;
  legacy?: Record<string, unknown>;
}

export function createToolEnvelope(args: {
  tool: string;
  readOnly: boolean;
  projectRoot: string;
  status: CartridgeToolStatus;
  summary: Record<string, unknown>;
  findings?: CartridgeFinding[];
  recommendedActions?: unknown[];
  legacy?: Record<string, unknown>;
}): CartridgeToolEnvelope {
  const envelope: CartridgeToolEnvelope = {
    status: args.status,
    summary: args.summary,
    findings: args.findings ?? [],
    recommendedActions: args.recommendedActions ?? [],
    metadata: {
      tool: args.tool,
      readOnly: args.readOnly,
      generatedAt: getTaiwanISO(),
      projectRoot: args.projectRoot,
    },
  };
  if (args.legacy) {
    envelope.legacy = args.legacy;
  }
  return envelope;
}

export function createToolErrorEnvelope(args: {
  tool: string;
  projectRoot: string;
  code: string;
  message: string;
  recommendedActions?: unknown[];
}): CartridgeToolEnvelope {
  return createToolEnvelope({
    tool: args.tool,
    readOnly: true,
    projectRoot: args.projectRoot,
    status: "error",
    summary: { error: args.message },
    findings: [
      {
        severity: "error",
        code: args.code,
        message: args.message,
      },
    ],
    recommendedActions: args.recommendedActions ?? [],
  });
}

export function toMcpTextResult(envelope: CartridgeToolEnvelope): McpToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }],
    isError: envelope.status === "error" ? true : undefined,
  };
}
