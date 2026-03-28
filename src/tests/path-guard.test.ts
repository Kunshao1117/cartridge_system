/**
 * 記憶卡匣外掛系統 — 路徑安全驗證模組單元測試
 */

import { describe, it, expect } from 'vitest'
import { validateProjectRoot } from '../path-guard.js'

describe('validateProjectRoot — 路徑安全驗證', () => {
  // ---- 合法路徑 ----
  it('Windows 絕對路徑（磁碟代號）應通過驗證', () => {
    const result = validateProjectRoot('D:\\cartridge_system')
    expect(result).toBeTruthy()
  })

  it('Windows 絕對路徑（正斜線）應通過驗證', () => {
    const result = validateProjectRoot('D:/cartridge_system')
    expect(result).toBeTruthy()
  })

  it('Unix 絕對路徑應通過驗證', () => {
    const result = validateProjectRoot('/home/user/project')
    expect(result).toBeTruthy()
  })

  // ---- 非法路徑 ----
  it('相對路徑應拋出錯誤', () => {
    expect(() => validateProjectRoot('./foo')).toThrow('絕對路徑')
  })

  it('純檔名應拋出錯誤', () => {
    expect(() => validateProjectRoot('project')).toThrow('絕對路徑')
  })

  it('包含 .. 的路徑穿越應拋出錯誤', () => {
    expect(() => validateProjectRoot('D:\\foo\\..\\..\\etc')).toThrow('路徑穿越')
  })

  it('空字串應拋出錯誤', () => {
    expect(() => validateProjectRoot('')).toThrow('不可為空')
  })

  it('純空白應拋出錯誤', () => {
    expect(() => validateProjectRoot('   ')).toThrow('不可為空')
  })
})
