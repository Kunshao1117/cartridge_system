/**
 * 記憶卡匣外掛系統 — 基底卡匣注入器
 * 外掛啟動時的「第零步」：偵測、比對、注入基礎技能卡匣
 * v0.9.0：三方比對機制 — 只在真正衝突時詢問
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { CartridgeConfig, InjectionReportItem, InjectionStatus, InjectorState, ConflictPolicy } from './types.js'

/** 內建範本根目錄（相對於此檔案的編譯輸出位置） */
function getTemplatesDir(): string {
  return path.resolve(__dirname, 'templates')
}

/** 注入器狀態檔預設值 */
function defaultInjectorState(): InjectorState {
  return {
    version: 1,
    settings: { conflictPolicy: 'ask' },
    deployedHashes: {},
  }
}

/**
 * 計算檔案的 SHA-256 雜湊值
 */
function hashFile(filePath: string): string {
  const content = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(content).digest('hex')
}

/**
 * 遞迴列出目錄中的所有檔案（相對路徑）
 */
function listFilesRecursive(dir: string, base?: string): string[] {
  const result: string[] = []
  const baseDir = base ?? dir

  if (!fs.existsSync(dir)) return result

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      result.push(...listFilesRecursive(fullPath, baseDir))
    } else {
      result.push(path.relative(baseDir, fullPath))
    }
  }
  return result
}

/**
 * 基底卡匣注入器（v0.9.0 三方比對）
 */
export class CoreInjector {
  private config: CartridgeConfig
  private templatesDir: string
  private report: InjectionReportItem[] = []
  private state: InjectorState
  private stateFilePath: string

  constructor(config: CartridgeConfig) {
    this.config = config
    this.templatesDir = getTemplatesDir()
    this.stateFilePath = path.resolve(config.projectRoot, '.cartridge', 'injector.json')
    this.state = this.loadState()
  }

