import { describe, expect, it, vi, beforeEach } from "vitest";
import { handleWorkspaceBrief } from "../workspace-brief.js";
import { buildWorkspaceBrief } from "../workspace-brief-summary.js";

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
          ghostFiles: [],
          indirectStaleness: 0,
          dependencies: [],
        },
        _assets: {
          staleness: 20,
          pendingChanges: [{ filePath: "assets/logo.png" }],
          trackedFiles: ["assets/logo.png"],
          ghostFiles: [],
          indirectStaleness: 0,
          dependencies: [],
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
      fileMap: {},
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
    expect(brief.memory.oversized).toEqual([]);
    expect(brief.memory.splitSuggestions[0].module).toBe("mcp-tools");
    expect(brief.memory.splitSuggestions[0].blocking).toBe(false);
    expect(brief.memory.dependencies.totalEdges).toBe(1);
    expect(brief.readiness.status).toBe("blocked");
    expect(brief.startupReadiness.label).toBe("需要先處理記憶卡提醒");
    expect(brief.startupReadiness.nextTool).toBe("memory_audit");
    expect(brief.readiness.reasons).toContain("_system: staleness=10");
    expect(brief.submitReadiness.status).toBe("blocked");
    expect(brief.submitReadiness.reason).toBe("memory readiness is blocked");
    expect(brief.submitReadiness.label).toBe("記憶卡還有待處理項目，先不要提交");
    expect(brief.submitReadiness.nextAction).toBeNull();
    expect(brief.submitReadiness.nextTool).toBeNull();
    expect(brief.recommendedActions[0].priority).toBe("P1");
    expect(brief.recommendedActions[0].label).toBeDefined();
    expect(brief.recommendedActions[0].blocking).toBe(true);
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
              skillPath: ".agents/memory/mcp-tools/MEMORY.md",
              mainFile: {
                type: "MEMORY.md",
                activePath: ".agents/memory/mcp-tools/MEMORY.md",
                activeFileName: "MEMORY.md",
                candidates: { memory: ".agents/memory/mcp-tools/MEMORY.md" },
                candidatePaths: [".agents/memory/mcp-tools/MEMORY.md"],
                legacyCompatibility: false,
                migrationRequired: false,
                conflict: false,
              },
              mainFileType: "MEMORY.md",
              contentQualityStatus: "complete",
              migrationRequired: false,
              legacyCompatibility: false,
              staleness: 0,
              pendingChanges: [],
              trackedFiles: ["src/mcp-server.ts"],
              ghostFiles: [],
              indirectStaleness: 0,
              dependencies: [],
            },
          },
          fileMap: {},
          untrackedFiles: [
            { filePath: ".agents/memory/mcp-tools/archive-001.md" },
            { filePath: ".agents/memory/mcp-tools" },
          ],
        }) as unknown as Awaited<ReturnType<typeof fs.readFile>>;
      }
      throw new Error("unexpected path");
    });

    const result = await handleWorkspaceBrief({ projectRoot: PROJECT_ROOT });
    const envelope = JSON.parse(result.content[0].text);
    const brief = envelope.summary;

    expect(envelope.status).toBe("ready");
    expect(brief.readiness.status).toBe("ready");
    expect(brief.memory.untrackedFiles).toBe(0);
    expect(brief.startupReadiness.label).toBe("可以開工");
    expect(brief.readiness.reasons).toEqual([]);
    expect(brief.submitReadiness.status).toBe("needs_review");
    expect(brief.submitReadiness.reason).toBe("git state not inspected");
    expect(brief.submitReadiness.label).toBe("提交前還要跑 commit_preflight");
    expect(brief.submitReadiness.nextAction).toBe("run_commit_preflight");
    expect(brief.submitReadiness.nextTool).toBe("commit_preflight");
    expect(brief.recommendedActions).toEqual([]);
  });

  it("壓縮到期記憶卡應阻擋開工摘要", async () => {
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
            "full-cycle": {
              staleness: 0,
              pendingChanges: [],
              trackedFiles: ["src/full-cycle.ts"],
              ghostFiles: [],
              indirectStaleness: 0,
              dependencies: [],
              compaction: {
                schemaVersion: 2,
                isLegacy: false,
                contentLanguage: "en",
                humanLanguage: "zh-TW",
                sizeBytes: 8000,
                lineCount: 80,
                chineseCharCount: 0,
                bodyCharCount: 1000,
                chineseRatio: 0,
                cycleId: "2026-06-04-001",
                cycleEventCount: 30,
                cycleEventLimit: 30,
                sizeLimitBytes: 16384,
                lineLimit: 120,
                archivePolicy: "volume",
                compactionStatus: "due",
                needsCompaction: true,
                recommendedAction: "compact",
                reasons: ["cycleEventLimit"],
              },
            },
          },
          fileMap: {},
          untrackedFiles: [],
        }) as unknown as Awaited<ReturnType<typeof fs.readFile>>;
      }
      throw new Error("unexpected path");
    });

    const result = await handleWorkspaceBrief({ projectRoot: PROJECT_ROOT });
    const envelope = JSON.parse(result.content[0].text);
    const brief = envelope.summary;

    expect(envelope.status).toBe("blocked");
    expect(brief.memory.compactionDue).toBe(1);
    expect(brief.readiness.status).toBe("blocked");
    expect(brief.readiness.reasons[0]).toContain("cycleEvents=30/30");
    expect(brief.recommendedActions).toContainEqual(
      expect.objectContaining({
        action: "compact_memory_card",
        target: "full-cycle",
        blocking: true,
      }),
    );
  });

  it("只有間接過期時應回傳 warning 且不阻塞開工", async () => {
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
            "mcp-tools.consumer": {
              staleness: 0,
              pendingChanges: [],
              trackedFiles: ["src/consumer.ts"],
              ghostFiles: [],
              indirectStaleness: 7,
              dependencies: ["mcp-tools"],
              parent: "mcp-tools",
            },
          },
          fileMap: {},
          untrackedFiles: [],
        }) as unknown as Awaited<ReturnType<typeof fs.readFile>>;
      }
      throw new Error("unexpected path");
    });

    const result = await handleWorkspaceBrief({ projectRoot: PROJECT_ROOT });
    const envelope = JSON.parse(result.content[0].text);
    const brief = envelope.summary;

    expect(envelope.status).toBe("warning");
    expect(brief.readiness.status).toBe("warning");
    expect(brief.readiness.reasons).toEqual([]);
    expect(brief.readiness.reviewReasons).toContain(
      "mcp-tools.consumer: indirectStaleness=7",
    );
    expect(brief.startupReadiness.status).toBe("needs_review");
    expect(brief.submitReadiness.status).toBe("needs_review");
    expect(brief.recommendedActions).toContainEqual(
      expect.objectContaining({
        action: "review_upstream_staleness",
        blocking: false,
      }),
    );
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
              skillPath: ".agents/memory/mcp-tools/dispatcher/MEMORY.md",
              mainFile: {
                type: "MEMORY.md",
                activePath: ".agents/memory/mcp-tools/dispatcher/MEMORY.md",
                activeFileName: "MEMORY.md",
                candidates: {
                  memory: ".agents/memory/mcp-tools/dispatcher/MEMORY.md",
                },
                candidatePaths: [
                  ".agents/memory/mcp-tools/dispatcher/MEMORY.md",
                ],
                legacyCompatibility: false,
                migrationRequired: false,
                conflict: false,
              },
              mainFileType: "MEMORY.md",
              contentQualityStatus: "complete",
              migrationRequired: false,
              legacyCompatibility: false,
              staleness: 0,
              pendingChanges: [],
              trackedFiles: ["src/tool-dispatcher.ts"],
              ghostFiles: [],
              indirectStaleness: 0,
              dependencies: ["mcp-tools"],
              parent: "mcp-tools",
            },
          },
          fileMap: {},
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

  it("索引不存在時應進入相容模式並建議 memory_audit", async () => {
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
    const envelope = JSON.parse(result.content[0].text);

    expect(result.isError).toBeUndefined();
    expect(envelope.status).toBe("warning");
    expect(envelope.summary.compatibility.mode).toBe("compatibility");
    expect(envelope.findings[0].code).toBe("INDEX_MISSING");
    expect(envelope.recommendedActions[0].action).toBe("run_memory_audit");
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

  it("workspace summary 應包含非阻塞專案脈絡摘要", () => {
    const brief = buildWorkspaceBrief(
      { name: "ok", version: "1.0.0", description: "" },
      { cartridges: {}, untrackedFiles: [] },
      {
        projectContext: {
          totals: {
            cards: 1,
            byStatus: { conflict: 1 },
            byType: { preference: 1 },
          },
          readiness: {
            status: "warning",
            warnings: 1,
            errors: 0,
            usable: 0,
            advisory: 0,
            requiresDecision: 1,
          },
          usage: {
            approved: [],
            advisory: [],
            requiresDecision: ["design-dna"],
            review: [],
            deprecated: [],
          },
          findings: [
            {
              severity: "warning",
              code: "PROJECT_CONTEXT_CONFLICT_DETAIL_MISSING",
              message: "needs review",
              contextId: "design-dna",
            },
          ],
        },
      },
    );

    expect(brief.projectContext?.readiness.status).toBe("warning");
    expect(brief.startupReadiness.status).toBe("needs_review");
    expect(brief.submitReadiness.nextTool).toBe("commit_preflight");
    const projectContextAction = brief.recommendedActions.find(
      (action) => action.nextTool === "project_context_status",
    );
    expect(projectContextAction).toEqual(
      expect.objectContaining({
        nextTool: "project_context_status",
        blocking: false,
      }),
    );
  });
});
