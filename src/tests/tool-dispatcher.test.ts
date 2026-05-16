import { describe, expect, it, vi } from "vitest";
import { dispatchToolCall, hasExplicitApproval } from "../tool-dispatcher.js";

vi.mock("../mcp-handlers.js", () => ({
  handleMemoryList: vi.fn(async () => ({
    content: [{ type: "text", text: "memory_list called" }],
  })),
  handleMemoryRead: vi.fn(async () => ({
    content: [{ type: "text", text: "memory_read called" }],
  })),
  handleMemoryStatus: vi.fn(async () => ({
    content: [{ type: "text", text: "memory_status called" }],
  })),
  handleMemoryCommit: vi.fn(async () => ({
    content: [{ type: "text", text: "memory_commit called" }],
  })),
  handleMemoryDeps: vi.fn(async () => ({
    content: [{ type: "text", text: "memory_deps called" }],
  })),
}));

vi.mock("../workspace-brief.js", () => ({
  handleWorkspaceBrief: vi.fn(async () => ({
    content: [{ type: "text", text: "workspace_brief called" }],
  })),
}));

vi.mock("../memory-audit.js", () => ({
  handleMemoryAudit: vi.fn(async () => ({
    content: [{ type: "text", text: "memory_audit called" }],
  })),
}));

vi.mock("../commit-preflight.js", () => ({
  handleCommitPreflight: vi.fn(async () => ({
    content: [{ type: "text", text: "commit_preflight called" }],
  })),
}));

describe("tool-dispatcher — MCP 工具分派與防線", () => {
  it("應將已登錄工具分派到對應 handler", async () => {
    const result = await dispatchToolCall({
      name: "memory_list",
      args: { projectRoot: "/mock/project" },
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe("memory_list called");
  });

  it("未知工具應回傳統一錯誤 envelope", async () => {
    const result = await dispatchToolCall({
      name: "unknown_tool",
      args: { projectRoot: "/mock/project" },
    });
    const envelope = JSON.parse(result.content[0].text);

    expect(result.isError).toBe(true);
    expect(envelope.status).toBe("error");
    expect(envelope.findings[0].code).toBe("unknown_tool");
  });

  it("memory_commit 未明確確認時應被 dispatcher 阻擋", async () => {
    const result = await dispatchToolCall({
      name: "memory_commit",
      args: {
        moduleName: "mcp-tools",
        projectRoot: "/mock/project",
      },
    });
    const envelope = JSON.parse(result.content[0].text);

    expect(result.isError).toBe(true);
    expect(envelope.status).toBe("error");
    expect(envelope.metadata.readOnly).toBe(false);
    expect(envelope.findings[0].code).toBe("explicit_approval_required");
  });

  it("memory_commit 有 confirm: true 時才應進入 handler", async () => {
    const result = await dispatchToolCall({
      name: "memory_commit",
      args: {
        moduleName: "mcp-tools",
        projectRoot: "/mock/project",
        confirm: true,
      },
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe("memory_commit called");
  });

  it("hasExplicitApproval 只接受 confirm: true", () => {
    expect(hasExplicitApproval({ confirm: true })).toBe(true);
    expect(hasExplicitApproval({ confirm: false })).toBe(false);
    expect(hasExplicitApproval({ confirm: "true" })).toBe(false);
    expect(hasExplicitApproval(null)).toBe(false);
  });
});
