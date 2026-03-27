/**
 * 記憶卡匣外掛系統 — 記憶索引管理器
 * 管理卡匣索引與檔案→卡匣反向映射
 */

import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import type { CartridgeConfig, CartridgeEntry, CartridgeIndex } from './types.js'
import { getSkillsAbsPath } from './config.js'

const INDEX_FILENAME = 'cartridge_index.json'

/**
 * 從記憶卡匣 SKILL.md 解析追蹤檔案清單
 */
function parseTrackedFiles(content: string): string[] {
  const trackedSection = content.match(
    /## Tracked Files\n([\s\S]*?)(?=\n## |\n---|\n$)/,
  )?.[1]
  if (!trackedSection) return []

  return trackedSection
    .split('\n')
    .map(line => line.replace(/^-\s*/, '').trim())
    .filter(line => line.length > 0 && !line.startsWith('（'))
}

/**
 * 記憶索引管理器
 */
export class CartridgeIndexManager {
  private config: CartridgeConfig
  private index: CartridgeIndex

  constructor(config: CartridgeConfig) {
    this.config = config
    this.index = {
      version: 1,
      lastScanned: '',
      cartridges: {},
      fileMap: {},
    }
  }

  /**
   * 掃描所有記憶卡匣並建立索引
   */
  async scan(): Promise<CartridgeIndex> {
    const skillsDir = getSkillsAbsPath(this.config)
    const newCartridges: Record<string, CartridgeEntry> = {}
    const newFileMap: Record<string, string[]> = {}

    if (!fs.existsSync(skillsDir)) {
      this.index = {
        version: 1,
        lastScanned: new Date().toISOString(),
        cartridges: {},
        fileMap: {},
      }
      return this.index
    }

    const entries = fs.readdirSync(skillsDir, { withFileTypes: true })

    for (const entry of entries) {
      // 只處理 mem-* 前綴的記憶卡匣
      if (!entry.isDirectory() || !entry.name.startsWith('mem-')) continue

      const skillPath = path.join(skillsDir, entry.name, 'SKILL.md')
      if (!fs.existsSync(skillPath)) continue

      const raw = fs.readFileSync(skillPath, 'utf-8')
      const { data: frontmatter, content } = matter(raw)

      const trackedFiles = parseTrackedFiles(content)
      const cartridgeId = entry.name

      // 保留既有的 pendingChanges（若有的話）
      const existingEntry = this.index.cartridges[cartridgeId]

      newCartridges[cartridgeId] = {
        skillPath: path.relative(this.config.projectRoot, skillPath),
        trackedFiles,
        staleness: (frontmatter.staleness as number) ?? 0,
        lastUpdated: (frontmatter.last_updated as string) ?? '',
        pendingChanges: existingEntry?.pendingChanges ?? [],
      }

      // 建立反向映射
      for (const file of trackedFiles) {
        if (!newFileMap[file]) newFileMap[file] = []
        if (!newFileMap[file].includes(cartridgeId)) {
          newFileMap[file].push(cartridgeId)
        }
      }
    }

    this.index = {
      version: 1,
      lastScanned: new Date().toISOString(),
      cartridges: newCartridges,
      fileMap: newFileMap,
    }

    return this.index
  }

  /**
   * 取得目前的索引
   */
  getIndex(): CartridgeIndex {
    return this.index
  }

  /**
   * 取得反向映射：檔案→卡匣列表
   */
  getAffectedCartridges(filePath: string): string[] {
    // 嘗試精確匹配與正規化路徑匹配
    const normalized = filePath.replace(/\\/g, '/')
    return this.index.fileMap[normalized]
      ?? this.index.fileMap[filePath]
      ?? []
  }

  /**
   * 取得所有被追蹤的檔案路徑
   */
  getAllTrackedFiles(): string[] {
    return Object.keys(this.index.fileMap)
  }

  /**
   * 更新指定卡匣的過期指數
   */
  updateStaleness(cartridgeId: string, staleness: number): void {
    const entry = this.index.cartridges[cartridgeId]
    if (entry) {
      entry.staleness = staleness
    }
  }

  /**
   * 新增待處理的異動紀錄
   */
  addPendingChange(
    cartridgeId: string,
    filePath: string,
    eventType: 'add' | 'change' | 'unlink',
  ): void {
    const entry = this.index.cartridges[cartridgeId]
    if (!entry) return

    // 去重：同一檔案不重複記錄
    const exists = entry.pendingChanges.some(c => c.filePath === filePath)
    if (exists) return

    entry.pendingChanges.push({
      filePath,
      eventType,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * 清空指定卡匣的待處理異動清單（staleness 重設後呼叫）
   */
  clearPendingChanges(cartridgeId: string): void {
    const entry = this.index.cartridges[cartridgeId]
    if (entry) {
      entry.pendingChanges = []
    }
  }

  /**
   * 持久化索引至 JSON 檔案
   */
  async persist(): Promise<void> {
    const indexPath = path.resolve(this.config.projectRoot, INDEX_FILENAME)
    const content = JSON.stringify(this.index, null, 2)
    fs.writeFileSync(indexPath, content, 'utf-8')
  }

  /**
   * 從 JSON 檔案載入索引
   */
  async load(): Promise<boolean> {
    const indexPath = path.resolve(this.config.projectRoot, INDEX_FILENAME)
    if (!fs.existsSync(indexPath)) return false

    try {
      const raw = fs.readFileSync(indexPath, 'utf-8')
      this.index = JSON.parse(raw) as CartridgeIndex
      return true
    } catch {
      return false
    }
  }
}
