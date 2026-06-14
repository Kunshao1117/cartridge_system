/**
 * 記憶卡匣外掛系統 — 索引管理器單元測試
 * 覆蓋 parseTrackedFiles 路徑淨化邏輯與 CartridgeIndexManager 核心方法
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it, expect, beforeEach } from "vitest";
import {
  createVisibleCartridgeIndex,
  parseTrackedFiles,
  shouldWarnEmptyTrackedFiles,
} from "../index-manager.js";
import { CartridgeIndexManager } from "../index-manager.js";
import { createConfig } from "../config.js";
import type { GitignoreFilter } from "../gitignore-filter.js";
import type { CartridgeIndex } from "../types.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => fs.rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

// ---------------------------------------------------------------------------
// parseTrackedFiles — 路徑淨化邏輯
// ---------------------------------------------------------------------------
describe("parseTrackedFiles — 路徑淨化邏輯", () => {
  it("應正確解析標準純路徑", () => {
    const content = `
## Tracked Files
- src/index-manager.ts
- src/config.ts

## Key Decisions
`;
    expect(parseTrackedFiles(content)).toEqual([
      "src/index-manager.ts",
      "src/config.ts",
    ]);
  });

  it("應去除 Markdown 反引號", () => {
    const content = `
## Tracked Files
- \`src/mcp-server.ts\`

## Key Decisions
`;
    expect(parseTrackedFiles(content)).toEqual(["src/mcp-server.ts"]);
  });

  it("應截斷第一個空格後的說明文字", () => {
    const content = `
## Tracked Files
- src/extension.ts (VS Code 外掛入口)
- package.json (MCP dependencies)

## Key Decisions
`;
    expect(parseTrackedFiles(content)).toEqual([
      "src/extension.ts",
      "package.json",
    ]);
  });

  it("應同時處理反引號與說明文字的混合格式", () => {
    const content = `
## Tracked Files
- \`src/writer.ts\`
- src/analyzer.ts (過期分析器)
- src/watcher.ts

## Key Decisions
`;
    expect(parseTrackedFiles(content)).toEqual([
      "src/writer.ts",
      "src/analyzer.ts",
      "src/watcher.ts",
    ]);
  });

  it("應在無 Tracked Files 區段時回傳空陣列", () => {
    const content = `
## Key Decisions
- D01: some decision

## Module Lessons
`;
    expect(parseTrackedFiles(content)).toEqual([]);
  });

  it("應忽略全為空的行", () => {
    const content = `
## Tracked Files
- src/types.ts

- src/config.ts

## Key Decisions
`;
    expect(parseTrackedFiles(content)).toEqual([
      "src/types.ts",
      "src/config.ts",
    ]);
  });

  it("應正確解析 CRLF（Windows）行尾的檔案", () => {
    // 模擬 Windows CRLF 行尾
    const content =
      "## Tracked Files\r\n- src/foo.ts\r\n- src/bar.ts\r\n\r\n## Key Decisions\r\n";
    expect(parseTrackedFiles(content)).toEqual(["src/foo.ts", "src/bar.ts"]);
  });

  it("應過濾 ### 分組標題（不當成路徑）", () => {
    const content = `
## Tracked Files

### Config
- src/config.ts
- src/types.ts

### Tests
- src/tests/foo.test.ts

## Key Decisions
`;
    const result = parseTrackedFiles(content);
    expect(result).toEqual([
      "src/config.ts",
      "src/types.ts",
      "src/tests/foo.test.ts",
    ]);
    expect(result).not.toContain("###");
    expect(result).not.toContain("### Config");
  });

  it("應過濾 HTML 註解標記（如系統警報殘留）", () => {
    const content = `
## Tracked Files
<!-- CARTRIDGE_SYSTEM_WARNING_START -->
- src/foo.ts

## Key Decisions
`;
    const result = parseTrackedFiles(content);
    expect(result).toEqual(["src/foo.ts"]);
    expect(result).not.toContain("<!--");
  });

  it("明確宣告不追蹤檔案的總覽卡不應被視為格式偏差", () => {
    const content = `
## Tracked Files

（父層總覽卡，不直接追蹤實作檔案；實作檔案由子卡承接）

## Key Decisions
`;

    expect(parseTrackedFiles(content)).toEqual([]);
    expect(shouldWarnEmptyTrackedFiles(content)).toBe(false);
  });

  it("空白 Tracked Files 區塊仍應回報疑似格式偏差", () => {
    const content = `
## Tracked Files

## Key Decisions
`;

    expect(parseTrackedFiles(content)).toEqual([]);
    expect(shouldWarnEmptyTrackedFiles(content)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CartridgeIndexManager — 記憶主檔標準化掃描
// ---------------------------------------------------------------------------
describe("CartridgeIndexManager — 記憶主檔標準化掃描", () => {
  async function createScanFixture(): Promise<string> {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-index-"));
    tempRoots.push(root);
    await fs.mkdir(path.join(root, ".agents", "memory"), { recursive: true });
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(path.join(root, "src", "index.ts"), "export {};\n");
    return root;
  }

  async function writeMemoryCard(
    root: string,
    moduleName: string,
    fileName: "MEMORY.md" | "SKILL.md",
  ): Promise<void> {
    const cardDir = path.join(root, ".agents", "memory", moduleName);
    await fs.mkdir(cardDir, { recursive: true });
    await fs.writeFile(
      path.join(cardDir, fileName),
      [
        "---",
        `name: ${moduleName}`,
        `description: ${moduleName} memory`,
        "last_updated: '2026-01-01T00:00:00+08:00'",
        "staleness: 0",
        "memory_schema_version: 2",
        "memory_quality_version: 1",
        "memory_kind: implementation",
        "verification_status: verified",
        "last_verified: '2026-06-14T00:00:00+08:00'",
        "valid_scope:",
        "  - src/index.ts",
        "---",
        "",
        "## Current Truth",
        "- True.",
        "## Active Constraints",
        "- Constraint.",
        "## Cycle Events",
        "- Event.",
        "## Archive Index",
        "- None.",
        "## Evidence Base",
        "- src/index.ts",
        "## Read Contract",
        "- Read.",
        "## Conflicts and Supersession",
        "- None.",
        "## 中文摘要",
        "- 摘要。",
        "## Tracked Files",
        "- src/index.ts",
        "",
      ].join("\n"),
    );
  }

  it("掃描 MEMORY.md 為新版主檔", async () => {
    const root = await createScanFixture();
    await writeMemoryCard(root, "core", "MEMORY.md");
    const manager = new CartridgeIndexManager(createConfig(root));

    const index = await manager.scan();

    expect(index.cartridges.core.mainFileType).toBe("MEMORY.md");
    expect(index.cartridges.core.skillPath).toBe(
      ".agents/memory/core/MEMORY.md",
    );
    expect(index.cartridges.core.contentQualityStatus).toBe("complete");
  });

  it("掃描 legacy SKILL.md 並標記需遷移", async () => {
    const root = await createScanFixture();
    await writeMemoryCard(root, "legacy", "SKILL.md");
    const manager = new CartridgeIndexManager(createConfig(root));

    const index = await manager.scan();

    expect(index.cartridges.legacy.mainFileType).toBe("legacy SKILL.md");
    expect(index.cartridges.legacy.legacyCompatibility).toBe(true);
    expect(index.cartridges.legacy.migrationRequired).toBe(true);
  });

  it("雙主檔衝突不可靜默選擇", async () => {
    const root = await createScanFixture();
    await writeMemoryCard(root, "conflict", "MEMORY.md");
    await writeMemoryCard(root, "conflict", "SKILL.md");
    const manager = new CartridgeIndexManager(createConfig(root));

    const index = await manager.scan();

    expect(index.cartridges.conflict.mainFileType).toBe("conflict");
    expect(index.cartridges.conflict.mainFile?.activePath).toBeNull();
    expect(index.cartridges.conflict.contentQualityStatus).toBe("conflict");
  });

  it("archive 目錄內的 SKILL.md 不會被掃成作用中主檔", async () => {
    const root = await createScanFixture();
    await writeMemoryCard(root, "core", "MEMORY.md");
    await fs.mkdir(path.join(root, ".agents", "memory", "core", "archive", "001"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(root, ".agents", "memory", "core", "archive", "001", "SKILL.md"),
      "# Archived",
    );
    const manager = new CartridgeIndexManager(createConfig(root));

    const index = await manager.scan();

    expect(Object.keys(index.cartridges)).toEqual(["core"]);
    expect(index.cartridges.core.mainFileType).toBe("MEMORY.md");
  });

  it("父層缺主檔但有子卡時應列為 missing", async () => {
    const root = await createScanFixture();
    await writeMemoryCard(root, path.join("domain", "child"), "MEMORY.md");
    const manager = new CartridgeIndexManager(createConfig(root));

    const index = await manager.scan();

    expect(index.cartridges.domain.mainFileType).toBe("missing");
    expect(index.cartridges["domain.child"].mainFileType).toBe("MEMORY.md");
  });

  it("錯誤大小寫的 memory.md 不應當成作用中主檔", async () => {
    const root = await createScanFixture();
    const cardDir = path.join(root, ".agents", "memory", "case-test");
    await fs.mkdir(cardDir, { recursive: true });
    await fs.writeFile(path.join(cardDir, "memory.md"), "");
    await writeMemoryCard(root, path.join("case-test", "child"), "MEMORY.md");
    const manager = new CartridgeIndexManager(createConfig(root));

    const index = await manager.scan();

    expect(index.cartridges["case-test"].mainFileType).toBe("missing");
    expect(index.cartridges["case-test.child"].mainFileType).toBe("MEMORY.md");
  });
});

// ---------------------------------------------------------------------------
// CartridgeIndexManager — addPendingChange 去重邏輯
// ---------------------------------------------------------------------------
describe("CartridgeIndexManager — addPendingChange 去重邏輯", () => {
  let manager: CartridgeIndexManager;

  beforeEach(() => {
    const config = createConfig("d:/cartridge_system");
    manager = new CartridgeIndexManager(config);
    // 手動注入一個卡匣記錄，跳過 fs 依賴的 scan()
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

  it("同一檔案兩次 change 事件只應記錄一筆", () => {
    manager.addPendingChange("mem-test", "src/test.ts", "change");
    manager.addPendingChange("mem-test", "src/test.ts", "change");

    const changes = manager.getIndex().cartridges["mem-test"].pendingChanges;
    expect(changes).toHaveLength(1);
  });

  it("clearPendingChanges 後應清空待處理清單", () => {
    manager.addPendingChange("mem-test", "src/test.ts", "change");
    expect(
      manager.getIndex().cartridges["mem-test"].pendingChanges,
    ).toHaveLength(1);

    manager.clearPendingChanges("mem-test");
    expect(
      manager.getIndex().cartridges["mem-test"].pendingChanges,
    ).toHaveLength(0);
  });

  it("getAffectedCartridges 應支援 forward slash 正規化", () => {
    const result = manager.getAffectedCartridges("src\\test.ts");
    // Windows 反斜線正規化後應找到 mem-test
    expect(result).toEqual(["mem-test"]);
  });
});

// ---------------------------------------------------------------------------
// CartridgeIndexManager — getChildren 子卡查詢
// ---------------------------------------------------------------------------
describe("CartridgeIndexManager — getChildren 子卡查詢", () => {
  let manager: CartridgeIndexManager;

  beforeEach(() => {
    const config = createConfig("d:/test-project");
    manager = new CartridgeIndexManager(config);
    manager["index"] = {
      version: 1,
      lastScanned: "",
      cartridges: {
        "mem-api": {
          skillPath: ".agents/skills/mem-api/SKILL.md",
          description: "",
          trackedFiles: [],
          staleness: 0,
          lastUpdated: "",
          pendingChanges: [],
          ghostFiles: [],
          dependencies: [],
          indirectStaleness: 0,
          depth: 1,
          parent: null,
        },
        "mem-api-auth": {
          skillPath: ".agents/skills/mem-api/mem-api-auth/SKILL.md",
          description: "",
          trackedFiles: [],
          staleness: 0,
          lastUpdated: "",
          pendingChanges: [],
          ghostFiles: [],
          dependencies: [],
          indirectStaleness: 0,
          depth: 2,
          parent: "mem-api",
        },
        "mem-api-manage": {
          skillPath: ".agents/skills/mem-api/mem-api-manage/SKILL.md",
          description: "",
          trackedFiles: [],
          staleness: 0,
          lastUpdated: "",
          pendingChanges: [],
          ghostFiles: [],
          dependencies: [],
          indirectStaleness: 0,
          depth: 2,
          parent: "mem-api",
        },
      },
      fileMap: {},
      untrackedFiles: [],
    };
  });

  it("應回傳指定記憶卡的子卡清單", () => {
    const children = manager.getChildren("mem-api");
    expect(children).toHaveLength(2);
    expect(children).toContain("mem-api-auth");
    expect(children).toContain("mem-api-manage");
  });

  it("無子卡時應回傳空陣列", () => {
    expect(manager.getChildren("mem-api-auth")).toEqual([]);
  });

  it("不存在的記憶卡應回傳空陣列", () => {
    expect(manager.getChildren("mem-nonexistent")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// CartridgeIndexManager — resolveModulePath 巢狀路徑解析
// ---------------------------------------------------------------------------
describe("CartridgeIndexManager — resolveModulePath", () => {
  let manager: CartridgeIndexManager;

  beforeEach(() => {
    const config = createConfig("d:/test-project");
    manager = new CartridgeIndexManager(config);
    manager["index"] = {
      version: 1,
      lastScanned: "",
      cartridges: {
        "mem-api": {
          skillPath: ".agents/skills/mem-api/SKILL.md",
          description: "",
          trackedFiles: [],
          staleness: 0,
          lastUpdated: "",
          pendingChanges: [],
          ghostFiles: [],
          dependencies: [],
          indirectStaleness: 0,
          depth: 1,
          parent: null,
        },
        "mem-api-auth": {
          skillPath: ".agents/skills/mem-api/mem-api-auth/SKILL.md",
          description: "",
          trackedFiles: [],
          staleness: 0,
          lastUpdated: "",
          pendingChanges: [],
          ghostFiles: [],
          dependencies: [],
          indirectStaleness: 0,
          depth: 2,
          parent: "mem-api",
        },
      },
      fileMap: {},
      untrackedFiles: [],
    };
  });

  it("索引中存在的模組應回傳絕對路徑", () => {
    const result = manager.resolveModulePath("mem-api");
    expect(result).toContain("mem-api");
    expect(result).toContain("SKILL.md");
  });

  it("巢狀模組應回傳包含巢狀路徑", () => {
    const result = manager.resolveModulePath("mem-api-auth");
    expect(result).toContain("mem-api");
    expect(result).toContain("mem-api-auth");
    expect(result).toContain("SKILL.md");
  });

  it("索引中不存在的模組應回傳 null", () => {
    expect(manager.resolveModulePath("mem-nonexistent")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CartridgeIndexManager — refilterUntrackedFiles 自動清理
// ---------------------------------------------------------------------------
describe("CartridgeIndexManager — refilterUntrackedFiles 自動清理", () => {
  function makeFilter(ignored: string[] = []): GitignoreFilter {
    return {
      isIgnored: (filePath: string) => ignored.includes(filePath),
    } as GitignoreFilter;
  }

  it("scan 後應能移除已被 trackedFiles 收編的未歸屬檔案", () => {
    const manager = new CartridgeIndexManager(createConfig("d:/test-project"));
    manager["index"] = {
      version: 1,
      lastScanned: "",
      cartridges: {
        "mem-test": {
          skillPath: ".agents/memory/mem-test/SKILL.md",
          description: "",
          trackedFiles: ["src/owned.ts"],
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
      fileMap: { "src/owned.ts": ["mem-test"] },
      untrackedFiles: [
        { filePath: "src/owned.ts", suggestedOwner: "mem-test", detectedAt: "now", lastEvent: "add" },
        { filePath: "src/orphan.ts", suggestedOwner: null, detectedAt: "now", lastEvent: "add" },
      ],
    };

    manager.refilterUntrackedFiles(makeFilter());

    expect(manager.getUntrackedFiles().map((entry) => entry.filePath)).toEqual([
      "src/orphan.ts",
    ]);
  });

  it("應移除已被 gitignore 排除的未歸屬檔案且保留未追蹤檔案", () => {
    const manager = new CartridgeIndexManager(createConfig("d:/test-project"));
    manager["index"] = {
      version: 1,
      lastScanned: "",
      cartridges: {},
      fileMap: {},
      untrackedFiles: [
        { filePath: "dist/out.js", suggestedOwner: null, detectedAt: "now", lastEvent: "add" },
        { filePath: "src/new.ts", suggestedOwner: null, detectedAt: "now", lastEvent: "add" },
      ],
    };

    manager.refilterUntrackedFiles(makeFilter(["dist/out.js"]));

    expect(manager.getUntrackedFiles().map((entry) => entry.filePath)).toEqual([
      "src/new.ts",
    ]);
  });

  it("應移除記憶系統內部歸檔卷與目錄", () => {
    const manager = new CartridgeIndexManager(createConfig("d:/test-project"));
    manager["index"] = {
      version: 1,
      lastScanned: "",
      cartridges: {},
      fileMap: {},
      untrackedFiles: [
        { filePath: ".agents/memory/core/archive-001.md", suggestedOwner: null, detectedAt: "now", lastEvent: "add" },
        { filePath: ".agents/memory/core", suggestedOwner: null, detectedAt: "now", lastEvent: "add" },
        { filePath: "src/orphan.ts", suggestedOwner: null, detectedAt: "now", lastEvent: "add" },
      ],
    };

    manager.refilterUntrackedFiles(makeFilter());

    expect(manager.getUntrackedFiles().map((entry) => entry.filePath)).toEqual([
      "src/orphan.ts",
    ]);
  });

  it("可見索引視圖應排除記憶內部未歸屬殘留且保留產品檔案", () => {
    const index: CartridgeIndex = {
      version: 1,
      lastScanned: "",
      cartridges: {},
      fileMap: {},
      untrackedFiles: [
        {
          filePath: ".agents/memory/core/archive-001.md",
          suggestedOwner: null,
          detectedAt: "now",
          lastEvent: "add",
        },
        {
          filePath: ".agents/skills/mem-core/archive-001.md",
          suggestedOwner: null,
          detectedAt: "now",
          lastEvent: "add",
        },
        {
          filePath: "src/orphan.ts",
          suggestedOwner: null,
          detectedAt: "now",
          lastEvent: "add",
        },
      ],
    };

    const visible = createVisibleCartridgeIndex(index);

    expect(visible.untrackedFiles.map((entry) => entry.filePath)).toEqual([
      "src/orphan.ts",
    ]);
    expect(index.untrackedFiles).toHaveLength(3);
  });

  it("掃描未歸屬檔案時應忽略記憶系統內部產物", () => {
    const manager = new CartridgeIndexManager(createConfig("d:/test-project"));

    manager.detectUntrackedFiles(
      [
        ".agents/memory/core/archive-001.md",
        ".agents/memory/core",
        ".agents/skills/mem-example/archive-001.md",
        "src/orphan.ts",
      ],
      makeFilter(),
    );

    expect(manager.getUntrackedFiles().map((entry) => entry.filePath)).toEqual([
      "src/orphan.ts",
    ]);
  });
});
