/**
 * 記憶卡匣外掛系統 — 記憶卡寫入器
 * 只維護系統警報與衍生過期欄位，不把警報寫入視為來源複審。
 */

import fs from 'node:fs'
import { assertPathInsideProject } from './file-containment.js'
import { assertMemoryCardPath } from './memory-card-path.js'
import { patchMemorySource, readMemorySource } from './memory-source-patch.js'
import type { CartridgeConfig, StalenessLevel } from './types.js'
import { getStalenessLevel } from './staleness.js'
import { getTaiwanISO } from './timestamp.js'

const WARNING_START = '<!-- CARTRIDGE_SYSTEM_WARNING_START -->'
const WARNING_END = '<!-- CARTRIDGE_SYSTEM_WARNING_END -->'

function generateWarningBlock(
  changedFiles: string[],
  staleness: number,
  level: StalenessLevel,
  timestamp: string,
): string {
  const emoji = level === 'critical' ? '🔴' : '🟠'
  const levelText = level === 'critical' ? '高度待複審' : '顯著待複審'
  const fileList = changedFiles.map(f => `\`${f}\``).join('、')
  return [
    WARNING_START,
    '',
    '> [!CAUTION]',
    `> ${emoji} **來源變動待複審**：stale 不代表卡片內容必然失真。`,
    `> 追蹤檔案異動：${fileList}（${timestamp}）`,
    '> 請比較最新相關來源與卡片；確認前勿把舊卡當作已驗證的 current truth。',
    '> 只有內容或追蹤資訊需調整且已獲授權時才修改；不為消除警告而強制改卡或 commit。',
    '> 有版本與實際比較證據的 no-write 可保留卡片不改，但不會自動清除 stale 或同步索引。',
    `> staleness: ${staleness} | threshold: ${emoji} ${levelText}`,
    '',
    WARNING_END,
  ].join('\n')
}

function warningRange(content: string): { start: number; end: number } | null {
  const start = content.indexOf(WARNING_START)
  const end = content.indexOf(WARNING_END, start)
  if (start === -1 || end === -1) return null
  return { start, end: end + WARNING_END.length }
}

function systemStatusUpdate(data: Record<string, unknown>, staleness: number): Record<string, string> {
  // status may be a user lifecycle state; only system-owned values are derived.
  if (data.status !== undefined && data.status !== 'stable' && data.status !== 'stale') return {}
  return { status: staleness > 0 ? 'stale' : 'stable' }
}

export class MemoryWriter {
  constructor(private config: CartridgeConfig) {}

  private cardPath(relativePath: string): string {
    return assertMemoryCardPath(this.config, relativePath)
  }

  /** Repeated delivery of the same warning must not change bytes or timestamp. */
  async injectWarning(skillRelPath: string, changedFiles: string[], staleness: number): Promise<void> {
    const absPath = this.cardPath(skillRelPath)
    if (!fs.existsSync(absPath)) return
    const raw = fs.readFileSync(assertPathInsideProject(this.config.projectRoot, absPath), 'utf-8')
    const { data, content: body } = readMemorySource(raw)
    const range = warningRange(body)
    const existing = range ? body.slice(range.start, range.end).replace(/\r\n/g, '\n') : ''
    const previousTimestamp = /^> 追蹤檔案異動：.*（([^\n]*)）$/m.exec(existing)?.[1]
    const files = [...new Set(changedFiles)].sort()
    const level = getStalenessLevel(staleness, this.config)
    let block = generateWarningBlock(files, staleness, level, previousTimestamp ?? getTaiwanISO())
    if (existing && existing !== block) block = generateWarningBlock(files, staleness, level, getTaiwanISO())
    const newline = raw.includes('\r\n') ? '\r\n' : '\n'
    if (newline === '\r\n') block = block.replace(/\n/g, newline)
    const newBody = range
      ? body.slice(0, range.start) + block + body.slice(range.end)
      : block + newline + body
    const output = patchMemorySource(raw, { staleness, ...systemStatusUpdate(data, staleness) }, newBody)
    if (output !== raw) fs.writeFileSync(this.cardPath(skillRelPath), output, 'utf-8')
  }

  /** Apply an already reconciled index score, never a no-write review assertion. */
  async syncWarningState(skillRelPath: string, changedFiles: string[], staleness: number): Promise<void> {
    const level = getStalenessLevel(staleness, this.config)
    if (level === 'significant' || level === 'critical') {
      await this.injectWarning(skillRelPath, changedFiles, staleness)
      return
    }
    const absPath = this.cardPath(skillRelPath)
    if (!fs.existsSync(absPath)) return
    const raw = fs.readFileSync(assertPathInsideProject(this.config.projectRoot, absPath), 'utf-8')
    const { data, content: body } = readMemorySource(raw)
    const range = warningRange(body)
    if (!range && staleness <= 0 && (data.staleness === undefined || data.staleness === 0)) return
    const clean = range
      ? body.slice(0, range.start) + body.slice(range.end).replace(/^\r?\n/, '')
      : body
    const output = patchMemorySource(raw, { staleness, ...systemStatusUpdate(data, staleness) }, clean)
    if (output !== raw) fs.writeFileSync(this.cardPath(skillRelPath), output, 'utf-8')
  }

  async removeWarning(skillRelPath: string): Promise<void> {
    const absPath = this.cardPath(skillRelPath)
    if (!fs.existsSync(absPath)) return
    const raw = fs.readFileSync(assertPathInsideProject(this.config.projectRoot, absPath), 'utf-8')
    const { data, content: body } = readMemorySource(raw)
    const range = warningRange(body)
    let clean = body
    if (range) {
      const after = body.slice(range.end).replace(/^\r?\n/, '')
      clean = body.slice(0, range.start) + after
    }
    const updates: Record<string, unknown> = data.staleness === 0 && data.status === 'stale' ? { status: 'stable' } : {}
    const output = patchMemorySource(raw, updates, clean)
    if (output !== raw) fs.writeFileSync(this.cardPath(skillRelPath), output, 'utf-8')
  }

  /** Caller must first establish that pending/ghost review state is resolved. */
  async checkAndCleanWarning(skillRelPath: string): Promise<boolean> {
    const absPath = this.cardPath(skillRelPath)
    if (!fs.existsSync(absPath)) return false
    const raw = fs.readFileSync(assertPathInsideProject(this.config.projectRoot, absPath), 'utf-8')
    const { data, content } = readMemorySource(raw)
    if (warningRange(content) && data.staleness === 0) {
      await this.removeWarning(skillRelPath)
      return true
    }
    return false
  }
}
