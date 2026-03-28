/**
 * 記憶卡匣外掛系統 — 時間戳生成模組
 * 統一全系統的台灣時區（Asia/Taipei）時間戳處理
 */

/**
 * 產生台灣時區的 ISO 8601 時間戳
 * 使用 Intl API 確保時區正確性，不依賴手動偏移計算
 * @returns ISO 8601 格式字串，例如 '2026-03-28T12:50:17+08:00'
 */
export function getTaiwanISO(): string {
  const now = new Date()

  // 使用瑞典語系格式（'sv'）取得接近 ISO 的基底字串
  // 輸出格式：'2026-03-28 12:50:17'
  const base = now.toLocaleString('sv', { timeZone: 'Asia/Taipei' })

  // 轉換為 ISO 8601 格式並附加台灣時區偏移
  return base.replace(' ', 'T') + '+08:00'
}
