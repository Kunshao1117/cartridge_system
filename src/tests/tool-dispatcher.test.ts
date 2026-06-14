import { describe, expect, it, vi } from "vitest";
import { dispatchToolCall, hasExplicitApproval } from "../tool-dispatcher.js";
import {
  handleMemoryCommit,
  handleMemoryList,
  handleMemoryReindex,
} from "../mcp-handlers.js";

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
  handleMemoryReindex: vi.fn(async () => ({
    content: [{ type: "text", text: "memory_reindex called" }],
  })),
  handleMemoryDeps: vi.fn(async () => ({
    content: [{ type: "text", text: "memory_deps called" }],
  })),
}));

vi.mock("../memory-graph.js", () => ({
  handleMemoryGraph: vi.fn(async () => ({
    content: [{ type: "text", text: "memory_graph called" }],
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

vi.mock("../context-tools.js", () => ({
  handleContextInventory: vi.fn(async () => ({
    content: [{ type: "text", text: "context_inventory called" }],
  })),
  handleContextAudit: vi.fn(async () => ({
    content: [{ type: "text", text: "context_audit called" }],
  })),
  handleContextDiff: vi.fn(async () => ({
    content: [{ type: "text", text: "context_diff called" }],
  })),
  handleContextPlan: vi.fn(async () => ({
    content: [{ type: "text", text: "context_plan called" }],
  })),
}));

vi.mock("../project-context-tools.js", () => ({
  handleProjectContextList: vi.fn(async () => ({
    content: [{ type: "text", text: "project_context_list called" }],
  })),
  handleProjectContextRead: vi.fn(async () => ({
    content: [{ type: "text", text: "project_context_read called" }],
  })),
  handleProjectContextValidate: vi.fn(async () => ({
    content: [{ type: "text", text: "project_context_validate called" }],
  })),
  handleProjectContextStatus: vi.fn(async () => ({
    content: [{ type: "text", text: "project_context_status called" }],
  })),
}));

describe("tool-dispatcher — MCP 工具分派與防線", () => {
  it("有預設 workspace 時應補入 projectRoot 後再進入 handler", async () => {
    const result = await dispatchToolCall({
      name: "memory_list",
      args: {},
      defaultProjectRoot: "D:\\mock\\project",
    });

    expect(result.isError).toBeUndefined();
    expect(vi.mocked(handleMemoryList)).toHaveBeenCalledWith({
      projectRoot: "D:\\mock\\project",
    });
  });

  it("workspace 與 arguments.projectRoot 不同時應拒絕呼叫", async () => {
    const result = await dispatchToolCall({
      name: "memory_list",
      args: { projectRoot: "D:\\other\\project" },
      defaultProjectRoot: "D:\\mock\\project",
    });
    const envelope = JSON.parse(result.content[0].text);

    expect(result.isError).toBe(true);
    expect(envelope.status).toBe("error");
    expect(envelope.findings[0].code).toBe(
      "workspace_project_root_conflict",
    );
  });

  it("預設 workspace 不合法時應在 dispatcher 層拒絕", async () => {
    const result = await dispatchToolCall({
      name: "memory_list",
      args: {},
      defaultProjectRoot: "relative-project",
    });
    const envelope = JSON.parse(result.content[0].text);

    expect(result.isError).toBe(true);
    expect(envelope.status).toBe("error");
    expect(envelope.findings[0].code).toBe("workspace_validation_error");
  });

  it("應將已登錄工具分派到對應 handler", async () => {
    const result = await dispatchToolCall({
      name: "memory_list",
      args: { projectRoot: "/mock/project" },
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe("memory_list called");
  });

  it("應將 memory_graph 分派到 AI 圖譜 handler", async () => {
    const result = await dispatchToolCall({
      name: "memory_graph",
      args: { projectRoot: "/mock/project" },
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe("memory_graph called");
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

  it("memory_reindex 未確認時應被 dispatcher 阻擋", async () => {
    const result = await dispatchToolCall({
      name: "memory_reindex",
      args: {
        projectRoot: "/mock/project",
      },
    });
    const envelope = JSON.parse(result.content[0].text);

    expect(result.isError).toBe(true);
    expect(envelope.findings[0].code).toBe("explicit_approval_required");
  });

  it("memory_reindex 有 confirm: true 時才應進入 handler", async () => {
    const result = await dispatchToolCall({
      name: "memory_reindex",
      args: {
        projectRoot: "/mock/project",
        confirm: true,
      },
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe("memory_reindex called");
    expect(vi.mocked(handleMemoryReindex)).toHaveBeenCalledWith({
      projectRoot: "/mock/project",
      confirm: true,
    });
  });

  it("memory_commit 可使用預設 workspace 補齊 projectRoot", async () => {
    const result = await dispatchToolCall({
      name: "memory_commit",
      args: {
        moduleName: "mcp-tools",
        confirm: true,
      },
      defaultProjectRoot: "D:\\mock\\project",
    });

    expect(result.isError).toBeUndefined();
    expect(vi.mocked(handleMemoryCommit)).toHaveBeenCalledWith({
      moduleName: "mcp-tools",
      confirm: true,
      projectRoot: "D:\\mock\\project",
    });
  });

  it("memory_commit 未確認時仍應在 dispatcher 層阻擋", async () => {
    const result = await dispatchToolCall({
      name: "memory_commit",
      args: {
        moduleName: "mcp-tools",
      },
      defaultProjectRoot: "D:\\mock\\project",
    });
    const envelope = JSON.parse(result.content[0].text);

    expect(result.isError).toBe(true);
    expect(envelope.findings[0].code).toBe("explicit_approval_required");
    expect(envelope.metadata.projectRoot).toBe("D:\\mock\\project");
  });

  it("hasExplicitApproval 只接受 confirm: true", () => {
    expect(hasExplicitApproval({ confirm: true })).toBe(true);
    expect(hasExplicitApproval({ confirm: false })).toBe(false);
    expect(hasExplicitApproval({ confirm: "true" })).toBe(false);
    expect(hasExplicitApproval(null)).toBe(false);
  });

  it("應分派 v5 context governance 工具", async () => {
    const result = await dispatchToolCall({
      name: "context_audit",
      args: { projectRoot: "/mock/project" },
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe("context_audit called");
  });

  it("應分派 project context 只讀工具", async () => {
    const result = await dispatchToolCall({
      name: "project_context_status",
      args: { projectRoot: "/mock/project" },
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe("project_context_status called");
  });
});
