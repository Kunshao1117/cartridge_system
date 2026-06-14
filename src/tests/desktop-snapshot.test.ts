import { describe, expect, it } from "vitest";
import { buildDesktopProjectSnapshot } from "../monitoring/project-snapshot.js";
import type { CartridgeIndex } from "../types.js";

describe("buildDesktopProjectSnapshot", () => {
  it("summarizes blocking and review counts", () => {
    const snapshot = buildDesktopProjectSnapshot({
      projectRoot: "D:/demo",
      enabled: true,
      index: createIndex(),
    });

    expect(snapshot.status).toBe("blocked");
    expect(snapshot.counts.cartridges).toBe(2);
    expect(snapshot.counts.blocking).toBe(3);
    expect(snapshot.counts.review).toBe(1);
    expect(snapshot.counts.ghostFiles).toBe(1);
    expect(snapshot.counts.untrackedFiles).toBe(1);
    expect(snapshot.cartridges[0]).toMatchObject({
      id: "core",
      pendingChangeFiles: [
        {
          filePath: "src/index.ts",
          eventType: "change",
          label: "變更",
        },
      ],
      trackedFiles: ["src/index.ts"],
      guidance: "開啟 core 記憶卡，依待處理檔案更新內容或確認變更已無影響。",
    });
    expect(snapshot.cartridges[1]).toMatchObject({
      id: "ui",
      ghostFilePaths: ["src/missing.ts"],
      guidance: "開啟 ui 記憶卡，從 Tracked Files 移除已不存在的檔案路徑。",
    });
    expect(snapshot.untrackedFiles[0]).toMatchObject({
      filePath: "src/new.ts",
      lastEvent: "add",
      guidance: "先判斷這個新檔案屬於哪張記憶卡，再開啟對應記憶卡加入 Tracked Files。",
    });
    expect(snapshot.untrackedFiles.map((entry) => entry.filePath)).toEqual([
      "src/new.ts",
    ]);
  });

  it("marks disabled projects as paused", () => {
    const snapshot = buildDesktopProjectSnapshot({
      projectRoot: "D:/demo",
      enabled: false,
      index: createIndex(),
    });

    expect(snapshot.status).toBe("paused");
  });
});

function createIndex(): CartridgeIndex {
  return {
    version: 1,
    lastScanned: "2026-06-02T12:00:00+08:00",
    fileMap: {},
    untrackedFiles: [
      {
        filePath: "src/new.ts",
        suggestedOwner: null,
        detectedAt: "2026-06-02T12:00:00+08:00",
        lastEvent: "add",
      },
      {
        filePath: ".agents/memory/core/archive-001.md",
        suggestedOwner: null,
        detectedAt: "2026-06-02T12:00:00+08:00",
        lastEvent: "add",
      },
    ],
    cartridges: {
      core: {
        skillPath: ".agents/memory/core/MEMORY.md",
        mainFile: {
          type: "MEMORY.md",
          activePath: ".agents/memory/core/MEMORY.md",
          activeFileName: "MEMORY.md",
          candidates: { memory: ".agents/memory/core/MEMORY.md" },
          candidatePaths: [".agents/memory/core/MEMORY.md"],
          legacyCompatibility: false,
          migrationRequired: false,
          conflict: false,
        },
        mainFileType: "MEMORY.md",
        contentQualityStatus: "complete",
        migrationRequired: false,
        legacyCompatibility: false,
        description: "core",
        trackedFiles: ["src/index.ts"],
        staleness: 10,
        lastUpdated: "2026-06-02T12:00:00+08:00",
        pendingChanges: [
          {
            filePath: "src/index.ts",
            eventType: "change",
            timestamp: "2026-06-02T12:00:00+08:00",
          },
        ],
        depth: 1,
        parent: null,
        ghostFiles: [],
        dependencies: [],
        indirectStaleness: 0,
      },
      ui: {
        skillPath: ".agents/memory/ui/MEMORY.md",
        mainFile: {
          type: "MEMORY.md",
          activePath: ".agents/memory/ui/MEMORY.md",
          activeFileName: "MEMORY.md",
          candidates: { memory: ".agents/memory/ui/MEMORY.md" },
          candidatePaths: [".agents/memory/ui/MEMORY.md"],
          legacyCompatibility: false,
          migrationRequired: false,
          conflict: false,
        },
        mainFileType: "MEMORY.md",
        contentQualityStatus: "complete",
        migrationRequired: false,
        legacyCompatibility: false,
        description: "ui",
        trackedFiles: ["src/ui.ts"],
        staleness: 0,
        lastUpdated: "2026-06-02T12:00:00+08:00",
        pendingChanges: [],
        depth: 1,
        parent: null,
        ghostFiles: ["src/missing.ts"],
        dependencies: ["core"],
        indirectStaleness: 5,
      },
    },
  };
}
