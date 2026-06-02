import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CARTRIDGE_TOOLS } from "../tool-registry.js";

describe("tool-registry — MCP 工具名冊", () => {
  it("應登錄目前所有 MCP tools", () => {
    expect(CARTRIDGE_TOOLS.map((tool) => tool.name)).toEqual([
      "memory_list",
      "memory_read",
      "memory_status",
      "memory_commit",
      "memory_deps",
      "memory_graph",
      "memory_audit",
      "workspace_brief",
      "commit_preflight",
      "context_inventory",
      "context_audit",
      "context_diff",
      "context_plan",
      "project_context_list",
      "project_context_read",
      "project_context_validate",
      "project_context_status",
    ]);
  });

  it("每個工具都應具備 schema 與治理後設資料", () => {
    for (const tool of CARTRIDGE_TOOLS) {
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.safetySummary.length).toBeGreaterThan(0);
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.properties.projectRoot).toEqual(
        expect.objectContaining({ type: "string" }),
      );
      expect(tool.inputSchema.required).not.toContain("projectRoot");
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
    expect(memoryCommit?.inputSchema.required).toContain("moduleName");
    expect(memoryCommit?.inputSchema.required).not.toContain("projectRoot");
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

  it("npm 發布 manifest 應公開 MCP bin 並限制打包範圍", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8"),
    );

    expect(packageJson.version).toBe("5.4.1");
    expect(packageJson.bin).toEqual({
      "cartridge-system": "dist/mcp-server.js",
      "cartridge-mcp": "dist/mcp-server.js",
    });
    expect(packageJson.repository.url).toBe(
      "git+https://github.com/Kunshao1117/cartridge_system.git",
    );
    expect(packageJson.files).toEqual(
      expect.arrayContaining([
        "dist/*.js",
        "README.md",
        "CHANGELOG.md",
        "LICENSE",
      ]),
    );
    expect(packageJson.files).not.toEqual(
      expect.arrayContaining(["src/**", ".agents/**", ".github/**"]),
    );
  });

  it("memory_graph 應是安全啟動的只讀分析工具", () => {
    const memoryGraph = CARTRIDGE_TOOLS.find((tool) => tool.name === "memory_graph");

    expect(memoryGraph?.readOnly).toBe(true);
    expect(memoryGraph?.risk).toBe("low");
    expect(memoryGraph?.capability).toBe("analyze");
    expect(memoryGraph?.safeForStartup).toBe(true);
    expect(memoryGraph?.inputSchema.required).not.toContain("projectRoot");
    expect(memoryGraph?.inputSchema.properties.lens).toEqual(
      expect.objectContaining({ enum: ["maintenance", "memory", "structure", "all"] }),
    );
  });

  it("project context tools 應維持只讀且與記憶提交分離", () => {
    const tools = CARTRIDGE_TOOLS.filter((tool) =>
      tool.name.startsWith("project_context_"),
    );

    expect(tools.map((tool) => tool.name)).toEqual([
      "project_context_list",
      "project_context_read",
      "project_context_validate",
      "project_context_status",
    ]);
    for (const tool of tools) {
      expect(tool.readOnly).toBe(true);
      expect(tool.requiresExplicitApproval).toBe(false);
      expect(tool.inputSchema.required).not.toContain("projectRoot");
    }
    expect(
      CARTRIDGE_TOOLS.find((tool) => tool.name === "project_context_read")
        ?.inputSchema.required,
    ).toContain("target");
  });
});
