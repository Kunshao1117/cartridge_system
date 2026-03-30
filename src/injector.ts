/**
 * 記憶卡匣外掛系統 — 基底卡匣注入器
 * 外掛啟動時的「第零步」：偵測、比對、注入基礎技能卡匣
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { CartridgeConfig, InjectionReportItem, InjectionStatus } from './types.js'

/** 內建範本根目錄（相對於此檔案的編譯輸出位置） */
function getTemplatesDir(): string {
  return path.resolve(__dirname, 'templates')
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
 * 基底卡匣注入器
 */
export class CoreInjector {
  private config: CartridgeConfig
  private templatesDir: string
  private report: InjectionReportItem[] = []

  constructor(config: CartridgeConfig) {
    this.config = config
    this.templatesDir = getTemplatesDir()
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

    // 確保 logs 目錄存在
    const logsDir = path.resolve(agentsDir, 'logs')
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true })
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

      const status = this.detectStatus(templateAbsPath, targetAbsPath)

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
      }
    }

    return this.report
  }

  /**
   * 偵測單一檔案的狀態
   */
  private detectStatus(templatePath: string, targetPath: string): InjectionStatus {
    if (!fs.existsSync(targetPath)) {
      return 'missing'
    }

    const templateHash = hashFile(templatePath)
    const targetHash = hashFile(targetPath)

    return templateHash === targetHash ? 'match' : 'outdated'
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
    if (grouped.match.length > 0) {
      lines.push(`  ✅ 跳過 ${grouped.match.length} 個一致檔案`)
    }

    return lines.join('\n')
  }
}
