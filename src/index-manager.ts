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

/** 巢狀目錄最大掃描深度 */
const MAX_SCAN_DEPTH = 4

/**
 * 從記憶卡匣 SKILL.md 解析追蹤檔案清單
 */
export function parseTrackedFiles(content: string): string[] {
  // 統一行尾為 LF，防止 Windows CRLF 導致正則失配
  const normalized = content.replace(/\r\n/g, '\n')

  const trackedSection = normalized.match(
    /## Tracked Files\n([\s\S]*?)(?=\n## |\n---|\n$)/,
  )?.[1]
  if (!trackedSection) return []

  return trackedSection
    .split('\n')
    .map(line => line
      .replace(/^-\s*/, '')  // 去除行首「- 」
      .replace(/`/g, '')      // 去除 Markdown 反引號
      .replace(/\s.*$/, '')   // 截斷第一個空格後的說明文字
      .trim()
    )
    .filter(line =>
      line.length > 0
      && !line.startsWith('（')
      && !line.startsWith('#')    // 過濾 ### 分組標題
      && !line.startsWith('<')    // 過濾 HTML 標記
      && !line.startsWith('←')   // 過濾行尾備註殘留
    )
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
   * 掃描所有記憶卡匣並建立索引（支援巢狀目錄，最大 4 層）
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

    // 遞迴掃描巢狀目錄
    this.scanRecursive(skillsDir, 1, null, newCartridges, newFileMap)

    this.index = {
      version: 1,
      lastScanned: new Date().toISOString(),
      cartridges: newCartridges,
      fileMap: newFileMap,
    }

    return this.index
  }

  /**
   * 遞迴掃描 mem-* 目錄，從目錄結構推導 depth 和 parent
   */
  private scanRecursive(
    dir: string,
    depth: number,
    parentId: string | null,
    cartridges: Record<string, CartridgeEntry>,
    fileMap: Record<string, string[]>,
  ): void {
    if (depth > MAX_SCAN_DEPTH) return

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith('mem-')) continue

      const skillPath = path.join(dir, entry.name, 'SKILL.md')
      if (!fs.existsSync(skillPath)) continue

      const raw = fs.readFileSync(skillPath, 'utf-8')
      const { data: frontmatter, content } = matter(raw)

      const trackedFiles = parseTrackedFiles(content)
      const cartridgeId = entry.name

      // 保留既有的 pendingChanges（若有的話）
      const existingEntry = this.index.cartridges[cartridgeId]

      cartridges[cartridgeId] = {
        skillPath: path.relative(this.config.projectRoot, skillPath),
        trackedFiles,
        staleness: (frontmatter.staleness as number) ?? 0,
        lastUpdated: (frontmatter.last_updated as string) ?? '',
        pendingChanges: existingEntry?.pendingChanges ?? [],
        depth,
        parent: parentId,
        scopePath: (frontmatter.scopePath as string) ?? undefined,
      }

      // 建立反向映射
      for (const file of trackedFiles) {
        if (!fileMap[file]) fileMap[file] = []
        if (!fileMap[file].includes(cartridgeId)) {
          fileMap[file].push(cartridgeId)
        }
      }

      // 遞迴掃描子目錄
      this.scanRecursive(
        path.join(dir, entry.name),
        depth + 1,
        cartridgeId,
        cartridges,
        fileMap,
      )
    }
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
   * 透過最長前綴匹配，找出檔案路徑最匹配的記憶卡
   * 用於新增檔案時自動判斷歸屬
   */
  findOwner(filePath: string): string | null {
    const normalized = filePath.replace(/\\/g, '/')
    let bestMatch: string | null = null
    let bestLength = 0
    for (const [id, entry] of Object.entries(this.index.cartridges)) {
      if (
        entry.scopePath
        && normalized.startsWith(entry.scopePath)
        && entry.scopePath.length > bestLength
      ) {
        bestMatch = id
        bestLength = entry.scopePath.length
      }
    }
    return bestMatch
  }

  /**
   * 取得指定記憶卡的子卡清單
   */
  getChildren(cartridgeId: string): string[] {
    return Object.entries(this.index.cartridges)
      .filter(([, entry]) => entry.parent === cartridgeId)
      .map(([id]) => id)
  }

  /**
   * 將模組名稱解析為實際 SKILL.md 檔案路徑
   */
  resolveModulePath(moduleName: string): string | null {
    const entry = this.index.cartridges[moduleName]
    if (entry) return path.resolve(this.config.projectRoot, entry.skillPath)
    return null
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
   * 啟動時偵測停機期間遺漏的檔案變動
   * 比對每個追蹤檔案的修改時間（mtime）與記憶卡的 lastUpdated，
   * 若檔案比記憶卡還新，則補記 pendingChange 並更新 staleness
   */
  detectMissedChanges(scoring: CartridgeConfig['scoring']): void {
    for (const [cartridgeId, entry] of Object.entries(this.index.cartridges)) {
      if (!entry.lastUpdated || entry.trackedFiles.length === 0) continue

      const lastUpdatedMs = new Date(entry.lastUpdated).getTime()
      if (isNaN(lastUpdatedMs)) continue

      for (const trackedFile of entry.trackedFiles) {
        // 跳過目錄型追蹤（如 src/templates/）
        if (trackedFile.endsWith('/')) continue

        const absPath = path.resolve(this.config.projectRoot, trackedFile)
        try {
          const stat = fs.statSync(absPath)
          if (stat.mtimeMs > lastUpdatedMs) {
            this.addPendingChange(cartridgeId, trackedFile, 'change')
          }
        } catch {
          // 檔案不存在 — 可能已刪除
        }
      }

      // 重新計算 staleness
      if (entry.pendingChanges.length > 0) {
        let score = 0
        for (const change of entry.pendingChanges) {
          switch (change.eventType) {
            case 'change': score += scoring.fileChanged; break
            case 'unlink': score += scoring.fileDeleted; break
            case 'add':    score += scoring.fileAdded;   break
          }
        }
        entry.staleness = score
      }
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

