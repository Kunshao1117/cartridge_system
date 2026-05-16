/**
 * 記憶卡匣外掛系統 — 過期分析器單元測試
 * 覆蓋 getStalenessLevel 四分支、calculateStaleness 計分邏輯、
 * 以及 processFileEvent 整合流程（不觸及實際磁碟）
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { StalenessAnalyzer } from "../analyzer.js";
import { getStalenessLevel } from "../staleness.js";
import { CartridgeIndexManager } from "../index-manager.js";
import { createConfig } from "../config.js";

type TestMemoryWriter = {
  injectWarning: ReturnType<typeof vi.fn>;
  removeWarning: ReturnType<typeof vi.fn>;
  checkAndCleanWarning: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// getStalenessLevel — 過期等級判斷（純函式）
// ---------------------------------------------------------------------------
describe("getStalenessLevel — 過期等級四分支", () => {
  const config = createConfig("d:/cartridge_system");

  it("staleness = 0 時應回傳 healthy", () => {
    expect(getStalenessLevel(0, config)).toBe("healthy");
  });

  it("staleness = 5（低於 significant 閾值 10）時應回傳 mild", () => {
    expect(getStalenessLevel(5, config)).toBe("mild");
  });

  it("staleness = 10（達到 significant 閾值）時應回傳 significant", () => {
    expect(getStalenessLevel(10, config)).toBe("significant");
  });

  it("staleness = 30（達到 critical 閾值）時應回傳 critical", () => {
    expect(getStalenessLevel(30, config)).toBe("critical");
  });
});

// ---------------------------------------------------------------------------
// calculateStaleness — 過期指數計分邏輯
// ---------------------------------------------------------------------------
describe("StalenessAnalyzer.calculateStaleness — 計分邏輯", () => {
  let manager: CartridgeIndexManager;
  let writer: TestMemoryWriter;
  let analyzer: StalenessAnalyzer;

  beforeEach(() => {
    const config = createConfig("d:/cartridge_system");
    manager = new CartridgeIndexManager(config);
    writer = {
      injectWarning: vi.fn(),
      removeWarning: vi.fn(),
      checkAndCleanWarning: vi.fn(),
    };
    analyzer = new StalenessAnalyzer(config, manager, writer);

    // 手動注入假索引資料，跳過有 fs 依賴的 scan()
    manager["index"] = {
      version: 1,
      lastScanned: "",
      cartridges: {
        "mem-test": {
          skillPath: ".agents/skills/mem-test/SKILL.md",
          description: "",
          trackedFiles: ["src/test.ts"],
          staleness: 0,
          lastUpdated: "",
          pendingChanges: [],
          ghostFiles: [],
          dependencies: [],
          indirectStaleness: 0,
          depth: 1,
          parent: null,
        },
      },
      fileMap: { "src/test.ts": ["mem-test"] },
      untrackedFiles: [],
    };
  });

  it("change 事件應累加 10 分", () => {
    manager.addPendingChange("mem-test", "src/test.ts", "change");
    expect(analyzer.calculateStaleness("mem-test")).toBe(10);
  });

  it("unlink 事件應累加 20 分", () => {
    manager.addPendingChange("mem-test", "src/test.ts", "unlink");
    expect(analyzer.calculateStaleness("mem-test")).toBe(20);
  });

  it("add 事件應累加 5 分", () => {
    manager.addPendingChange("mem-test", "src/test.ts", "add");
    expect(analyzer.calculateStaleness("mem-test")).toBe(5);
  });

  it("不存在的卡匣應回傳 0", () => {
    expect(analyzer.calculateStaleness("mem-nonexistent")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// processFileEvent — 整合流程
// ---------------------------------------------------------------------------
describe("StalenessAnalyzer.processFileEvent — 整合流程", () => {
  let manager: CartridgeIndexManager;
  let writer: TestMemoryWriter;
  let analyzer: StalenessAnalyzer;
  const config = createConfig("d:/cartridge_system");

  beforeEach(() => {
    manager = new CartridgeIndexManager(config);
    writer = {
      injectWarning: vi.fn().mockResolvedValue(undefined),
      removeWarning: vi.fn(),
      checkAndCleanWarning: vi.fn(),
    };
    analyzer = new StalenessAnalyzer(config, manager, writer);

    // 注入假索引：一個 pendingChanges 為空的乾淨卡匣
    manager["index"] = {
      version: 1,
      lastScanned: "",
      cartridges: {
        "mem-test": {
          skillPath: ".agents/skills/mem-test/SKILL.md",
          description: "",
          trackedFiles: ["src/test.ts"],
          staleness: 0,
          lastUpdated: "",
          pendingChanges: [],
          ghostFiles: [],
          dependencies: [],
          indirectStaleness: 0,
          depth: 1,
          parent: null,
        },
      },
      fileMap: { "src/test.ts": ["mem-test"] },
      untrackedFiles: [],
    };

    // mock persist() 避免觸及 fs
    vi.spyOn(manager, "persist").mockResolvedValue(undefined);
  });

  it("無受影響卡匣時應提前返回，不呼叫 injectWarning", async () => {
    await analyzer.processFileEvent("src/untracked.ts", "change");
    expect(writer.injectWarning).not.toHaveBeenCalled();
  });

  it("分數低於 significant 閾值時不應呼叫 injectWarning", async () => {
    // 單次 add 事件 +5 分 < 閾值 10，不觸發警報
    await analyzer.processFileEvent("src/test.ts", "add");
    expect(writer.injectWarning).not.toHaveBeenCalled();
  });

  it("分數達到 significant 閾值時應呼叫 injectWarning", async () => {
    // change 事件 +10 分 = 閾值，觸發警報植入
    await analyzer.processFileEvent("src/test.ts", "change");
    expect(writer.injectWarning).toHaveBeenCalledOnce();
    expect(writer.injectWarning).toHaveBeenCalledWith(
      ".agents/skills/mem-test/SKILL.md",
      ["src/test.ts"],
      10,
    );
  });
});
