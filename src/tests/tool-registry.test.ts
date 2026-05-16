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
    ]);
  });

  it("每個工具都應具備 schema 與治理後設資料", () => {
    for (const tool of CARTRIDGE_TOOLS) {
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.required).toContain("projectRoot");
      expect(["low", "medium", "high"]).toContain(tool.risk);
      expect(["read", "analyze", "governance", "write"]).toContain(
        tool.capability,
      );
    }
  });

  it("寫入型工具必須要求明確授權", () => {
    const memoryCommit = CARTRIDGE_TOOLS.find(
      (tool) => tool.name === "memory_commit",
    );

    expect(memoryCommit?.readOnly).toBe(false);
    expect(memoryCommit?.risk).toBe("high");
    expect(memoryCommit?.requiresExplicitApproval).toBe(true);
    expect(memoryCommit?.inputSchema.required).toContain("confirm");
    expect(memoryCommit?.inputSchema.properties.confirm).toEqual(
      expect.objectContaining({ type: "boolean" }),
    );
  });
});
