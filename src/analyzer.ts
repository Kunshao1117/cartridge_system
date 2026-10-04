/**
 * 記憶卡匣外掛系統 — 過期分析器
 * 接收檔案異動事件，計算衰退指數，觸發警報寫入
 */

import type {
  CartridgeConfig,
  FileEventType,
} from "./types.js";
import type { CartridgeIndexManager } from "./index-manager.js";
import { calculatePendingStaleness, getStalenessLevel } from "./staleness.js";

interface WarningWriter {
  syncWarningState?(skillRelPath: string, changedFiles: string[], staleness: number): Promise<void>;
  injectWarning(
    skillRelPath: string,
    changedFiles: string[],
    staleness: number,
  ): Promise<void>;
  removeWarning(skillRelPath: string): Promise<void>;
  checkAndCleanWarning(skillRelPath: string): Promise<boolean>;
}

/**
 * 過期分析器
 */
export class StalenessAnalyzer {
  private config: CartridgeConfig;
  private indexManager: CartridgeIndexManager;
  private writer: WarningWriter;

  constructor(
    config: CartridgeConfig,
    indexManager: CartridgeIndexManager,
    writer: WarningWriter,
  ) {
    this.config = config;
    this.indexManager = indexManager;
    this.writer = writer;
  }

  /**
   * 處理檔案異動事件
   * @param filePath - 相對於專案根目錄的檔案路徑
   * @param eventType - 事件類型
   */
  async processFileEvent(
    filePath: string,
    eventType: FileEventType,
  ): Promise<boolean> {
    const normalizedPath = filePath.replace(/\\/g, "/");
    const affectedCartridges =
      this.indexManager.getAffectedCartridges(normalizedPath);

    if (affectedCartridges.length === 0) return false;
    let updated = false;

    for (const cartridgeId of affectedCartridges) {
      // 記錄異動（去重由 indexManager 處理）
      const changed = this.indexManager.addPendingChange(
        cartridgeId,
        normalizedPath,
        eventType,
      );
      if (!changed) continue;
      updated = true;

      // 計算新的過期指數
      const newStaleness = this.calculateStaleness(cartridgeId);
      this.indexManager.updateStaleness(cartridgeId, newStaleness);

      // 判斷是否需要植入警報
      const level = getStalenessLevel(newStaleness, this.config);
      const entry = this.indexManager.getIndex().cartridges[cartridgeId];
      if (!entry) continue;

      if ((level === "significant" || level === "critical") &&
          entry.mainFile?.type !== "conflict" && entry.mainFile?.type !== "missing") {
        const changedFiles = entry.pendingChanges.map((c) => c.filePath);
        await this.writer.injectWarning(
          entry.mainFile?.activePath ?? entry.skillPath,
          changedFiles,
          newStaleness,
        );
      }

      // 標記索引已變動（Cache-First：延遲至安全時機寫入）
      this.indexManager.markDirty();
    }
    if (updated) this.indexManager.buildAndMergeDependencies();
    return updated;
  }

  /** Restore/update a missing warning without treating the write as a review. */
  async refreshWarnings(cartridgeId?: string): Promise<void> {
    for (const [id, entry] of Object.entries(this.indexManager.getIndex().cartridges)) {
      if (cartridgeId !== undefined && id !== cartridgeId) continue;
      if (entry.mainFile?.type === "conflict" || entry.mainFile?.type === "missing") continue;
      if (this.writer.syncWarningState) {
        await this.writer.syncWarningState(entry.mainFile?.activePath ?? entry.skillPath,
          entry.pendingChanges.map((change) => change.filePath), entry.staleness);
        continue;
      }
      const level = getStalenessLevel(entry.staleness, this.config);
      if (level === "significant" || level === "critical") {
        await this.writer.injectWarning(entry.mainFile?.activePath ?? entry.skillPath,
          entry.pendingChanges.map((change) => change.filePath), entry.staleness);
      } else if (entry.pendingChanges.length === 0 && entry.ghostFiles.length === 0) {
        await this.writer.checkAndCleanWarning(entry.mainFile?.activePath ?? entry.skillPath);
      }
    }
  }

  /**
   * 計算指定卡匣的過期衰退指數
   */
  calculateStaleness(cartridgeId: string): number {
    const entry = this.indexManager.getIndex().cartridges[cartridgeId];
    if (!entry) return 0;

    return calculatePendingStaleness(entry, this.config.scoring);
  }
}
