/**
 * 記憶卡匣外掛系統 — 記憶索引管理器
 * 管理卡匣索引與檔案→卡匣反向映射
 */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type {
  CartridgeConfig,
  CartridgeEntry,
  CartridgeIndex,
  FileEventType,
  UntrackedFileEntry,
} from "./types.js";
import type { GitignoreFilter } from "./gitignore-filter.js";
import { getSkillsAbsPath, getMemoryAbsPath } from "./config.js";
import { getTaiwanISO } from "./timestamp.js";

const INDEX_FILENAME = ".cartridge/index.json";

/** 巢狀目錄最大掃描深度 */
const MAX_SCAN_DEPTH = 4;

/**
 * 從記憶卡匣 SKILL.md 解析追蹤檔案清單
 */
export function parseTrackedFiles(content: string): string[] {
  // 統一行尾為 LF，防止 Windows CRLF 導致正則失配
  const normalized = content.replace(/\r\n/g, "\n");

  const trackedSection = normalized.match(
    /## Tracked Files\n([\s\S]*?)(?=\n## |\n---|\n$)/,
  )?.[1];
  if (!trackedSection) return [];

  return trackedSection
    .split("\n")
    .map((line) =>
      line
        .replace(/^-\s*/, "") // 去除行首「- 」
        .replace(/`/g, "") // 去除 Markdown 反引號
        .replace(/\s.*$/, "") // 截斷第一個空格後的說明文字
        .trim(),
    )
    .filter(
      (line) =>
        line.length > 0 &&
        !line.startsWith("（") &&
        !line.startsWith("#") && // 過濾 ### 分組標題
        !line.startsWith("<") && // 過濾 HTML 標記
        !line.startsWith("←"), // 過濾行尾備註殘留
    );
}

/**
 * 記憶索引管理器
 */
export class CartridgeIndexManager {
  private config: CartridgeConfig;
  private index: CartridgeIndex;

  constructor(config: CartridgeConfig) {
    this.config = config;
    this.index = {
      version: 1,
      lastScanned: "",
      cartridges: {},
      fileMap: {},
      untrackedFiles: [],
    };
  }

  /**
   * 掃描所有記憶卡匣並建立索引（支援巢狀目錄，最大 4 層）
   */
  async scan(): Promise<CartridgeIndex> {
    const memoryDir = getMemoryAbsPath(this.config);
    const skillsDir = getSkillsAbsPath(this.config);
    const newCartridges: Record<string, CartridgeEntry> = {};
    const newFileMap: Record<string, string[]> = {};

    // v4.0 主路徑：掃描 .agents/memory/（無 mem- 前綴限制）
    if (fs.existsSync(memoryDir)) {
      this.scanRecursive(memoryDir, 1, null, newCartridges, newFileMap, false);
    }

    // 向後相容：掃描 .agents/skills/ 下的 mem-* 目錄（漸進遷移）
    if (fs.existsSync(skillsDir)) {
      this.scanRecursive(skillsDir, 1, null, newCartridges, newFileMap, true);
    }

    if (
      Object.keys(newCartridges).length === 0 &&
      !fs.existsSync(memoryDir) &&
      !fs.existsSync(skillsDir)
    ) {
      this.index = {
        version: 1,
        lastScanned: getTaiwanISO(),
        cartridges: {},
        fileMap: {},
        untrackedFiles: [],
      };
      return this.index;
    }

    // 保留既有的未歸屬檔案池
    const existingUntracked = this.index.untrackedFiles ?? [];
    this.index = {
      version: 1,
      lastScanned: getTaiwanISO(),
      cartridges: newCartridges,
      fileMap: newFileMap,
      untrackedFiles: existingUntracked,
    };

    return this.index;
  }

  /**
   * 遞迴掃描記憶卡目錄，從目錄結構推導 depth 和 parent
   * @param requireMemPrefix - true: 只掃描 mem-* 前綴目錄（向後相容 skills/）；false: 掃描所有含 SKILL.md 的目錄
   */
  private scanRecursive(
    dir: string,
    depth: number,
    parentId: string | null,
    cartridges: Record<string, CartridgeEntry>,
    fileMap: Record<string, string[]>,
    requireMemPrefix: boolean,
  ): void {
    if (depth > MAX_SCAN_DEPTH) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // 向後相容模式：只掃描 mem-* 前綴；新模式：掃描所有目錄（排除系統目錄）
      if (requireMemPrefix && !entry.name.startsWith("mem-")) continue;
      if (!requireMemPrefix && entry.name.startsWith(".")) continue;

      const skillPath = path.join(dir, entry.name, "SKILL.md");
      if (!fs.existsSync(skillPath)) continue;

      const raw = fs.readFileSync(skillPath, "utf-8");
      const { data: frontmatter, content } = matter(raw);

      const trackedFiles = parseTrackedFiles(content);
      // 巢狀記憶使用 dot-separated 路徑作為唯一識別碼
      // 根層: "extension"、巢狀: "api.auth"、深層: "api.auth.oauth"
      const cartridgeId = parentId ? `${parentId}.${entry.name}` : entry.name;

      // 保留既有的 pendingChanges（若有的話）
      const existingEntry = this.index.cartridges[cartridgeId];

      cartridges[cartridgeId] = {
        skillPath: path.relative(this.config.projectRoot, skillPath),
        description: (frontmatter.description as string) ?? "",
        trackedFiles,
        staleness: (frontmatter.staleness as number) ?? 0,
        lastUpdated: (frontmatter.last_updated as string) ?? "",
        pendingChanges: existingEntry?.pendingChanges ?? [],
        depth,
        parent: parentId,
      };

      // 建立反向映射
      for (const file of trackedFiles) {
        if (!fileMap[file]) fileMap[file] = [];
        if (!fileMap[file].includes(cartridgeId)) {
          fileMap[file].push(cartridgeId);
        }
      }

      // 遞迴掃描子目錄（子卡不需要 mem- 前綴）
      this.scanRecursive(
        path.join(dir, entry.name),
        depth + 1,
        cartridgeId,
        cartridges,
        fileMap,
        false,
      );
    }
  }

  /**
   * 取得目前的索引
   */
  getIndex(): CartridgeIndex {
    return this.index;
  }

  /**
   * 取得反向映射：檔案→卡匣列表
   */
  getAffectedCartridges(filePath: string): string[] {
    // 嘗試精確匹配與正規化路徑匹配
    const normalized = filePath.replace(/\\/g, "/");
    return this.index.fileMap[normalized] ?? this.index.fileMap[filePath] ?? [];
  }

  /**
   * 取得所有被追蹤的檔案路徑
   */
  getAllTrackedFiles(): string[] {
    return Object.keys(this.index.fileMap);
  }

  /**
   * 取得指定記憶卡的子卡清單
   */
  getChildren(cartridgeId: string): string[] {
    return Object.entries(this.index.cartridges)
      .filter(([, entry]) => entry.parent === cartridgeId)
      .map(([id]) => id);
  }

  /**
   * 將模組名稱解析為實際 SKILL.md 檔案路徑
   */
  resolveModulePath(moduleName: string): string | null {
    const entry = this.index.cartridges[moduleName];
    if (entry) return path.resolve(this.config.projectRoot, entry.skillPath);
    return null;
  }

  /**
   * 更新指定卡匣的過期指數
   */
  updateStaleness(cartridgeId: string, staleness: number): void {
    const entry = this.index.cartridges[cartridgeId];
    if (entry) {
      entry.staleness = staleness;
    }
  }

  /**
   * 新增待處理的異動紀錄
   */
  addPendingChange(
    cartridgeId: string,
    filePath: string,
    eventType: "add" | "change" | "unlink",
  ): void {
    const entry = this.index.cartridges[cartridgeId];
    if (!entry) return;

    // 去重：同一檔案不重複記錄
    const exists = entry.pendingChanges.some((c) => c.filePath === filePath);
    if (exists) return;

    entry.pendingChanges.push({
      filePath,
      eventType,
      timestamp: getTaiwanISO(),
    });
  }

  /**
   * 清空指定卡匣的待處理異動清單（staleness 重設後呼叫）
   */
  clearPendingChanges(cartridgeId: string): void {
    const entry = this.index.cartridges[cartridgeId];
    if (entry) {
      entry.pendingChanges = [];
    }
  }

  /**
   * 啟動時偵測停機期間遺漏的檔案變動
   * 比對每個追蹤檔案的修改時間（mtime）與記憶卡的 lastUpdated，
   * 若檔案比記憶卡還新，則補記 pendingChange 並更新 staleness
   */
  detectMissedChanges(scoring: CartridgeConfig["scoring"]): void {
    for (const [cartridgeId, entry] of Object.entries(this.index.cartridges)) {
      if (!entry.lastUpdated || entry.trackedFiles.length === 0) continue;

      const lastUpdatedMs = new Date(entry.lastUpdated).getTime();
      if (isNaN(lastUpdatedMs)) continue;

      for (const trackedFile of entry.trackedFiles) {
        // 跳過目錄型追蹤（如 src/templates/）
        if (trackedFile.endsWith("/")) continue;

        const absPath = path.resolve(this.config.projectRoot, trackedFile);
        try {
          const stat = fs.statSync(absPath);
          if (stat.mtimeMs > lastUpdatedMs) {
            this.addPendingChange(cartridgeId, trackedFile, "change");
          }
        } catch {
          // 檔案不存在 — 記錄為刪除事件，觸發過期計算
          this.addPendingChange(cartridgeId, trackedFile, "unlink");
        }
      }

      // 重新計算 staleness
      if (entry.pendingChanges.length > 0) {
        let score = 0;
        for (const change of entry.pendingChanges) {
          switch (change.eventType) {
            case "change":
              score += scoring.fileChanged;
              break;
            case "unlink":
              score += scoring.fileDeleted;
              break;
            case "add":
              score += scoring.fileAdded;
              break;
          }
        }
        entry.staleness = score;
      }
    }
  }

  /**
   * 新增未歸屬檔案紀錄
   */
  addUntrackedFile(filePath: string, eventType: FileEventType): void {
    if (!this.index.untrackedFiles) {
      this.index.untrackedFiles = [];
    }
    // 去重：同一檔案不重複記錄
    const exists = this.index.untrackedFiles.some(
      (f) => f.filePath === filePath,
    );
    if (exists) return;

    this.index.untrackedFiles.push({
      filePath,
      suggestedOwner: null,
      detectedAt: getTaiwanISO(),
      lastEvent: eventType,
    });
  }

  /**
   * 從未歸屬池移除指定檔案（歸屬至記憶卡後呼叫）
   */
  removeUntrackedFile(filePath: string): void {
    if (!this.index.untrackedFiles) return;
    this.index.untrackedFiles = this.index.untrackedFiles.filter(
      (f) => f.filePath !== filePath,
    );
  }

  /**
   * 取得未歸屬檔案清單
   */
  getUntrackedFiles(): UntrackedFileEntry[] {
    return this.index.untrackedFiles ?? [];
  }

  /**
   * 清空未歸屬檔案池（重新掃描前呼叫）
   */
  clearUntrackedFiles(): void {
    this.index.untrackedFiles = [];
  }

  /**
   * 掃描完整專案目錄，找出未被任何記憶卡追蹤且不在 .gitignore 內的檔案
   */
  detectUntrackedFiles(gitignoreFilter: GitignoreFilter): void {
    const allFiles = gitignoreFilter.scanDirectory(this.config.projectRoot);
    const allTracked = new Set(this.getAllTrackedFiles());

    for (const file of allFiles) {
      // 排除系統安全網目錄
      if (this.config.excludeDirs.some((d) => file.startsWith(d))) continue;
      // 排除系統產物
      if (this.config.ignoreFiles.some((f) => file.endsWith(f))) continue;
      // 排除 .agents/ 內但非記憶卡的檔案
      if (file.startsWith(".agents/") && !file.includes(".agents/memory/"))
        continue;
      // 排除已追蹤檔案
      if (allTracked.has(file)) continue;
      // 排除記憶卡本身 (SKILL.md)
      if (file.endsWith("SKILL.md") && file.includes(".agents/memory/"))
        continue;

      // 加入未歸屬檔案池
      this.addUntrackedFile(file, "add");
    }
  }

  /**
   * 使用最新的 GitignoreFilter 重新過濾幽靈池
   * 移除已被 .gitignore 排除的檔案，以及已被記憶卡追蹤的檔案
   */
  refilterUntrackedFiles(gitignoreFilter: GitignoreFilter): void {
    if (!this.index.untrackedFiles) return;
    const allTracked = new Set(this.getAllTrackedFiles());
    this.index.untrackedFiles = this.index.untrackedFiles.filter((entry) => {
      // 若已被 .gitignore 排除，移除
      if (gitignoreFilter.isIgnored(entry.filePath)) return false;
      // 若已被記憶卡追蹤，移除
      if (allTracked.has(entry.filePath)) return false;
      return true;
    });
  }

  /**
   * 持久化索引至 JSON 檔案
   */
  async persist(): Promise<void> {
    const indexPath = path.resolve(this.config.projectRoot, INDEX_FILENAME);
    // 確保 .cartridge/ 目錄存在
    const dir = path.dirname(indexPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const content = JSON.stringify(this.index, null, 2);
    fs.writeFileSync(indexPath, content, "utf-8");
  }

  /**
   * 從 JSON 檔案載入索引
   */
  async load(): Promise<boolean> {
    const indexPath = path.resolve(this.config.projectRoot, INDEX_FILENAME);
    if (!fs.existsSync(indexPath)) return false;

    try {
      const raw = fs.readFileSync(indexPath, "utf-8");
      this.index = JSON.parse(raw) as CartridgeIndex;
      return true;
    } catch {
      return false;
    }
  }
}
