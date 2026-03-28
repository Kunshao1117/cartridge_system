/**
 * 記憶卡匣外掛系統 — 檔案監聽引擎
 * 使用 chokidar 監聽追蹤檔案的異動
 */

import fs from 'node:fs'
import path from 'node:path'
import { watch } from 'chokidar'
import type { FSWatcher } from 'chokidar'
import type { CartridgeConfig, FileEventType } from './types.js'
import type { CartridgeIndexManager } from './index-manager.js'
import type { StalenessAnalyzer } from './analyzer.js'
import { MemoryWriter } from './writer.js'
import matter from 'gray-matter'

/**
 * 檔案監聽引擎
 */
export class CartridgeWatcher {
  private config: CartridgeConfig
  private indexManager: CartridgeIndexManager
  private analyzer: StalenessAnalyzer
  private watcher: FSWatcher | null = null
  private onUpdate?: () => void

  constructor(
    config: CartridgeConfig,
    indexManager: CartridgeIndexManager,
    analyzer: StalenessAnalyzer,
    onUpdate?: () => void,
  ) {
    this.config = config
    this.indexManager = indexManager
    this.analyzer = analyzer
    this.onUpdate = onUpdate
  }

  /**
   * 啟動監聽引擎
   */
  async start(): Promise<void> {
    if (this.watcher) {
      await this.stop()
    }

    const trackedFiles = this.indexManager.getAllTrackedFiles()

    if (trackedFiles.length === 0) {
      console.log('[監聽引擎] 無追蹤檔案，監聽器待命中')
      return
    }

    // 將相對路徑轉為絕對路徑
    const absolutePaths = trackedFiles.map(f =>
      path.resolve(this.config.projectRoot, f),
    )

    this.watcher = watch(absolutePaths, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    })

    // 逐一加入每張記憶卡的 SKILL.md 精確路徑（Windows 不支援 path.resolve + glob）
    const cartridges = Object.values(this.indexManager.getIndex().cartridges)
    for (const cartridge of cartridges) {
      const absPath = path.resolve(this.config.projectRoot, cartridge.skillPath)
      this.watcher.add(absPath)
    }

    this.watcher
      .on('change', (filePath: string) =>
        this.handleEvent(filePath, 'change'),
      )
      .on('add', (filePath: string) => this.handleEvent(filePath, 'add'))
      .on('unlink', (filePath: string) =>
        this.handleEvent(filePath, 'unlink'),
      )

    console.log(
      `[監聽引擎] 已啟動，追蹤 ${trackedFiles.length} 個檔案`,
    )
  }

  /**
   * 停止監聽引擎
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
      console.log('[監聽引擎] 已停止')
    }
  }

  /**
   * 處理檔案異動事件
   */
  private async handleEvent(
    absFilePath: string,
    eventType: FileEventType,
  ): Promise<void> {
    const relPath = path
      .relative(this.config.projectRoot, absFilePath)
      .replace(/\\/g, '/')

    // 系統產物豁免：跳過外掛自身產出的檔案，防止自我監聽迴圈
    if (this.config.ignoreFiles.some(f => relPath.endsWith(f))) {
      return
    }

    // 檢查是否為記憶卡匣本身的變動（AI 重設 staleness）
    if (
      relPath.includes('.agents/skills/mem-') &&
      relPath.endsWith('SKILL.md')
    ) {
      await this.handleSkillFileChange(relPath)
      return
    }

    console.log(`[監聽引擎] 偵測到異動: ${eventType} ${relPath}`)
    await this.analyzer.processFileEvent(relPath, eventType)
    this.onUpdate?.()
  }

  /**
   * 處理記憶卡匣自身的變動（偵測 AI 是否重設了過期指數）
   * 修復：MCP 寫入乾淨 SKILL.md（無警告區塊）時也需觸發快取同步
   */
  private async handleSkillFileChange(relPath: string): Promise<void> {
    const writer = new MemoryWriter(this.config)

    // 先嘗試清除舊警告（有警告 + staleness=0 的情況）
    const cleaned = await writer.checkAndCleanWarning(relPath)

    // 即使沒有舊警告，只要 staleness=0 就視為 AI 已重設，需同步快取
    let needsSync = cleaned
    if (!needsSync) {
      const absPath = path.resolve(this.config.projectRoot, relPath)
      try {
        const raw = fs.readFileSync(absPath, 'utf-8')
        const parsed = matter(raw)
        needsSync = Number(parsed.data.staleness) === 0
      } catch {
        // 讀取失敗則不同步
      }
    }

    if (needsSync) {
      const cartridgeId = relPath.split('/').slice(-2)[0]
      this.indexManager.clearPendingChanges(cartridgeId)
      await this.indexManager.scan()
      console.log(
        `[監聯引擎] 偵測到記憶卡重設，已清除警報: ${relPath}`,
      )
      this.onUpdate?.()
    }
  }
}
