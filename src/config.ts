/**
 * 記憶卡匣外掛系統 — 設定模組
 * 負責解析專案根目錄與預設參數
 */

import path from 'node:path'
import type { CartridgeConfig } from './types.js'

/** 預設排除目錄 */
const DEFAULT_EXCLUDES = [
  'node_modules',
  '.git',
  'dist',
  '.next',
  '.turbo',
  'coverage',
  '.cartridge',
]

/** 預設過期指數設定 */
const DEFAULT_THRESHOLDS = {
  significant: 10,
  critical: 30,
}

/** 系統產物豁免清單（外掛自身產出的檔案，不觸發過期計算） */
const DEFAULT_IGNORE_FILES = [
  '.cartridge/index.json',
]

const DEFAULT_SCORING = {
  fileChanged: 10,
  fileDeleted: 20,
  fileAdded: 5,
  dailyDecay: 1,
}

/**
 * 建立外掛設定
 * @param projectRoot - 專案根目錄的絕對路徑
 * @param overrides - 可選的覆蓋設定
 */
export function createConfig(
  projectRoot: string,
  overrides?: Partial<CartridgeConfig>,
): CartridgeConfig {
  return {
    projectRoot: path.resolve(projectRoot),
    skillsDir: overrides?.skillsDir ?? '.agents/skills',
    memoryDir: overrides?.memoryDir ?? '.agents/memory',
    cartridgeDir: overrides?.cartridgeDir ?? '.cartridge',
    excludeDirs: overrides?.excludeDirs ?? DEFAULT_EXCLUDES,
    ignoreFiles: overrides?.ignoreFiles ?? DEFAULT_IGNORE_FILES,
    thresholds: {
      ...DEFAULT_THRESHOLDS,
      ...overrides?.thresholds,
    },
    scoring: {
      ...DEFAULT_SCORING,
      ...overrides?.scoring,
    },
  }
}

/**
 * 取得操作技能目錄的絕對路徑
 */
export function getSkillsAbsPath(config: CartridgeConfig): string {
  return path.resolve(config.projectRoot, config.skillsDir)
}

/**
 * 取得記憶卡匣目錄的絕對路徑（v4.0 遷移後的新路徑）
 */
export function getMemoryAbsPath(config: CartridgeConfig): string {
  return path.resolve(config.projectRoot, config.memoryDir)
}

/**
 * 取得插件運行時狀態目錄的絕對路徑
 */
export function getCartridgeDirAbsPath(config: CartridgeConfig): string {
  return path.resolve(config.projectRoot, config.cartridgeDir)
}
