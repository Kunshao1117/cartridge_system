/**
 * 記憶卡匣外掛系統 — 索引管理器單元測試
 * 覆蓋 parseTrackedFiles 路徑淨化邏輯與 CartridgeIndexManager 核心方法
 */

import { describe, it, expect, beforeEach } from "vitest";
import { parseTrackedFiles } from "../index-manager.js";
import { CartridgeIndexManager } from "../index-manager.js";
import { createConfig } from "../config.js";

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
