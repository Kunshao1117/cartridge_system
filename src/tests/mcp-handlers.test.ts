/**
 * 記憶卡匣外掛系統 — MCP 工具商業邏輯單元測試
 * 使用 vi.mock 模擬 fs/promises，不觸及實際磁碟
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  handleMemoryList,
  handleMemoryRead,
  handleMemoryUpdate,
} from '../mcp-handlers.js'

// 模擬 fs/promises，隔離所有磁碟操作
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}))

import * as fs from 'fs/promises'

const AGENTS_DIR = '/mock/workspace/.agents/skills'

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// handleMemoryList — 列出記憶卡匣
// ---------------------------------------------------------------------------
describe('handleMemoryList', () => {
  it('應正確列出所有 mem-* 目錄', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { isDirectory: () => true, name: 'mem-_system' },
      { isDirectory: () => true, name: 'mem-analyzer' },
      { isDirectory: () => false, name: 'browser-testing' }, // 非記憶卡匣，應被過濾
    ] as unknown as Awaited<ReturnType<typeof fs.readdir>>)

    const result = await handleMemoryList(AGENTS_DIR)

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toContain('mem-_system')
    expect(result.content[0].text).toContain('mem-analyzer')
    expect(result.content[0].text).not.toContain('browser-testing')
  })

  it('目錄不存在時應回傳錯誤', async () => {
    vi.mocked(fs.readdir).mockRejectedValue(new Error('ENOENT: no such file or directory'))

    const result = await handleMemoryList(AGENTS_DIR)

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Error:')
  })
})

// ---------------------------------------------------------------------------
// handleMemoryRead — 讀取記憶卡匣
// ---------------------------------------------------------------------------
describe('handleMemoryRead', () => {
  it('應正確讀取指定卡匣的 SKILL.md 內容', async () => {
    const mockContent = '---\nname: mem-_system\n---\n# System'
    vi.mocked(fs.readFile).mockResolvedValue(mockContent as unknown as Awaited<ReturnType<typeof fs.readFile>>)

    const result = await handleMemoryRead(AGENTS_DIR, { moduleName: 'mem-_system' })

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe(mockContent)
  })

  it('模組不存在時應回傳錯誤', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'))

    const result = await handleMemoryRead(AGENTS_DIR, { moduleName: 'mem-nonexistent' })

    expect(result.isError).toBe(true)
  })

  it('moduleName 為空字串時應回傳 Validation Error', async () => {
    const result = await handleMemoryRead(AGENTS_DIR, { moduleName: '' })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Validation Error')
  })
})

// ---------------------------------------------------------------------------
// handleMemoryUpdate — 更新記憶卡匣
// ---------------------------------------------------------------------------
describe('handleMemoryUpdate', () => {
  it('應正確寫入並回傳成功訊息', async () => {
    vi.mocked(fs.writeFile).mockResolvedValue(undefined)

    const content = `---\nlast_updated: "2026-01-01T00:00:00+08:00"\nstaleness: 5\n---\n# Content`
    const result = await handleMemoryUpdate(AGENTS_DIR, { moduleName: 'mem-_system', content })

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toContain('Successfully updated mem-_system')
  })

  it('應將 staleness 歸零並替換 last_updated', async () => {
    let writtenContent = ''
    vi.mocked(fs.writeFile).mockImplementation(async (_path, data) => {
      writtenContent = data as string
    })

    const content = `---\nlast_updated: "2026-01-01T00:00:00+08:00"\nstaleness: 99\n---\n# Content`
    await handleMemoryUpdate(AGENTS_DIR, { moduleName: 'mem-_system', content })

    expect(writtenContent).toContain('staleness: 0')
    expect(writtenContent).not.toContain('staleness: 99')
    expect(writtenContent).not.toContain('2026-01-01T00:00:00+08:00')
  })

  it('寫入失敗時應回傳錯誤', async () => {
    vi.mocked(fs.writeFile).mockRejectedValue(new Error('EACCES: permission denied'))

    const result = await handleMemoryUpdate(AGENTS_DIR, {
      moduleName: 'mem-_system',
      content: '---\nlast_updated: ""\nstaleness: 0\n---',
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Error:')
  })

  it('content 為空字串時應回傳 Validation Error', async () => {
    const result = await handleMemoryUpdate(AGENTS_DIR, { moduleName: 'mem-_system', content: '' })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Validation Error')
  })
})
