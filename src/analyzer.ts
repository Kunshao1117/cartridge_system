/**
 * 記憶卡匣外掛系統 — 過期分析器
 * 接收檔案異動事件，計算衰退指數，觸發警報寫入
 */

import type {
  CartridgeConfig,
  FileEventType,
} from "./types.js";
import type { CartridgeIndexManager } from "./index-manager.js";
import { getStalenessLevel } from "./staleness.js";

interface WarningWriter {
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
  ): Promise<void> {
    const normalizedPath = filePath.replace(/\\/g, "/");
    const affectedCartridges =
      this.indexManager.getAffectedCartridges(normalizedPath);

    if (affectedCartridges.length === 0) return;

    for (const cartridgeId of affectedCartridges) {
      // 記錄異動（去重由 indexManager 處理）
      this.indexManager.addPendingChange(
        cartridgeId,
        normalizedPath,
        eventType,
      );

      // 計算新的過期指數
      const newStaleness = this.calculateStaleness(cartridgeId);
      this.indexManager.updateStaleness(cartridgeId, newStaleness);

      // 判斷是否需要植入警報
      const level = getStalenessLevel(newStaleness, this.config);
      const entry = this.indexManager.getIndex().cartridges[cartridgeId];
      if (!entry) continue;

      if (level === "significant" || level === "critical") {
        const changedFiles = entry.pendingChanges.map((c) => c.filePath);
        await this.writer.injectWarning(
          entry.skillPath,
          changedFiles,
          newStaleness,
        );
      }

      // 標記索引已變動（Cache-First：延遲至安全時機寫入）
      this.indexManager.markDirty();
    }
  }

  /**
   * 計算指定卡匣的過期衰退指數
   */
  calculateStaleness(cartridgeId: string): number {
    const entry = this.indexManager.getIndex().cartridges[cartridgeId];
    if (!entry) return 0;

    // 異動基礎分（依事件類型加分，每個檔案最多計一次）
    let score = 0;
    for (const change of entry.pendingChanges) {
      switch (change.eventType) {
        case "change":
          score += this.config.scoring.fileChanged;
          break;
        case "unlink":
          score += this.config.scoring.fileDeleted;
          break;
        case "add":
          score += this.config.scoring.fileAdded;
          break;
      }
    }

    // 時間衰退分
    if (entry.lastUpdated) {
      const lastUpdate = new Date(entry.lastUpdated).getTime();
      const now = Date.now();
      const daysSinceUpdate = Math.floor(
        (now - lastUpdate) / (1000 * 60 * 60 * 24),
      );
      score += daysSinceUpdate * this.config.scoring.dailyDecay;
    }

    return score;
  }
}
