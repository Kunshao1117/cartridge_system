/**
 * 記憶卡匣外掛系統 — 檔案監聽引擎 v2.0
 * 使用 VS Code 原生 FileSystemWatcher + 自製 debounceMap 取代 chokidar
 */

import path from "node:path";
import * as vscode from "vscode";
import type { CartridgeConfig, FileEventType } from "./types.js";
import type { CartridgeIndexManager } from "./index-manager.js";
import type { StalenessAnalyzer } from "./analyzer.js";
import type { GitignoreFilter } from "./gitignore-filter.js";
import type { MemoryWriter } from "./writer.js";

/**
 * 檔案監聽引擎（v2.0 VS Code 原生監聽模式）
 */
export class CartridgeWatcher {
  private config: CartridgeConfig;
  private indexManager: CartridgeIndexManager;
  private analyzer: StalenessAnalyzer;
  private gitignoreFilter: GitignoreFilter;
  private writer: MemoryWriter;
  private watchers: vscode.Disposable[] = [];
  private debounceMap = new Map<string, NodeJS.Timeout>();
  private onUpdate?: () => void;

  /** 穩定等待毫秒數（取代 chokidar awaitWriteFinish） */
  private static DEBOUNCE_MS = 300;

  constructor(
    config: CartridgeConfig,
    indexManager: CartridgeIndexManager,
    analyzer: StalenessAnalyzer,
    gitignoreFilter: GitignoreFilter,
    writer: MemoryWriter,
    onUpdate?: () => void,
  ) {
    this.config = config;
    this.indexManager = indexManager;
    this.analyzer = analyzer;
    this.gitignoreFilter = gitignoreFilter;
    this.writer = writer;
    this.onUpdate = onUpdate;
  }

  /**
   * 啟動監聽引擎（VS Code 原生監聽模式）
   */
  async start(): Promise<void> {
    this.stop();

    const watcher = vscode.workspace.createFileSystemWatcher("**/*");

    this.watchers.push(
      watcher.onDidChange((uri) => this.debounceEvent(uri.fsPath, "change")),
      watcher.onDidCreate((uri) => this.debounceEvent(uri.fsPath, "add")),
      watcher.onDidDelete((uri) => this.debounceEvent(uri.fsPath, "unlink")),
      watcher,
    );

    console.log("[監聽引擎] 已啟動（VS Code 原生監聽模式）");
  }

  /**
   * 停止監聽引擎
   */
  stop(): void {
    for (const d of this.watchers) d.dispose();
    this.watchers = [];
    for (const t of this.debounceMap.values()) clearTimeout(t);
    this.debounceMap.clear();
    console.log("[監聽引擎] 已停止");
  }

  /**
   * 動態更新監聽清單（原生監聽模式下為空操作）
   * 保留此方法以維持介面相容性
   */
  refresh(): void {
    // 原生監聽模式下無需動態調整
  }

  /**
   * 300ms 穩定等待防抖（取代 chokidar awaitWriteFinish）
   * 同一檔案在 300ms 內的多次事件只處理最後一次
   */
  private debounceEvent(absPath: string, eventType: FileEventType): void {
    const existing = this.debounceMap.get(absPath);
    if (existing) clearTimeout(existing);

    this.debounceMap.set(
      absPath,
      setTimeout(() => {
        this.debounceMap.delete(absPath);
        this.handleEvent(absPath, eventType);
      }, CartridgeWatcher.DEBOUNCE_MS),
    );
  }

  /**
   * 處理檔案異動事件
   */
  private async handleEvent(
    absFilePath: string,
    eventType: FileEventType,
  ): Promise<void> {
    const relPath = path
      .relative(this.config.projectRoot, absFilePath)
      .replace(/\\/g, "/");

    // 系統產物豁免：跳過外掛自身產出的檔案，防止自我監聽迴圈
    if (this.config.ignoreFiles.some((f) => relPath.endsWith(f))) {
      return;
    }

    // 安全網排除（DEFAULT_EXCLUDES）+ Gitignore 動態排除
    if (
      this.config.excludeDirs.some((d) => relPath.startsWith(d)) ||
      this.gitignoreFilter.isIgnored(relPath)
    ) {
      return;
    }

    // .agents/ 內但非記憶卡的變動（如 rules/、skills/）不觸發過期分析
    if (
      relPath.startsWith(".agents/") &&
      !relPath.includes(".agents/memory/") &&
      !relPath.includes(".agents/skills/mem-")
    ) {
      return;
    }

    // 檢查是否為記憶卡匣本身的變動（AI 重設 staleness）
    if (
      (relPath.includes(".agents/memory/") ||
        relPath.includes(".agents/skills/mem-")) &&
      relPath.endsWith("SKILL.md")
    ) {
      await this.handleSkillFileChange(relPath);
      return;
    }

    // 已追蹤檔案 → 更新過期指數
    const affected = this.indexManager.getAffectedCartridges(relPath);
    if (affected.length > 0) {
      console.log(`[監聽引擎] 偵測到異動: ${eventType} ${relPath}`);
      await this.analyzer.processFileEvent(relPath, eventType);
      // 刪除事件 → 標記幽靈檔案
      if (eventType === "unlink") {
        for (const cartridgeId of affected) {
          this.indexManager.markGhostFile(cartridgeId, relPath);
        }
      }
      this.onUpdate?.();
      return;
    }

    // .gitignore 本身被修改 → 重載排除引擎並重新過濾幽靈池
    if (relPath === ".gitignore" && eventType === "change") {
      console.log("[監聽引擎] .gitignore 已變更，重載排除引擎");
      this.gitignoreFilter.reload();
      this.indexManager.refilterUntrackedFiles(this.gitignoreFilter);
      this.indexManager.markDirty();
      this.onUpdate?.();
      return;
    }

    // 刪除事件 → 從幽靈池移除
    if (eventType === "unlink") {
      this.indexManager.removeUntrackedFile(relPath);
      this.indexManager.markDirty();
      this.onUpdate?.();
      return;
    }

    // 以上皆非 → 未歸屬檔案，加入幽靈池
    this.indexManager.addUntrackedFile(relPath, eventType);
    this.indexManager.markDirty();
    this.onUpdate?.();
  }

  /**
   * 處理記憶卡匣自身的變動（偵測 AI 是否重設了過期指數）
   */
  private async handleSkillFileChange(relPath: string): Promise<void> {
    // 偵測記憶卡匣變動時，重新掃描索引以同步快取
    const index = this.indexManager.getIndex();
    const cartridgeEntry = Object.entries(index.cartridges).find(
      ([, entry]) => entry.skillPath === relPath,
    );

    if (cartridgeEntry) {
      this.indexManager.clearPendingChanges(cartridgeEntry[0]);
    }

    await this.writer.checkAndCleanWarning(relPath);

    await this.indexManager.scan();
    this.indexManager.markDirty(); // 強制觸發 UI 變動通知 (onChanged)
    this.refresh();
    console.log(`[監聽引擎] 偵測到記憶卡重設: ${relPath}`);
    this.onUpdate?.();
  }
}
