import { describe, expect, it, vi, beforeEach } from "vitest";
import { handleWorkspaceBrief } from "../workspace-brief.js";

vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
}));

import * as fs from "fs/promises";

const PROJECT_ROOT = "/mock/other-project";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// handleWorkspaceBrief — 高階治理摘要
// ---------------------------------------------------------------------------
describe("handleWorkspaceBrief", () => {
  it("應回傳專案身份與記憶卡健康摘要", async () => {
    const packageData = {
      name: "cartridge-system",
      version: "4.1.1",
      description: "記憶卡匣監控系統",
    };
    const indexData = {
      cartridges: {
        _system: {
          staleness: 10,
          pendingChanges: [{ filePath: "package.json" }],
          trackedFiles: ["package.json"],
        },
        _assets: {
          staleness: 20,
          pendingChanges: [{ filePath: "assets/logo.png" }],
          trackedFiles: ["assets/logo.png"],
        },
        "mcp-tools": {
          staleness: 0,
          pendingChanges: [],
          trackedFiles: [
            "src/mcp-server.ts",
            "src/mcp-handlers.ts",
            "src/path-guard.ts",
            "src/timestamp.ts",
            "src/tests/mcp-handlers.test.ts",
            "src/tests/path-guard.test.ts",
            "src/tests/timestamp.test.ts",
            "src/types.ts",
            "src/config.ts",
          ],
          ghostFiles: ["src/old.ts"],
          indirectStaleness: 5,
          dependencies: ["_system"],
          parent: null,
        },
      },
      untrackedFiles: [{ filePath: "src/new.ts" }],
    };

    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      const fp = filePath as string;
      if (fp.endsWith("package.json")) {
        return JSON.stringify(packageData) as unknown as Awaited<
          ReturnType<typeof fs.readFile>
        >;
      }
      if (fp.includes("index.json") && fp.includes(".cartridge")) {
        return JSON.stringify(indexData) as unknown as Awaited<
          ReturnType<typeof fs.readFile>
        >;
      }
      throw new Error("unexpected path");
    });

    const result = await handleWorkspaceBrief({ projectRoot: PROJECT_ROOT });
    const envelope = JSON.parse(result.content[0].text);
    const brief = envelope.summary;

    expect(result.isError).toBeUndefined();
    expect(envelope.status).toBe("blocked");
    expect(envelope.metadata.tool).toBe("workspace_brief");
    expect(envelope.metadata.readOnly).toBe(true);
    expect(brief.project.name).toBe("cartridge-system");
    expect(brief.project.version).toBe("4.1.1");
    expect(brief.memory.total).toBe(3);
    expect(brief.memory.stale).toBe(2);
    expect(brief.memory.ghostFiles).toBe(1);
    expect(brief.memory.untrackedFiles).toBe(1);
    expect(brief.memory.indirectStale).toBe(1);
    expect(brief.memory.oversized[0].module).toBe("mcp-tools");
    expect(brief.memory.dependencies.totalEdges).toBe(1);
    expect(brief.readiness.status).toBe("blocked");
    expect(brief.readiness.reasons).toContain("_system staleness=10");
    expect(brief.submitReadiness.status).toBe("blocked");
    expect(brief.submitReadiness.reason).toBe("memory readiness is blocked");
    expect(brief.submitReadiness.nextAction).toBeNull();
    expect(brief.submitReadiness.nextTool).toBeNull();
    expect(brief.recommendedActions[0].priority).toBe("P1");
  });

  it("健康專案應回傳 ready", async () => {
    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      const fp = filePath as string;
      if (fp.endsWith("package.json")) {
        return JSON.stringify({ name: "ok" }) as unknown as Awaited<
          ReturnType<typeof fs.readFile>
        >;
      }
      if (fp.includes("index.json") && fp.includes(".cartridge")) {
        return JSON.stringify({
          cartridges: {
            "mcp-tools": {
              staleness: 0,
              pendingChanges: [],
              trackedFiles: ["src/mcp-server.ts"],
              dependencies: [],
            },
          },
          untrackedFiles: [],
        }) as unknown as Awaited<ReturnType<typeof fs.readFile>>;
      }
      throw new Error("unexpected path");
    });

    const result = await handleWorkspaceBrief({ projectRoot: PROJECT_ROOT });
    const envelope = JSON.parse(result.content[0].text);
    const brief = envelope.summary;

    expect(envelope.status).toBe("ready");
    expect(brief.readiness.status).toBe("ready");
    expect(brief.readiness.reasons).toEqual([]);
    expect(brief.submitReadiness.status).toBe("needs_review");
    expect(brief.submitReadiness.reason).toBe("git state not inspected");
    expect(brief.submitReadiness.nextAction).toBe("run_commit_preflight");
    expect(brief.submitReadiness.nextTool).toBe("commit_preflight");
    expect(brief.recommendedActions).toEqual([]);
  });

  it("workspace_brief 應揭露 dependencies 總邊數且不產生語義誤報", async () => {
    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      const fp = filePath as string;
      if (fp.endsWith("package.json")) {
        return JSON.stringify({ name: "ok" }) as unknown as Awaited<
          ReturnType<typeof fs.readFile>
        >;
      }
      if (fp.includes("index.json") && fp.includes(".cartridge")) {
        return JSON.stringify({
          cartridges: {
            "mcp-tools.dispatcher": {
              staleness: 0,
              pendingChanges: [],
              trackedFiles: ["src/tool-dispatcher.ts"],
              dependencies: ["mcp-tools"],
              parent: "mcp-tools",
            },
          },
          untrackedFiles: [],
        }) as unknown as Awaited<ReturnType<typeof fs.readFile>>;
      }
      throw new Error("unexpected path");
    });

    const result = await handleWorkspaceBrief({ projectRoot: PROJECT_ROOT });
    const envelope = JSON.parse(result.content[0].text);
    const brief = envelope.summary;

    expect(envelope.status).toBe("ready");
    expect(brief.memory.dependencies.totalEdges).toBe(1);
    expect(brief.recommendedActions).toEqual([]);
  });

  it("索引不存在時應回傳錯誤", async () => {
    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      const fp = filePath as string;
      if (fp.endsWith("package.json")) {
        return JSON.stringify({ name: "cartridge-system" }) as unknown as Awaited<
          ReturnType<typeof fs.readFile>
        >;
      }
      throw new Error("ENOENT");
    });

    const result = await handleWorkspaceBrief({ projectRoot: PROJECT_ROOT });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error");
  });

  it("未傳入 projectRoot 時應回傳 Validation Error", async () => {
    const result = await handleWorkspaceBrief({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation Error");
  });

  it("路徑穿越（..）應回傳 Validation Error", async () => {
    const result = await handleWorkspaceBrief({
      projectRoot: "/foo/../../etc",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation Error");
  });
});
