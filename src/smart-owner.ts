/**
 * 記憶卡匣外掛系統 — 智慧歸屬推薦引擎
 * 使用最長公共目錄前綴匹配演算法推薦檔案歸屬
 */

import path from "node:path";
import type { CartridgeIndex } from "./types.js";

/**
 * 為未歸屬檔案推薦最可能的記憶卡歸屬
 * @param filePath - 相對路徑（正斜線）
 * @param index - 當前記憶體索引
 * @returns 推薦的 cartridgeId，無法推薦時回傳 null
 */
export function suggestOwner(
  filePath: string,
  index: CartridgeIndex,
): string | null {
  const targetParts = path.dirname(filePath).split("/");
  let bestId: string | null = null;
  let bestDepth = 0;

  for (const [cartridgeId, entry] of Object.entries(index.cartridges)) {
    for (const tracked of entry.trackedFiles) {
      const trackedParts = path.dirname(tracked).split("/");
      let common = 0;
      for (
        let i = 0;
        i < Math.min(targetParts.length, trackedParts.length);
        i++
      ) {
        if (targetParts[i] === trackedParts[i]) common++;
        else break;
      }
      if (common > bestDepth) {
        bestDepth = common;
        bestId = cartridgeId;
      }
    }
  }

  // 至少需要 2 層目錄吻合才推薦（避免 "src/" 這種過於寬泛的匹配）
  return bestDepth >= 2 ? bestId : null;
}
