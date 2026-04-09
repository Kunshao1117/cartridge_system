/**
 * 記憶卡匣外掛系統 — 檔案監聽引擎
 * 使用 chokidar 監聽整個專案目錄，搭配 Gitignore 排除引擎過濾事件
 */

import fs from "node:fs";
import path from "node:path";
import { watch } from "chokidar";
import type { FSWatcher } from "chokidar";
import type { CartridgeConfig, FileEventType } from "./types.js";
import type { CartridgeIndexManager } from "./index-manager.js";
import type { StalenessAnalyzer } from "./analyzer.js";
import type { GitignoreFilter } from "./gitignore-filter.js";
import { MemoryWriter } from "./writer.js";
import matter from "gray-matter";

/**
 * 檔案監聽引擎（v1.0 全專案目錄監控模式）
 */
export class CartridgeWatcher {
  private config: CartridgeConfig;
  private indexManager: CartridgeIndexManager;
  private analyzer: StalenessAnalyzer;
  private gitignoreFilter: GitignoreFilter;
  private watcher: FSWatcher | null = null;
  private onUpdate?: () => void;

  constructor(
    config: CartridgeConfig,
    indexManager: CartridgeIndexManager,
    analyzer: StalenessAnalyzer,
    gitignoreFilter: GitignoreFilter,
    onUpdate?: () => void,
  ) {
    this.config = config;
    this.indexManager = indexManager;
    this.analyzer = analyzer;
    this.gitignoreFilter = gitignoreFilter;
    this.onUpdate = onUpdate;
  }

  /**
   * 啟動監聽引擎（全專案目錄監控模式）
   */
  async start(): Promise<void> {
    if (this.watcher) {
      await this.stop();
    }

    this.watcher = watch(this.config.projectRoot, {
      persistent: true,
      ignoreInitial: true,
      ignored: (filePath: string) => {
        const rel = path
          .relative(this.config.projectRoot, filePath)
          .replace(/\\/g, "/");
        // 空路徑或根路徑不忽略
        if (!rel || rel === ".") return false;
        // 安全網排除（DEFAULT_EXCLUDES） + Gitignore 動態排除
        return (
          this.config.excludeDirs.some((d) => rel.startsWith(d)) ||
          this.gitignoreFilter.isIgnored(rel)
        );
      },
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    this.watcher
      .on("change", (filePath: string) => this.handleEvent(filePath, "change"))
      .on("add", (filePath: string) => this.handleEvent(filePath, "add"))
      .on("unlink", (filePath: string) => this.handleEvent(filePath, "unlink"));

    console.log(
      `[監聽引擎] 已啟動，全專案目錄監控模式（Gitignore 排除引擎啟用）`,
    );
  }

  /**
   * 停止監聽引擎
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      console.log("[監聽引擎] 已停止");
    }
  }

  /**
   * 動態更新監聽清單（v1.0 全目錄監控模式下簡化為空操作）
   * 保留此方法以維持介面相容性
   */
  refresh(): void {
    // 全目錄監控模式下無需動態調整監聽路徑
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
      this.onUpdate?.();
      return;
    }

    // .gitignore 本身被修改 → 重載排除引擎並重新過濾幽靈池
    if (relPath === ".gitignore" && eventType === "change") {
      console.log("[監聽引擎] .gitignore 已變更，重載排除引擎");
      this.gitignoreFilter.reload();
      this.indexManager.refilterUntrackedFiles(this.gitignoreFilter);
      await this.indexManager.persist();
      this.onUpdate?.();
      return;
    }

    // 刪除事件 → 從幽靈池移除（如果存在的話）
    if (eventType === "unlink") {
      this.indexManager.removeUntrackedFile(relPath);
      await this.indexManager.persist();
      this.onUpdate?.();
      return;
    }

    // 以上皆非 → 未歸屬檔案，加入未歸屬池
    this.indexManager.addUntrackedFile(relPath, eventType);
    await this.indexManager.persist();
    this.onUpdate?.();
  }

  /**
   * 處理記憶卡匣自身的變動（偵測 AI 是否重設了過期指數）
   * 修復：MCP 寫入乾淨 SKILL.md（無警告區塊）時也需觸發快取同步
   */
  private async handleSkillFileChange(relPath: string): Promise<void> {
    const writer = new MemoryWriter(this.config);

    // 先嘗試清除舊警告（有警告 + staleness=0 的情況）
    const cleaned = await writer.checkAndCleanWarning(relPath);

    // 即使沒有舊警告，只要 staleness=0 就視為 AI 已重設，需同步快取
    let needsSync = cleaned;
    if (!needsSync) {
      const absPath = path.resolve(this.config.projectRoot, relPath);
      try {
        const raw = fs.readFileSync(absPath, "utf-8");
        const parsed = matter(raw);
        needsSync = Number(parsed.data.staleness) === 0;
      } catch {
        // 讀取失敗則不同步
      }
    }

    if (needsSync) {
      // 巢狀路徑：取 SKILL.md 前一層目錄名作為 cartridgeId
      const pathParts = relPath.split("/");
      const skillIdx = pathParts.lastIndexOf("SKILL.md");
      const cartridgeId =
        skillIdx > 0 ? pathParts[skillIdx - 1] : pathParts.slice(-2)[0];
      this.indexManager.clearPendingChanges(cartridgeId);
      await this.indexManager.scan();
      this.refresh();
      console.log(`[監聯引擎] 偵測到記憶卡重設，已清除警報: ${relPath}`);
      this.onUpdate?.();
    }
  }
}
