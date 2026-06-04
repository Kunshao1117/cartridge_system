/**
 * 記憶卡匣外掛系統 — MCP 工具商業邏輯單元測試
 * 使用 vi.mock 模擬 fs/promises，不觸及實際磁碟
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleMemoryList,
  handleMemoryRead,
  handleMemoryStatus,
  handleMemoryCommit as handleMemoryCommitRaw,
  handleMemoryDeps,
  updateFrontmatterFields,
} from "../mcp-handlers.js";
import { stalenessToLevel } from "../staleness.js";

// 模擬 fs/promises，隔離所有磁碟操作
vi.mock("fs/promises", () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
}));

import * as fs from "fs/promises";

const PROJECT_ROOT = "/mock/other-project";

function parseEnvelope(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

function handleMemoryCommit(args: unknown) {
  if (typeof args !== "object" || args === null) {
    return handleMemoryCommitRaw(args);
  }

  return handleMemoryCommitRaw({ ...args, confirm: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  // resolveSkillPath 會呼叫 fs.access 驗證路徑存在，預設為成功（平面路徑回退）
  vi.mocked(fs.access).mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// handleMemoryList — 列出記憶卡匣
// ---------------------------------------------------------------------------
describe("handleMemoryList", () => {
  it("應正確列出指定專案的所有 mem-* 目錄", async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { isDirectory: () => true, name: "mem-_system" },
      { isDirectory: () => true, name: "mem-analyzer" },
      { isDirectory: () => false, name: "browser-testing" }, // 非記憶卡匣，應被過濾
    ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

    const result = await handleMemoryList({ projectRoot: PROJECT_ROOT });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("mem-_system");
    expect(result.content[0].text).toContain("mem-analyzer");
    expect(result.content[0].text).not.toContain("browser-testing");
  });

  it("應使用 projectRoot 組合正確的掃描路徑", async () => {
    vi.mocked(fs.readdir).mockResolvedValue(
      [] as unknown as Awaited<ReturnType<typeof fs.readdir>>,
    );

    await handleMemoryList({ projectRoot: PROJECT_ROOT });

    const calledPath = vi.mocked(fs.readdir).mock.calls[0][0] as string;
    expect(calledPath).toContain("other-project");
    expect(calledPath).toContain(".agents");
    expect(calledPath).toContain("memory");
  });

  it("未傳入 projectRoot 時應回傳 Validation Error", async () => {
    const result = await handleMemoryList({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation Error");
  });

  it("兩個目錄皆不存在時應回傳空列表", async () => {
    vi.mocked(fs.readdir).mockRejectedValue(
      new Error("ENOENT: no such file or directory"),
    );

    const result = await handleMemoryList({ projectRoot: PROJECT_ROOT });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Available memories");
  });

  it("相對路徑應回傳 Validation Error（路徑安全防禦）", async () => {
    const result = await handleMemoryList({ projectRoot: "./relative/path" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation Error");
  });

  it("路徑穿越（..）應回傳 Validation Error", async () => {
    const result = await handleMemoryList({ projectRoot: "/foo/../../etc" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation Error");
  });

  it("索引清單應揭露壓縮治理度量", async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        cartridges: {
          "full-cycle": {
            description: "test",
            staleness: 0,
            pendingChanges: [],
            trackedFiles: ["src/full-cycle.ts"],
            ghostFiles: [],
            dependencies: [],
            indirectStaleness: 0,
            depth: 1,
            parent: null,
            compaction: {
              schemaVersion: 2,
              cardKind: "main",
              limitKind: "main",
              compliance: "due",
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
              reasons: ["cycleEventLimitReached", "cycleEventLimit"],
            },
          },
        },
        untrackedFiles: [],
      }) as unknown as Awaited<ReturnType<typeof fs.readFile>>,
    );

    const result = await handleMemoryList({ projectRoot: PROJECT_ROOT });
    const envelope = parseEnvelope(result);
    const card = envelope.summary.cartridges[0];

    expect(result.isError).toBeUndefined();
    expect(card.module).toBe("full-cycle");
    expect(card.needsCompaction).toBe(true);
    expect(card.cycleEventCount).toBe(30);
    expect(card.compactionRecommendation).toBe("compact");
    expect(card.splitSuggestion).toBeNull();
    expect(card.blockingSuggestion).toContain("壓縮門檻");
  });
});

// ---------------------------------------------------------------------------
// handleMemoryRead — 讀取記憶卡匣
// ---------------------------------------------------------------------------
describe("handleMemoryRead", () => {
  it("應正確讀取指定專案中卡匣的 SKILL.md 內容", async () => {
    const mockContent = "---\nname: mem-_system\n---\n# System";
    vi.mocked(fs.readFile).mockResolvedValue(
      mockContent as unknown as Awaited<ReturnType<typeof fs.readFile>>,
    );

    const result = await handleMemoryRead({
      moduleName: "mem-_system",
      projectRoot: PROJECT_ROOT,
    });

    expect(result.isError).toBeUndefined();
    expect(parseEnvelope(result).summary.content).toBe(mockContent);
  });

  it("應使用 projectRoot 組合正確的讀取路徑", async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      "" as unknown as Awaited<ReturnType<typeof fs.readFile>>,
    );

    await handleMemoryRead({
      moduleName: "mem-_system",
      projectRoot: PROJECT_ROOT,
    });

    // resolveSkillPath 先讀索引、再由 handler 讀 SKILL.md，取最後一次包含模組名的呼叫
    const calls = vi.mocked(fs.readFile).mock.calls;
    const skillReadCall = calls.find((c) =>
      (c[0] as string).includes("mem-_system"),
    );
    expect(skillReadCall).toBeDefined();
    expect(skillReadCall![0] as string).toContain("other-project");
    expect(skillReadCall![0] as string).toContain("SKILL.md");
  });

  it("未傳入 projectRoot 時應回傳 Validation Error", async () => {
    const result = await handleMemoryRead({ moduleName: "mem-_system" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation Error");
  });

  it("模組不存在時應回傳錯誤", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

    const result = await handleMemoryRead({
      moduleName: "mem-nonexistent",
      projectRoot: PROJECT_ROOT,
    });

    expect(result.isError).toBe(true);
  });

  it("moduleName 為空字串時應回傳 Validation Error", async () => {
    const result = await handleMemoryRead({
      moduleName: "",
      projectRoot: PROJECT_ROOT,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation Error");
  });

  it("moduleName 含路徑片段時應回傳 Validation Error", async () => {
    const result = await handleMemoryRead({
      moduleName: "../skills/08-audit-健檢",
      projectRoot: PROJECT_ROOT,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation Error");
  });

  it("路徑穿越（..）應回傳 Validation Error", async () => {
    const result = await handleMemoryRead({
      moduleName: "mem-_system",
      projectRoot: "/foo/../../../etc",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation Error");
  });
});

// ---------------------------------------------------------------------------
// updateFrontmatterFields — 結構化 frontmatter 更新
// ---------------------------------------------------------------------------
describe("updateFrontmatterFields — frontmatter 結構化更新", () => {
  it("雙引號 frontmatter 應正確更新", () => {
    const input = `---\nlast_updated: "2026-01-01T00:00:00+08:00"\nstaleness: 5\n---\n# Content`;
    const result = updateFrontmatterFields(input, {
      last_updated: "new-ts",
      staleness: 0,
    });

    expect(result).toContain("last_updated: new-ts");
    expect(result).toContain("staleness: 0");
    expect(result).toContain("# Content");
  });

  it("單引號 frontmatter 應正確更新", () => {
    const input = `---\nlast_updated: '2026-01-01T00:00:00+08:00'\nstaleness: 5\n---\n# Content`;
    const result = updateFrontmatterFields(input, {
      last_updated: "new-ts",
      staleness: 0,
    });

    expect(result).toContain("last_updated: new-ts");
    expect(result).toContain("staleness: 0");
  });

  it("無引號 frontmatter 應正確更新", () => {
    const input = `---\nlast_updated: 2026-01-01T00:00:00+08:00\nstaleness: 5\n---\n# Content`;
    const result = updateFrontmatterFields(input, {
      last_updated: "new-ts",
      staleness: 0,
    });

    expect(result).toContain("staleness: 0");
    expect(result).toContain("# Content");
  });

  it("不影響其他 frontmatter 欄位", () => {
    const input = `---\nname: mem-test\nlast_updated: "old"\nstaleness: 5\nstatus: stale\n---\n# Content`;
    const result = updateFrontmatterFields(input, { staleness: 0 });

    expect(result).toContain("name: mem-test");
    expect(result).toContain("status: stale");
    expect(result).toContain("staleness: 0");
  });
});

// ---------------------------------------------------------------------------
// stalenessToLevel — 過期等級轉換
// ---------------------------------------------------------------------------
describe("stalenessToLevel — 過期等級轉換", () => {
  it("0 應為 healthy", () => {
    expect(stalenessToLevel(0)).toBe("healthy");
  });
  it("5 應為 mild", () => {
    expect(stalenessToLevel(5)).toBe("mild");
  });
  it("10 應為 significant", () => {
    expect(stalenessToLevel(10)).toBe("significant");
  });
  it("30 應為 critical", () => {
    expect(stalenessToLevel(30)).toBe("critical");
  });
  it("負數應為 healthy", () => {
    expect(stalenessToLevel(-1)).toBe("healthy");
  });
});

// ---------------------------------------------------------------------------
// handleMemoryStatus — 過期狀態診斷
// ---------------------------------------------------------------------------
describe("handleMemoryStatus", () => {
  it("應從索引檔回傳結構化 JSON", async () => {
    const indexData = {
      cartridges: {
        "mem-analyzer": {
          staleness: 15,
          lastUpdated: "2026-03-28T10:15:00+08:00",
          trackedFiles: ["src/analyzer.ts"],
          pendingChanges: [
            {
              filePath: "src/analyzer.ts",
              eventType: "change",
              timestamp: "2026-03-29T11:00:00+08:00",
            },
          ],
        },
      },
      untrackedFiles: [
        { filePath: ".agents/memory/mem-_system/archive-001.md" },
        { filePath: ".agents/memory/mem-_system" },
      ],
    };
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(indexData) as unknown as Awaited<
        ReturnType<typeof fs.readFile>
      >,
    );

    const result = await handleMemoryStatus({
      moduleName: "mem-analyzer",
      projectRoot: PROJECT_ROOT,
    });
    const status = parseEnvelope(result).summary;

    expect(status.module).toBe("mem-analyzer");
    expect(status.staleness).toBe(15);
    expect(status.level).toBe("significant");
    expect(status.pendingChanges).toHaveLength(1);
    expect(status.pendingChanges[0].absolutePath).toContain("analyzer.ts");
    expect(status.actionRequired).toContain("view_file");
  });

  it("索引檔不存在時應回退讀 SKILL.md frontmatter", async () => {
    const skillContent =
      '---\nname: mem-test\nlast_updated: "2026-03-28T10:00:00+08:00"\nstaleness: 5\n---\n# Test';
    // 呼叫流程：1. handler 讀索引(reject) → 2. resolveSkillPath 讀索引(reject) → 3. 讀 SKILL.md(resolve)
    vi.mocked(fs.readFile)
      .mockRejectedValueOnce(new Error("ENOENT"))
      .mockRejectedValueOnce(new Error("ENOENT"))
      .mockResolvedValueOnce(
        skillContent as unknown as Awaited<ReturnType<typeof fs.readFile>>,
      );

    const result = await handleMemoryStatus({
      moduleName: "mem-test",
      projectRoot: PROJECT_ROOT,
    });
    const status = parseEnvelope(result).summary;

    expect(status.staleness).toBe(5);
    expect(status.level).toBe("mild");
    expect(status._note).toContain("索引檔不存在");
  });

  it("模組不在索引中應回傳錯誤", async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({ cartridges: {} }) as unknown as Awaited<
        ReturnType<typeof fs.readFile>
      >,
    );

    const result = await handleMemoryStatus({
      moduleName: "mem-nonexistent",
      projectRoot: PROJECT_ROOT,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("路徑穿越（..）應回傳 Validation Error", async () => {
    const result = await handleMemoryStatus({
      moduleName: "mem-test",
      projectRoot: "/foo/../../etc",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation Error");
  });
});

// ---------------------------------------------------------------------------
// handleMemoryList — 增強回傳（含過期狀態）
// ---------------------------------------------------------------------------
describe("handleMemoryList — 增強回傳", () => {
  it("有索引時應回傳含過期狀態的 JSON 陣列", async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { isDirectory: () => true, name: "mem-_system" },
      { isDirectory: () => true, name: "mem-analyzer" },
    ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);

    const indexData = {
      cartridges: {
        "mem-_system": { staleness: 0, pendingChanges: [] },
        "mem-analyzer": {
          staleness: 15,
          pendingChanges: [{ filePath: "src/analyzer.ts" }],
        },
      },
    };
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(indexData) as unknown as Awaited<
        ReturnType<typeof fs.readFile>
      >,
    );

    const result = await handleMemoryList({ projectRoot: PROJECT_ROOT });
    const data = parseEnvelope(result).summary;
    const list = data.cartridges;

    expect(list).toHaveLength(2);
    expect(list[0].module).toBe("mem-_system");
    expect(list[0].level).toBe("healthy");
    expect(list[1].module).toBe("mem-analyzer");
    expect(list[1].level).toBe("significant");
    expect(list[1].pendingChangesCount).toBe(1);
    // 驗證記憶系統內部產物不會進入未歸屬檔案欄位
    expect(data.untrackedFiles).toEqual([]);
  });

  it("有索引時應回傳標準 envelope 並保留 legacy", async () => {
    const indexData = {
      cartridges: {
        "mem-_system": { staleness: 0, pendingChanges: [] },
      },
      untrackedFiles: [],
    };
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(indexData) as unknown as Awaited<
        ReturnType<typeof fs.readFile>
      >,
    );

    const result = await handleMemoryList({ projectRoot: PROJECT_ROOT });
    const envelope = parseEnvelope(result);

    expect(envelope.status).toBe("ready");
    expect(envelope.metadata.tool).toBe("memory_list");
    expect(envelope.summary.cartridgeCount).toBe(1);
    expect(envelope.legacy.cartridges[0].module).toBe("mem-_system");
  });

  it("索引不存在時應回退到純文字模式", async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { isDirectory: () => true, name: "mem-_system" },
    ] as unknown as Awaited<ReturnType<typeof fs.readdir>>);
    vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));

    const result = await handleMemoryList({ projectRoot: PROJECT_ROOT });

    expect(result.content[0].text).toContain("Available memories:");
    expect(result.content[0].text).toContain("mem-_system");
  });
});

describe("MCP envelope 收斂", () => {
  it("memory_read 成功時應以 summary 承載內容並以 legacy 保留舊文字", async () => {
    const mockContent = "---\nname: mem-_system\n---\n# System";
    vi.mocked(fs.readFile).mockResolvedValue(
      mockContent as unknown as Awaited<ReturnType<typeof fs.readFile>>,
    );

    const result = await handleMemoryRead({
      moduleName: "mem-_system",
      projectRoot: PROJECT_ROOT,
    });
    const envelope = parseEnvelope(result);

    expect(envelope.status).toBe("ready");
    expect(envelope.metadata.tool).toBe("memory_read");
    expect(envelope.summary.content).toBe(mockContent);
    expect(envelope.legacy.text).toBe(mockContent);
  });

  it("memory_status 成功時應回傳標準 envelope", async () => {
    const indexData = {
      cartridges: {
        "mem-test": {
          staleness: 0,
          trackedFiles: ["src/test.ts"],
          pendingChanges: [],
        },
      },
    };
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(indexData) as unknown as Awaited<
        ReturnType<typeof fs.readFile>
      >,
    );

    const result = await handleMemoryStatus({
      moduleName: "mem-test",
      projectRoot: PROJECT_ROOT,
    });
    const envelope = parseEnvelope(result);

    expect(envelope.status).toBe("ready");
    expect(envelope.metadata.tool).toBe("memory_status");
    expect(envelope.summary.module).toBe("mem-test");
    expect(envelope.legacy.module).toBe("mem-test");
  });

  it("memory_commit 成功時應回傳標準 envelope 並標示寫入工具", async () => {
    const existing = `---\nname: mem-test\ndescription: test\nlast_updated: "old"\nstaleness: 0\n---\n\n## Tracked Files\n- src/foo.ts\n`;
    vi.mocked(fs.readFile).mockResolvedValue(
      existing as unknown as Awaited<ReturnType<typeof fs.readFile>>,
    );
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const result = await handleMemoryCommit({
      moduleName: "mem-test",
      projectRoot: PROJECT_ROOT,
    });
    const envelope = parseEnvelope(result);

    expect(envelope.status).toBe("warning");
    expect(envelope.metadata.tool).toBe("memory_commit");
    expect(envelope.metadata.readOnly).toBe(false);
    expect(envelope.summary.status).toBe("success");
    expect(envelope.legacy.status).toBe("success");
  });

  it("validation error 應回傳標準錯誤 envelope", async () => {
    const result = await handleMemoryRead({ moduleName: "mem-test" });
    const envelope = parseEnvelope(result);

    expect(result.isError).toBe(true);
    expect(envelope.status).toBe("error");
    expect(envelope.metadata.tool).toBe("memory_read");
    expect(envelope.findings[0].code).toBe("validation_error");
  });
});

// ---------------------------------------------------------------------------
// handleMemoryCommit — 後設資料同步
// ---------------------------------------------------------------------------
describe("handleMemoryCommit", () => {
  it("應正確更新 frontmatter 時間戳與 staleness", async () => {
    const existing = `---\nname: mem-test\ndescription: test\nlast_updated: "old"\nstaleness: 5\n---\n\n## Tracked Files\n- src/foo.ts\n`;
    vi.mocked(fs.readFile).mockResolvedValue(
      existing as unknown as Awaited<ReturnType<typeof fs.readFile>>,
    );

    let writtenContent = "";
    vi.mocked(fs.writeFile).mockImplementation(async (_path, data) => {
      writtenContent = data as string;
    });

    const result = await handleMemoryCommit({
      moduleName: "mem-test",
      projectRoot: PROJECT_ROOT,
    });

    expect(result.isError).toBeUndefined();
    expect(writtenContent).toContain("staleness: 0");
    expect(writtenContent).toContain("+08:00");
    expect(writtenContent).not.toContain("staleness: 5");
  });

  it("時間戳應包含台灣時區 +08:00", async () => {
    const existing = `---\nname: mem-test\ndescription: test\nlast_updated: "old"\nstaleness: 0\n---\n\n## Tracked Files\n- src/foo.ts\n`;
    vi.mocked(fs.readFile).mockResolvedValue(
      existing as unknown as Awaited<ReturnType<typeof fs.readFile>>,
    );

    let writtenContent = "";
    vi.mocked(fs.writeFile).mockImplementation(async (_path, data) => {
      writtenContent = data as string;
    });

    await handleMemoryCommit({
      moduleName: "mem-test",
      projectRoot: PROJECT_ROOT,
    });

    expect(writtenContent).toContain("+08:00");
    expect(writtenContent).not.toMatch(/last_updated:.*Z/);
  });

  it("應清除索引中的 pendingChanges 並重新解析 trackedFiles", async () => {
    const existing = `---\nname: mem-test\ndescription: test\nlast_updated: "old"\nstaleness: 10\n---\n\n## Tracked Files\n- src/foo.ts\n- src/bar.ts\n`;
    const indexData = {
      cartridges: {
        "mem-test": {
          staleness: 10,
          pendingChanges: [{ filePath: "src/foo.ts" }],
          trackedFiles: ["src/foo.ts"],
          ghostFiles: ["src/gone.ts"],
          lastUpdated: "old",
          indirectStaleness: 5,
        },
      },
      fileMap: { "src/foo.ts": ["mem-test"] },
      untrackedFiles: [
        { filePath: "src/bar.ts" },
        { filePath: ".agents/memory/mem-test/archive-001.md" },
        { filePath: ".agents/memory/mem-test" },
        { filePath: "src/other.ts" },
      ],
    };

    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      const fp = filePath as string;
      if (fp.includes("index.json") && fp.includes(".cartridge"))
        return JSON.stringify(indexData) as unknown as Awaited<
          ReturnType<typeof fs.readFile>
        >;
      return existing as unknown as Awaited<ReturnType<typeof fs.readFile>>;
    });

    let writtenIndex = "";
    vi.mocked(fs.writeFile).mockImplementation(async (filePath, data) => {
      const fp = filePath as string;
      if (fp.includes("index.json") && fp.includes(".cartridge")) {
        writtenIndex = data as string;
      }
    });

    const result = await handleMemoryCommit({
      moduleName: "mem-test",
      projectRoot: PROJECT_ROOT,
    });
    const report = parseEnvelope(result).summary;

    expect(report.status).toBe("success");
    expect(report.trackedFilesCount).toBe(2);

    const parsed = JSON.parse(writtenIndex);
    expect(parsed.cartridges["mem-test"].pendingChanges).toEqual([]);
    expect(parsed.cartridges["mem-test"].staleness).toBe(0);
    expect(parsed.cartridges["mem-test"].indirectStaleness).toBe(0);
    expect(parsed.cartridges["mem-test"].ghostFiles).toEqual([]);
    expect(parsed.cartridges["mem-test"].trackedFiles).toEqual([
      "src/foo.ts",
      "src/bar.ts",
    ]);
    expect(parsed.fileMap["src/foo.ts"]).toEqual(["mem-test"]);
    expect(parsed.fileMap["src/bar.ts"]).toEqual(["mem-test"]);
    expect(parsed.untrackedFiles).toEqual([{ filePath: "src/other.ts" }]);
  });

  it("模組不存在時應回傳錯誤", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"));
    vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));

    const result = await handleMemoryCommit({
      moduleName: "nonexistent",
      projectRoot: PROJECT_ROOT,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not found");
  });

  it("路徑穿越（..）應回傳 Validation Error", async () => {
    const result = await handleMemoryCommit({
      moduleName: "mem-test",
      projectRoot: "/foo/../../etc",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation Error");
  });

  it("未帶 confirm:true 直接呼叫 handler 時應回傳 Validation Error", async () => {
    const result = await handleMemoryCommitRaw({
      moduleName: "mem-test",
      projectRoot: PROJECT_ROOT,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("confirm:true");
  });

  it("moduleName 含路徑片段時應回傳 Validation Error", async () => {
    const result = await handleMemoryCommit({
      moduleName: "mem-test/../../escape",
      projectRoot: PROJECT_ROOT,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation Error");
  });

  it("缺少必要欄位時應回傳 warnings", async () => {
    const existing = `---\nname: mem-test\nstaleness: 0\n---\n\n# No Tracked Files section\n`;
    vi.mocked(fs.readFile).mockResolvedValue(
      existing as unknown as Awaited<ReturnType<typeof fs.readFile>>,
    );
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const result = await handleMemoryCommit({
      moduleName: "mem-test",
      projectRoot: PROJECT_ROOT,
    });
    const report = parseEnvelope(result).summary;

    expect(report.warnings).toContain("frontmatter 缺少 description 欄位");
    expect(report.warnings).toContain("body 缺少 ## Tracked Files 區段");
  });

  it("壓縮到期記憶卡提交時應回傳先彙整警告", async () => {
    const events = Array.from(
      { length: 30 },
      (_, index) => `- ${String(index + 1).padStart(2, "0")}: Test event.`,
    ).join("\n");
    const existing = `---
name: full-cycle
description: test
last_updated: "old"
staleness: 5
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 30
size_limit_bytes: 16384
archive_policy: volume
compaction_status: ready
metadata:
  author: test
  version: '1.0'
  origin: test
  memory_awareness: full
  tool_scope: []
---

## Current Truth

- The card has reached the cycle event limit.

## Active Constraints

- Compact before adding another event.

## Cycle Events

${events}

## Archive Index

- None.

## 中文摘要

- 週期已滿。

## Tracked Files

- src/full-cycle.ts
`;
    const indexData = {
      cartridges: {
        "full-cycle": {
          skillPath: ".agents/memory/full-cycle/SKILL.md",
          staleness: 5,
          pendingChanges: [],
          trackedFiles: ["src/full-cycle.ts"],
          lastUpdated: "old",
          ghostFiles: [],
          dependencies: [],
          indirectStaleness: 0,
        },
      },
      fileMap: { "src/full-cycle.ts": ["full-cycle"] },
      untrackedFiles: [],
    };
    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      const fp = filePath as string;
      if (fp.includes("index.json")) {
        return JSON.stringify(indexData) as unknown as Awaited<
          ReturnType<typeof fs.readFile>
        >;
      }
      if (fp.includes("full-cycle") && fp.endsWith("SKILL.md")) {
        return existing as unknown as Awaited<ReturnType<typeof fs.readFile>>;
      }
      throw new Error("unexpected path");
    });
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const result = await handleMemoryCommit({
      moduleName: "full-cycle",
      projectRoot: PROJECT_ROOT,
    });
    const report = parseEnvelope(result).summary;

    expect(report.status).toBe("success");
    expect(
      report.warnings.some((warning: string) =>
        warning.includes("MEMORY_COMPACTION_DUE"),
      ),
    ).toBe(true);
  });

  it("週期事件超過三十筆時 memory_commit 應阻擋且不寫入", async () => {
    const events = Array.from(
      { length: 31 },
      (_, index) => `- ${String(index + 1).padStart(2, "0")}: Test event.`,
    ).join("\n");
    const existing = `---
name: overflow-cycle
description: test
last_updated: "old"
staleness: 5
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 31
size_limit_bytes: 16384
archive_policy: volume
compaction_status: ready
metadata:
  author: test
  version: '1.0'
  origin: test
  memory_awareness: full
  tool_scope: []
---

## Current Truth

- The card exceeded the cycle event limit.

## Active Constraints

- Compact before adding another event.

## Cycle Events

${events}

## Archive Index

- None.

## 中文摘要

- 週期已超標。

## Tracked Files

- src/overflow-cycle.ts
`;
    const indexData = {
      cartridges: {
        "overflow-cycle": {
          skillPath: ".agents/memory/overflow-cycle/SKILL.md",
          staleness: 5,
          pendingChanges: [],
          trackedFiles: ["src/overflow-cycle.ts"],
          lastUpdated: "old",
          ghostFiles: [],
          dependencies: [],
          indirectStaleness: 0,
        },
      },
      fileMap: { "src/overflow-cycle.ts": ["overflow-cycle"] },
      untrackedFiles: [],
    };
    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      const fp = filePath as string;
      if (fp.includes("index.json")) {
        return JSON.stringify(indexData) as unknown as Awaited<
          ReturnType<typeof fs.readFile>
        >;
      }
      if (fp.includes("overflow-cycle") && fp.endsWith("SKILL.md")) {
        return existing as unknown as Awaited<ReturnType<typeof fs.readFile>>;
      }
      throw new Error("unexpected path");
    });
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const result = await handleMemoryCommit({
      moduleName: "overflow-cycle",
      projectRoot: PROJECT_ROOT,
    });
    const envelope = parseEnvelope(result);

    expect(result.isError).toBe(true);
    expect(envelope.findings[0].code).toBe("memory_compaction_required");
    expect(envelope.findings[0].message).toContain("Cycle Events 已超過 30 筆");
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it("索引檔不存在時同步仍應成功", async () => {
    const existing = `---\nname: mem-test\ndescription: test\nlast_updated: "old"\nstaleness: 5\n---\n\n## Tracked Files\n- src/foo.ts\n`;

    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      const fp = filePath as string;
      if (fp.includes("index.json") && fp.includes(".cartridge"))
        throw new Error("ENOENT");
      return existing as unknown as Awaited<ReturnType<typeof fs.readFile>>;
    });
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const result = await handleMemoryCommit({
      moduleName: "mem-test",
      projectRoot: PROJECT_ROOT,
    });
    const report = parseEnvelope(result).summary;

    expect(report.status).toBe("success");
    expect(result.isError).toBeUndefined();
  });

  it("未傳入 projectRoot 時應回傳 Validation Error", async () => {
    const result = await handleMemoryCommit({ moduleName: "mem-test" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation Error");
  });

  // --- 新增：結構驗證強化測試 (v4.1) ---

  it("[HEADING_TYPO] 標題拼寫錯誤應出現在 warnings 中", async () => {
    const existing = `---\nname: mem-test\ndescription: test\nlast_updated: "old"\nstaleness: 0\n---\n\n## Tracked FilesD\n- src/foo.ts\n`;
    vi.mocked(fs.readFile).mockResolvedValue(
      existing as unknown as Awaited<ReturnType<typeof fs.readFile>>,
    );
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const result = await handleMemoryCommit({
      moduleName: "mem-test",
      projectRoot: PROJECT_ROOT,
    });
    const report = parseEnvelope(result).summary;

    expect(
      report.warnings.some((w: string) => w.includes("HEADING_TYPO")),
    ).toBe(true);
    expect(
      report.warnings.some((w: string) => w.includes("Tracked FilesD")),
    ).toBe(true);
    expect(result.isError).toBeUndefined(); // 警告不阻斷 commit
  });

  it("[HEADING_TYPO] 精確標題不應觸發 HEADING_TYPO 警告", async () => {
    const existing = `---\nname: mem-test\ndescription: test\nlast_updated: "old"\nstaleness: 0\n---\n\n## Tracked Files\n- src/foo.ts\n`;
    vi.mocked(fs.readFile).mockResolvedValue(
      existing as unknown as Awaited<ReturnType<typeof fs.readFile>>,
    );
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const result = await handleMemoryCommit({
      moduleName: "mem-test",
      projectRoot: PROJECT_ROOT,
    });
    const report = parseEnvelope(result).summary;

    expect(
      report.warnings.some((w: string) => w.includes("HEADING_TYPO")),
    ).toBe(false);
  });

  it("[PATH_ABSOLUTE] 絕對路徑應出現在 warnings 中", async () => {
    const existing = `---\nname: mem-test\ndescription: test\nlast_updated: "old"\nstaleness: 0\n---\n\n## Tracked Files\n- /absolute/path/file.ts\n`;
    vi.mocked(fs.readFile).mockResolvedValue(
      existing as unknown as Awaited<ReturnType<typeof fs.readFile>>,
    );
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const result = await handleMemoryCommit({
      moduleName: "mem-test",
      projectRoot: PROJECT_ROOT,
    });
    const report = parseEnvelope(result).summary;

    expect(
      report.warnings.some((w: string) => w.includes("PATH_ABSOLUTE")),
    ).toBe(true);
    expect(result.isError).toBeUndefined();
  });

  it("[PATH_TRAVERSAL] 路徑穿越符號應出現在 warnings 中", async () => {
    const existing = `---\nname: mem-test\ndescription: test\nlast_updated: "old"\nstaleness: 0\n---\n\n## Tracked Files\n- ../sibling/file.ts\n`;
    vi.mocked(fs.readFile).mockResolvedValue(
      existing as unknown as Awaited<ReturnType<typeof fs.readFile>>,
    );
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const result = await handleMemoryCommit({
      moduleName: "mem-test",
      projectRoot: PROJECT_ROOT,
    });
    const report = parseEnvelope(result).summary;

    expect(
      report.warnings.some((w: string) => w.includes("PATH_TRAVERSAL")),
    ).toBe(true);
    expect(result.isError).toBeUndefined();
  });

  it("[PATH_VALID] 標準相對路徑不應觸發路徑警告", async () => {
    const existing = `---\nname: mem-test\ndescription: test\nlast_updated: "old"\nstaleness: 0\n---\n\n## Tracked Files\n- src/index.ts\n`;
    vi.mocked(fs.readFile).mockResolvedValue(
      existing as unknown as Awaited<ReturnType<typeof fs.readFile>>,
    );
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const result = await handleMemoryCommit({
      moduleName: "mem-test",
      projectRoot: PROJECT_ROOT,
    });
    const report = parseEnvelope(result).summary;

    expect(
      report.warnings.some((w: string) => w.includes("PATH_")),
    ).toBe(false);
  });

  it("[DEPENDENCY_SEMANTICS] 可疑 dependencies 應出現在 warnings 中", async () => {
    const existing = `---\nname: mcp-tools.dispatcher\ndescription: test\nlast_updated: "old"\nstaleness: 0\ndependencies:\n  - mcp-tools\n---\n\n## Tracked Files\n- src/tool-dispatcher.ts\n\n## Key Decisions\n- D01: Dispatcher routes tool calls.\n\n## Relations\n- mcp-tools（父卡）\n`;
    const indexData = {
      cartridges: {
        "mcp-tools.dispatcher": {
          staleness: 0,
          pendingChanges: [],
          trackedFiles: ["src/tool-dispatcher.ts"],
          lastUpdated: "old",
          parent: "mcp-tools",
        },
      },
      fileMap: { "src/tool-dispatcher.ts": ["mcp-tools.dispatcher"] },
    };

    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      const fp = filePath as string;
      if (fp.includes("index.json") && fp.includes(".cartridge")) {
        return JSON.stringify(indexData) as unknown as Awaited<
          ReturnType<typeof fs.readFile>
        >;
      }
      return existing as unknown as Awaited<ReturnType<typeof fs.readFile>>;
    });
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const result = await handleMemoryCommit({
      moduleName: "mcp-tools.dispatcher",
      projectRoot: PROJECT_ROOT,
    });
    const report = parseEnvelope(result).summary;

    expect(
      report.warnings.some((warning: string) =>
        warning.includes("DEPENDENCY_PARENT_CHILD_SUSPECT"),
      ),
    ).toBe(true);
    expect(
      report.warnings.some((warning: string) =>
        warning.includes("DEPENDENCY_RELATION_MIRROR_SUSPECT"),
      ),
    ).toBe(true);
  });

  it("[WARNING_STRIP] commit 後應自動清除警告 HTML 區塊", async () => {
    const existing =
      `---\nname: mem-test\ndescription: test\nlast_updated: "old"\nstaleness: 0\n---\n` +
      `<!-- CARTRIDGE_SYSTEM_WARNING_START -->\n⚠️ 此卡匣已嚴重過期\n<!-- CARTRIDGE_SYSTEM_WARNING_END -->\n` +
      `\n## Tracked Files\n- src/foo.ts\n`;
    vi.mocked(fs.readFile).mockResolvedValue(
      existing as unknown as Awaited<ReturnType<typeof fs.readFile>>,
    );

    let writtenContent = "";
    vi.mocked(fs.writeFile).mockImplementation(async (_path, data) => {
      writtenContent = data as string;
    });

    await handleMemoryCommit({
      moduleName: "mem-test",
      projectRoot: PROJECT_ROOT,
    });

    expect(writtenContent).not.toContain("CARTRIDGE_SYSTEM_WARNING_START");
    expect(writtenContent).not.toContain("CARTRIDGE_SYSTEM_WARNING_END");
    expect(writtenContent).toContain("## Tracked Files");
  });
});

describe("moduleName schema — MCP path segment 防線", () => {
  it("memory_status 應拒絕路徑片段 moduleName", async () => {
    const result = await handleMemoryStatus({
      moduleName: "..\\memory\\_system",
      projectRoot: PROJECT_ROOT,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation Error");
  });

  it("memory_deps 應拒絕路徑片段 moduleName", async () => {
    const result = await handleMemoryDeps({
      moduleName: "mcp-tools/handlers",
      projectRoot: PROJECT_ROOT,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation Error");
  });
});
