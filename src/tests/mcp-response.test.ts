import { describe, expect, it } from "vitest";
import {
  createToolEnvelope,
  createToolErrorEnvelope,
  toMcpTextResult,
} from "../mcp-response.js";

describe("mcp-response — 統一工具回傳 envelope", () => {
  it("應將 envelope 包裝為 MCP text result", () => {
    const envelope = createToolEnvelope({
      tool: "workspace_brief",
      readOnly: true,
      projectRoot: "/mock/project",
      status: "ready",
      summary: { ok: true },
      recommendedActions: [],
    });

    const result = toMcpTextResult(envelope);
    const parsed = JSON.parse(result.content[0].text);

    expect(result.isError).toBeUndefined();
    expect(parsed.status).toBe("ready");
    expect(parsed.summary.ok).toBe(true);
    expect(parsed.metadata.tool).toBe("workspace_brief");
    expect(parsed.metadata.readOnly).toBe(true);
    expect(parsed.metadata.generatedAt).toContain("+08:00");
  });

  it("error envelope 應標記 MCP isError", () => {
    const result = toMcpTextResult(
      createToolErrorEnvelope({
        tool: "commit_preflight",
        projectRoot: "/mock/project",
        code: "validation_error",
        message: "Validation Error",
      }),
    );
    const parsed = JSON.parse(result.content[0].text);

    expect(result.isError).toBe(true);
    expect(parsed.status).toBe("error");
    expect(parsed.findings[0].code).toBe("validation_error");
  });
});
