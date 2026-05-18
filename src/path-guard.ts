/**
 * 記憶卡匣外掛系統 — 路徑安全驗證模組
 * 防禦路徑穿越攻擊，確保 projectRoot 指向合法的絕對路徑
 */

import path from 'node:path'

/**
 * 驗證 projectRoot 路徑的安全性
 * @param raw - 使用者傳入的原始路徑字串
 * @returns 正規化後的安全路徑
 * @throws Error 如果路徑不合法
 */
export function validateProjectRoot(raw: string): string {
  if (!raw || raw.trim().length === 0) {
    throw new Error('專案根目錄路徑不可為空')
  }

  // 正規化路徑（處理多餘的斜線、混合斜線等）
  const normalized = path.normalize(raw)

  // 必須是絕對路徑
  if (!path.isAbsolute(normalized)) {
    throw new Error(`路徑必須為絕對路徑，收到: ${raw}`)
  }

  // 禁止路徑穿越片段
  // 檢查原始輸入與正規化後的路徑，雙重防禦
  if (raw.includes('..') || normalized.includes('..')) {
    throw new Error('路徑不得包含路徑穿越符號 (..)')
  }

  return normalized
}

/**
 * 產生可比較的 projectRoot 身分字串。
 * Windows 路徑大小寫不敏感，需先統一大小寫，避免相同工作區被誤判為衝突。
 */
export function getProjectRootIdentity(raw: string): string {
  const normalized = validateProjectRoot(raw)
  const resolved = path.resolve(normalized)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

/**
 * 比較兩個 projectRoot 是否指向同一個工作區。
 */
export function isSameProjectRoot(left: string, right: string): boolean {
  return getProjectRootIdentity(left) === getProjectRootIdentity(right)
}
