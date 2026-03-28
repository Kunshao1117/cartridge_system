/**
 * 記憶卡匣外掛系統 — 記憶卡寫入器單元測試
 * 使用 vi.mock('node:fs') 模擬同步磁碟操作
 * gray-matter 讓它真實執行（純字串解析，不觸碰磁碟）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryWriter } from '../writer.js'
import { createConfig } from '../config.js'

// 模擬同步 fs API（writer.ts 使用同步操作，非 fs/promises）
vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}))

import fs from 'node:fs'

const WARNING_START = '<!-- CARTRIDGE_SYSTEM_WARNING_START -->'
const WARNING_END = '<!-- CARTRIDGE_SYSTEM_WARNING_END -->'

// 建立一個含有警報的假 SKILL.md 原始內容
function makeRawWithWarning(staleness = 5): string {
  return [
    '---',
    `staleness: ${staleness}`,
    'status: stale',
    '---',
    '',
    WARNING_START,
    '',
    '> [!CAUTION]',
    '> 🟠 **系統強制攔截**：此記憶已過期失真！',
    '',
    WARNING_END,
    '',
    '# Content',
    '',
  ].join('\n')
}

// 建立一個乾淨（無警報）的假 SKILL.md 原始內容
function makeRawClean(staleness = 0): string {
  return [
    '---',
    `staleness: ${staleness}`,
    'status: stable',
    '---',
    '',
    '# Content',
    '',
  ].join('\n')
}

const config = createConfig('d:/cartridge_system')
const SKILL_PATH = '.agents/skills/mem-test/SKILL.md'

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// injectWarning — 警報植入
// ---------------------------------------------------------------------------
describe('MemoryWriter.injectWarning — 警報植入', () => {
  it('檔案不存在時應提前返回，不呼叫 writeFileSync', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    const writer = new MemoryWriter(config)
    await writer.injectWarning(SKILL_PATH, ['src/test.ts'], 10)

    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  it('正常流程應呼叫 writeFileSync，且輸出包含警報標記', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(makeRawClean(0) as unknown as Buffer)

    const writer = new MemoryWriter(config)
    await writer.injectWarning(SKILL_PATH, ['src/test.ts'], 10)

    expect(fs.writeFileSync).toHaveBeenCalledOnce()
    const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string
    expect(written).toContain(WARNING_START)
    expect(written).toContain(WARNING_END)
    expect(written).toContain('staleness: 10')
    expect(written).toContain('status: stale')
  })

  it('已有警報時應先清除再植入（idempotent 保證），不重複堆疊', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(makeRawWithWarning(5) as unknown as Buffer)

    const writer = new MemoryWriter(config)
    await writer.injectWarning(SKILL_PATH, ['src/test.ts'], 20)

    expect(fs.writeFileSync).toHaveBeenCalledOnce()
    const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string
    // 確認只有一個警報區塊
    const startCount = (written.match(new RegExp(WARNING_START, 'g')) ?? []).length
    expect(startCount).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// removeWarning — 警報移除
// ---------------------------------------------------------------------------
describe('MemoryWriter.removeWarning — 警報移除', () => {
  it('檔案不存在時應提前返回，不呼叫 writeFileSync', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    const writer = new MemoryWriter(config)
    await writer.removeWarning(SKILL_PATH)

    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  it('staleness = 0 時 status 應改為 stable，並移除警報區塊', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(makeRawWithWarning(0) as unknown as Buffer)

    const writer = new MemoryWriter(config)
    await writer.removeWarning(SKILL_PATH)

    expect(fs.writeFileSync).toHaveBeenCalledOnce()
    const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string
    expect(written).not.toContain(WARNING_START)
    expect(written).toContain('status: stable')
  })

  it('移除後檔案內容應不含警報區塊標記', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(makeRawWithWarning(5) as unknown as Buffer)

    const writer = new MemoryWriter(config)
    await writer.removeWarning(SKILL_PATH)

    const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string
    expect(written).not.toContain(WARNING_START)
    expect(written).not.toContain(WARNING_END)
  })
})

// ---------------------------------------------------------------------------
// checkAndCleanWarning — 條件式清除
// ---------------------------------------------------------------------------
describe('MemoryWriter.checkAndCleanWarning — 條件式清除', () => {
  it('檔案不存在時應回傳 false', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    const writer = new MemoryWriter(config)
    const result = await writer.checkAndCleanWarning(SKILL_PATH)

    expect(result).toBe(false)
  })

  it('有警報但 staleness ≠ 0 時不應清除，回傳 false', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(makeRawWithWarning(10) as unknown as Buffer)

    const writer = new MemoryWriter(config)
    const result = await writer.checkAndCleanWarning(SKILL_PATH)

    expect(result).toBe(false)
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  it('有警報且 staleness = 0 時應清除並回傳 true', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    // 第一次 read（checkAndCleanWarning 內）回傳含警報 + staleness=0 的內容
    // 第二次 read（removeWarning 內）也需要回傳同份內容
    vi.mocked(fs.readFileSync).mockReturnValue(makeRawWithWarning(0) as unknown as Buffer)

    const writer = new MemoryWriter(config)
    const result = await writer.checkAndCleanWarning(SKILL_PATH)

    expect(result).toBe(true)
    expect(fs.writeFileSync).toHaveBeenCalledOnce()
  })
})
