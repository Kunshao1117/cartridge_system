import { describe, expect, it } from "vitest";
import { CARTRIDGE_TOOLS } from "../tool-registry.js";

describe("tool-registry — MCP 工具名冊", () => {
  it("應登錄目前所有 MCP tools", () => {
    expect(CARTRIDGE_TOOLS.map((tool) => tool.name)).toEqual([
      "memory_list",
      "memory_read",
      "memory_status",
      "memory_commit",
      "memory_deps",
      "memory_audit",
      "workspace_brief",
      "commit_preflight",
      "context_inventory",
      "context_audit",
      "context_diff",
      "context_plan",
    ]);
  });

  it("每個工具都應具備 schema 與治理後設資料", () => {
    for (const tool of CARTRIDGE_TOOLS) {
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.safetySummary.length).toBeGreaterThan(0);
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.required).toContain("projectRoot");
      expect(["low", "medium", "high"]).toContain(tool.risk);
      expect(["read", "analyze", "governance", "write"]).toContain(
        tool.capability,
      );
      expect(["fast", "medium", "slow"]).toContain(tool.expectedLatency);
    }
  });

  it("寫入型工具必須要求明確授權", () => {
    const memoryCommit = CARTRIDGE_TOOLS.find(
      (tool) => tool.name === "memory_commit",
    );

    expect(memoryCommit?.readOnly).toBe(false);
    expect(memoryCommit?.risk).toBe("high");
    expect(memoryCommit?.requiresExplicitApproval).toBe(true);
    expect(memoryCommit?.safeForStartup).toBe(false);
    expect(memoryCommit?.inputSchema.required).toContain("confirm");
    expect(memoryCommit?.inputSchema.properties.confirm).toEqual(
      expect.objectContaining({ type: "boolean" }),
    );
  });

  it("AI 開工入口工具應標示為安全啟動工具", () => {
    const workspaceBrief = CARTRIDGE_TOOLS.find(
      (tool) => tool.name === "workspace_brief",
    );
    const contextAudit = CARTRIDGE_TOOLS.find(
      (tool) => tool.name === "context_audit",
    );

    expect(workspaceBrief?.safeForStartup).toBe(true);
    expect(workspaceBrief?.safetySummary).toContain("開工檢查");
    expect(contextAudit?.safeForStartup).toBe(true);
    expect(contextAudit?.description).toContain("規則檔檢查");
  });
});