  /**
   * 載入注入器狀態檔
   */
  private loadState(): InjectorState {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const raw = fs.readFileSync(this.stateFilePath, 'utf-8')
        return JSON.parse(raw) as InjectorState
      }
    } catch { /* 解析失敗則使用預設值 */ }
    return defaultInjectorState()
  }

  /**
   * 儲存注入器狀態檔
   */
  private saveState(): void {
    const dir = path.dirname(this.stateFilePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(this.stateFilePath, JSON.stringify(this.state, null, 2), 'utf-8')
  }

  /**
   * 執行偵測與注入的完整流程
   * @returns 差異報告
   */
  async inject(): Promise<InjectionReportItem[]> {
    this.report = []

    // 確保 .agents 目錄存在
    const agentsDir = path.resolve(this.config.projectRoot, '.agents')
    if (!fs.existsSync(agentsDir)) {
      fs.mkdirSync(agentsDir, { recursive: true })
    }

    // 掃描範本目錄中的所有檔案
    if (!fs.existsSync(this.templatesDir)) {
      console.log('[注入器] 範本目錄不存在，跳過注入')
      return this.report
    }

    const templateFiles = listFilesRecursive(this.templatesDir)

    for (const relPath of templateFiles) {
      const templateAbsPath = path.join(this.templatesDir, relPath)
      const targetAbsPath = path.join(agentsDir, relPath)

      // 安全防護：絕不覆蓋記憶卡匣（相容新舊路徑）
      if (relPath.includes('mem-') || relPath.startsWith('memory\\') || relPath.startsWith('memory/')) {
        continue
      }

      const status = this.detectStatusThreeWay(templateAbsPath, targetAbsPath, relPath)

      this.report.push({
        templatePath: relPath,
        targetPath: targetAbsPath,
        status,
      })

      if (status === 'missing' || status === 'outdated') {
        // 確保目標目錄存在
        const targetDir = path.dirname(targetAbsPath)
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true })
        }
        // 複製範本檔案到目標
        fs.copyFileSync(templateAbsPath, targetAbsPath)
        // 記錄部署的範本雜湊
        this.state.deployedHashes[relPath] = hashFile(templateAbsPath)
      } else if (status === 'match' || status === 'skipped') {
        // match: 範本和目標一致。確保基準快照存在
        // skipped: 範本無更新但使用者有修改。不動作但更新基準（如果缺失）
        if (!this.state.deployedHashes[relPath]) {
          this.state.deployedHashes[relPath] = hashFile(templateAbsPath)
        }
      } else if (status === 'conflict') {
        // 依衝突策略決定
        const resolved = this.resolveConflict(templateAbsPath, targetAbsPath, relPath)
        // 更新報告中的狀態
        this.report[this.report.length - 1].status = resolved
      }
    }

    // 儲存更新後的狀態
    this.saveState()

    return this.report
  }

  /**
   * 三方比對偵測：範本更新 × 使用者修改 的四象限判斷
   */
  private detectStatusThreeWay(
    templatePath: string,
    targetPath: string,
    relPath: string,
  ): InjectionStatus {
    // 目標檔案不存在 → 全新部署
    if (!fs.existsSync(targetPath)) {
      return 'missing'
    }

    const templateHash = hashFile(templatePath)
    const targetHash = hashFile(targetPath)
    const baselineHash = this.state.deployedHashes[relPath]

    // 無基準紀錄（首次安裝升級或狀態檔遺失）→ 回退到簡單比對
    if (!baselineHash) {
      return templateHash === targetHash ? 'match' : 'outdated'
    }

    const templateUpdated = templateHash !== baselineHash
    const userModified = targetHash !== baselineHash

    if (!templateUpdated && !userModified) {
      // 兩邊都沒改 → 靜默跳過
      return 'match'
    }
    if (!templateUpdated && userModified) {
      // 範本無更新 + 使用者有修改 → 尊重客製化
      return 'skipped'
    }
    if (templateUpdated && !userModified) {
      // 範本有更新 + 使用者無修改 → 安全覆蓋
      return 'outdated'
    }
    // 範本有更新 + 使用者有修改 → 衝突
    return 'conflict'
  }

  /**
   * 解決衝突：依據 conflictPolicy 設定決策
   */
  private resolveConflict(
    templatePath: string,
    targetPath: string,
    relPath: string,
  ): InjectionStatus {
    const policy: ConflictPolicy = this.state.settings.conflictPolicy

    if (policy === 'alwaysUpdate') {
      // 強制用範本覆蓋
      const targetDir = path.dirname(targetPath)
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
      }
      fs.copyFileSync(templatePath, targetPath)
      this.state.deployedHashes[relPath] = hashFile(templatePath)
      return 'outdated'
    }

    if (policy === 'alwaysKeepMine') {
      // 保留使用者修改，但更新基準以避免下次再問
      this.state.deployedHashes[relPath] = hashFile(templatePath)
      return 'skipped'
    }

    // policy === 'ask' → 回報衝突狀態，讓上層決定
    return 'conflict'
  }

  /**
   * 取得注入報告
   */
  getReport(): InjectionReportItem[] {
    return this.report
  }

  /**
   * 格式化報告為可讀字串
   */
  formatReport(): string {
    if (this.report.length === 0) return '（無範本檔案需處理）'

    const lines: string[] = ['[基底卡匣注入報告]']
    const grouped = {
      missing: this.report.filter(r => r.status === 'missing'),
      outdated: this.report.filter(r => r.status === 'outdated'),
      match: this.report.filter(r => r.status === 'match'),
      skipped: this.report.filter(r => r.status === 'skipped'),
      conflict: this.report.filter(r => r.status === 'conflict'),
    }

    if (grouped.missing.length > 0) {
      lines.push(`  🆕 注入 ${grouped.missing.length} 個新檔案：`)
      for (const item of grouped.missing) {
        lines.push(`     + ${item.templatePath}`)
      }
    }
    if (grouped.outdated.length > 0) {
      lines.push(`  🔄 更新 ${grouped.outdated.length} 個過時檔案：`)
      for (const item of grouped.outdated) {
        lines.push(`     ~ ${item.templatePath}`)
      }
    }
    if (grouped.skipped.length > 0) {
      lines.push(`  ⏭️ 跳過 ${grouped.skipped.length} 個已客製化檔案`)
    }
    if (grouped.conflict.length > 0) {
      lines.push(`  ⚠️ ${grouped.conflict.length} 個衝突待處理：`)
      for (const item of grouped.conflict) {
        lines.push(`     ! ${item.templatePath}`)
      }
    }
    if (grouped.match.length > 0) {
      lines.push(`  ✅ 跳過 ${grouped.match.length} 個一致檔案`)
    }

    return lines.join('\n')
  }
}
