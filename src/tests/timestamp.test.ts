/**
 * 記憶卡匣外掛系統 — 時間戳生成模組單元測試
 */

import { describe, it, expect } from 'vitest'
import { getTaiwanISO } from '../timestamp.js'

describe('getTaiwanISO — 台灣時區時間戳', () => {
  it('輸出應符合 ISO 8601 格式（YYYY-MM-DDTHH:mm:ss+08:00）', () => {
    const result = getTaiwanISO()
    // 完整 ISO 8601 加時區偏移
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/)
  })

  it('輸出應包含 +08:00 後綴', () => {
    const result = getTaiwanISO()
    expect(result).toContain('+08:00')
  })

  it('輸出不應包含 Z 後綴（UTC 標記）', () => {
    const result = getTaiwanISO()
    expect(result).not.toMatch(/Z$/)
  })
})
