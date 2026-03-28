/**
 * 記憶卡匣外掛系統 — 記憶卡寫入器
 * 主動物理修改記憶卡匣，植入或移除系統警報
 */

import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import type { CartridgeConfig, StalenessLevel } from './types.js'
import { getStalenessLevel } from './analyzer.js'
import { getTaiwanISO } from './timestamp.js'

/** 警報區塊的標記邊界 */
const WARNING_START = '<!-- CARTRIDGE_SYSTEM_WARNING_START -->'
const WARNING_END = '<!-- CARTRIDGE_SYSTEM_WARNING_END -->'

/**
 * 產生警報 Markdown 區塊
 */
function generateWarningBlock(
  changedFiles: string[],
  staleness: number,
  level: StalenessLevel,
): string {
  const timestamp = getTaiwanISO()
  const emoji = level === 'critical' ? '🔴' : '🟠'
  const levelText = level === 'critical' ? '嚴重過期' : '顯著過期'
  const fileList = changedFiles.map(f => `\`${f}\``).join('、')

  return [
    WARNING_START,
    '',
    `> [!CAUTION]`,
    `> ${emoji} **系統強制攔截**：此記憶已過期失真！`,
    `> 追蹤檔案異動：${fileList}（${timestamp}）`,
    `> AI 嚴禁基於此記憶施工，必須優先閱讀最新原始碼並更新此記憶卡。`,
    `> staleness: ${staleness} | threshold: ${emoji} ${levelText}`,
    '',
    WARNING_END,
    '',
  ].join('\n')
}

/**
 * 記憶卡寫入器
 */
export class MemoryWriter {
  private config: CartridgeConfig

  constructor(config: CartridgeConfig) {
    this.config = config
  }

  /**
   * 在記憶卡中植入警報
   * @param skillRelPath - 相對於專案根目錄的 SKILL.md 路徑
   * @param changedFiles - 已異動的檔案清單
   * @param staleness - 過期指數
   */
  async injectWarning(
    skillRelPath: string,
    changedFiles: string[],
    staleness: number,
  ): Promise<void> {
    const absPath = path.resolve(this.config.projectRoot, skillRelPath)
    if (!fs.existsSync(absPath)) return

    const raw = fs.readFileSync(absPath, 'utf-8')
    const { data: frontmatter, content } = matter(raw)

    // 先移除既有的警報（若有）
    const cleanContent = this.stripWarning(content)

    // 更新 frontmatter
    frontmatter.staleness = staleness
    frontmatter.status = 'stale'

    // 在內文最前方植入警報
    const level = getStalenessLevel(staleness, this.config)
    const warningBlock = generateWarningBlock(changedFiles, staleness, level)
    const newContent = warningBlock + cleanContent

    // 重組檔案
    const output = matter.stringify(newContent, frontmatter)
    fs.writeFileSync(absPath, output, 'utf-8')
  }

  /**
   * 移除記憶卡中的警報
   */
  async removeWarning(skillRelPath: string): Promise<void> {
    const absPath = path.resolve(this.config.projectRoot, skillRelPath)
    if (!fs.existsSync(absPath)) return

    const raw = fs.readFileSync(absPath, 'utf-8')
    const { data: frontmatter, content } = matter(raw)

    const cleanContent = this.stripWarning(content)

    // 如果 frontmatter 中 staleness 已被重設為 0，恢復 status
    if (frontmatter.staleness === 0) {
      frontmatter.status = 'stable'
    }

    const output = matter.stringify(cleanContent, frontmatter)
    fs.writeFileSync(absPath, output, 'utf-8')
  }

  /**
   * 檢查記憶卡是否需要清除警報
   * 當 staleness 被手動重設為 0 且仍有警報時觸發
   */
  async checkAndCleanWarning(skillRelPath: string): Promise<boolean> {
    const absPath = path.resolve(this.config.projectRoot, skillRelPath)
    if (!fs.existsSync(absPath)) return false

    const raw = fs.readFileSync(absPath, 'utf-8')
    const { data: frontmatter, content } = matter(raw)

    const hasWarning = content.includes(WARNING_START)
    const isReset = frontmatter.staleness === 0

    if (hasWarning && isReset) {
      await this.removeWarning(skillRelPath)
      return true
    }

    return false
  }

  /**
   * 移除內文中的警報區塊
   */
  private stripWarning(content: string): string {
    const startIdx = content.indexOf(WARNING_START)
    const endIdx = content.indexOf(WARNING_END)

    if (startIdx === -1 || endIdx === -1) return content

    const before = content.substring(0, startIdx)
    const after = content.substring(endIdx + WARNING_END.length)

    // 清除前後的空行
    return (before + after).replace(/^\n+/, '\n')
  }
}
