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
import { handleProjectFileEvent } from "./monitoring/project-event-handler.js";
import { isProjectIndexArtifactPath } from "./project-index-artifacts.js";
import { reloadProjectIndexFromDisk } from "./project-index-transaction.js";

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
  private pending = new Set<Promise<unknown>>();
  private generation = 0;
  private onUpdate?: () => void;
  private onSyncWarning?: (message: string) => void;

  /** 穩定等待毫秒數（取代 chokidar awaitWriteFinish） */
  private static DEBOUNCE_MS = 300;

  constructor(
    config: CartridgeConfig,
    indexManager: CartridgeIndexManager,
    analyzer: StalenessAnalyzer,
    gitignoreFilter: GitignoreFilter,
    writer: MemoryWriter,
    onUpdate?: () => void,
    onSyncWarning?: (message: string) => void,
  ) {
    this.config = config;
    this.indexManager = indexManager;
    this.analyzer = analyzer;
    this.gitignoreFilter = gitignoreFilter;
    this.writer = writer;
    this.onUpdate = onUpdate;
    this.onSyncWarning = onSyncWarning;
  }

  /**
   * 啟動監聽引擎（VS Code 原生監聽模式）
   */
  async start(): Promise<void> {
    this.stop();
    const generation = this.generation;
    await this.drain();
    if (generation !== this.generation) return;

    const watcher = vscode.workspace.createFileSystemWatcher("**/*");

    this.watchers.push(
      watcher.onDidChange((uri) => { if (generation === this.generation) this.debounceEvent(uri.fsPath, "change"); }),
      watcher.onDidCreate((uri) => { if (generation === this.generation) this.debounceEvent(uri.fsPath, "add"); }),
      watcher.onDidDelete((uri) => { if (generation === this.generation) this.debounceEvent(uri.fsPath, "unlink"); }),
      watcher,
    );

    console.log("[監聽引擎] 已啟動（VS Code 原生監聽模式）");
  }

  /**
   * 停止監聽引擎
   */
  stop(): void {
    this.generation++;
    for (const d of this.watchers) d.dispose();
    this.watchers = [];
    for (const t of this.debounceMap.values()) clearTimeout(t);
    this.debounceMap.clear();
    console.log("[監聽引擎] 已停止");
  }

  async drain(): Promise<void> {
    await Promise.allSettled([...this.pending]);
  }

  private track(task: Promise<unknown>): void {
    this.pending.add(task);
    void task.finally(() => this.pending.delete(task)).catch(() => undefined);
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
    const relPath = path
      .relative(this.config.projectRoot, absPath)
      .replace(/\\/g, "/");
    if (relPath.toLowerCase() === ".cartridge/index.json") {
      this.debounceIndexEvent();
      return;
    }
    if (isProjectIndexArtifactPath(relPath)) return;
    const existing = this.debounceMap.get(absPath);
    if (existing) clearTimeout(existing);

    this.debounceMap.set(
      absPath,
      setTimeout(() => {
        this.debounceMap.delete(absPath);
        this.track(this.handleEvent(absPath, eventType).catch((err) =>
          console.error(`[監聽引擎] 事件處理失敗: ${absPath}`, err),
        ));
      }, CartridgeWatcher.DEBOUNCE_MS),
    );
  }

  private debounceIndexEvent(): void {
    const generation = this.generation;
    const key = "<project-index>";
    const existing = this.debounceMap.get(key);
    if (existing) clearTimeout(existing);
    this.debounceMap.set(
      key,
      setTimeout(() => {
        this.debounceMap.delete(key);
        this.track(reloadProjectIndexFromDisk(
          this.config.projectRoot,
          this.indexManager,
        )
          .then((result) => {
            if (generation !== this.generation) return;
            if (result.status === "missing" || result.status === "invalid") {
              this.onSyncWarning?.(result.warning);
            }
            if (result.status !== "self-write") this.onUpdate?.();
          })
          .catch((error) => {
            if (generation === this.generation) this.onSyncWarning?.(
              error instanceof Error ? error.message : String(error),
            );
          }));
      }, 150),
    );
  }

  /**
   * 處理檔案異動事件
   */
  private async handleEvent(
    absFilePath: string,
    eventType: FileEventType,
  ): Promise<void> {
    const generation = this.generation;
    await handleProjectFileEvent({
      config: this.config,
      indexManager: this.indexManager,
      analyzer: this.analyzer,
      gitignoreFilter: this.gitignoreFilter,
      writer: this.writer,
      absFilePath,
      eventType,
      onUpdate: () => { if (generation === this.generation) this.onUpdate?.(); },
      onRefresh: () => { if (generation === this.generation) this.refresh(); },
    });
  }

  /**
   * 測試與舊內部 seam 相容：實際處理委派給共用事件 helper。
   */
  private async handleSkillFileChange(relPath: string): Promise<void> {
    const generation = this.generation;
    await handleProjectFileEvent({
      config: this.config,
      indexManager: this.indexManager,
      analyzer: this.analyzer,
      gitignoreFilter: this.gitignoreFilter,
      writer: this.writer,
      absFilePath: path.resolve(this.config.projectRoot, relPath),
      eventType: "change",
      onUpdate: () => { if (generation === this.generation) this.onUpdate?.(); },
      onRefresh: () => { if (generation === this.generation) this.refresh(); },
    });
  }
}

