/**
 * 記憶卡匣外掛系統 — MCP 工具商業邏輯單元測試
 * 使用 vi.mock 模擬 fs/promises，不觸及實際磁碟
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  handleMemoryList,
  handleMemoryRead,
  handleMemoryUpdate,
  updateFrontmatterFields,
} from '../mcp-handlers.js'

// 模擬 fs/promises，隔離所有磁碟操作
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}))

import * as fs from 'fs/promises'

const PROJECT_ROOT = '/mock/other-project'

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// handleMemoryList — 列出記憶卡匣
// ---------------------------------------------------------------------------
describe('handleMemoryList', () => {
  it('應正確列出指定專案的所有 mem-* 目錄', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { isDirectory: () => true, name: 'mem-_system' },
      { isDirectory: () => true, name: 'mem-analyzer' },
      { isDirectory: () => false, name: 'browser-testing' }, // 非記憶卡匣，應被過濾
    ] as unknown as Awaited<ReturnType<typeof fs.readdir>>)

    const result = await handleMemoryList({ projectRoot: PROJECT_ROOT })

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toContain('mem-_system')
    expect(result.content[0].text).toContain('mem-analyzer')
    expect(result.content[0].text).not.toContain('browser-testing')
  })

  it('應使用 projectRoot 組合正確的掃描路徑', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([] as unknown as Awaited<ReturnType<typeof fs.readdir>>)

    await handleMemoryList({ projectRoot: PROJECT_ROOT })

    const calledPath = vi.mocked(fs.readdir).mock.calls[0][0] as string
    expect(calledPath).toContain('other-project')
    expect(calledPath).toContain('.agents')
    expect(calledPath).toContain('skills')
  })

  it('未傳入 projectRoot 時應回傳 Validation Error', async () => {
    const result = await handleMemoryList({})

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Validation Error')
  })

  it('目錄不存在時應回傳錯誤', async () => {
    vi.mocked(fs.readdir).mockRejectedValue(new Error('ENOENT: no such file or directory'))

    const result = await handleMemoryList({ projectRoot: PROJECT_ROOT })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Error:')
  })

  it('相對路徑應回傳 Validation Error（路徑安全防禦）', async () => {
    const result = await handleMemoryList({ projectRoot: './relative/path' })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Validation Error')
  })

  it('路徑穿越（..）應回傳 Validation Error', async () => {
    const result = await handleMemoryList({ projectRoot: '/foo/../../etc' })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Validation Error')
  })
})

// ---------------------------------------------------------------------------
// handleMemoryRead — 讀取記憶卡匣
// ---------------------------------------------------------------------------
describe('handleMemoryRead', () => {
  it('應正確讀取指定專案中卡匣的 SKILL.md 內容', async () => {
    const mockContent = '---\nname: mem-_system\n---\n# System'
    vi.mocked(fs.readFile).mockResolvedValue(mockContent as unknown as Awaited<ReturnType<typeof fs.readFile>>)

    const result = await handleMemoryRead({ moduleName: 'mem-_system', projectRoot: PROJECT_ROOT })

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toBe(mockContent)
  })

  it('應使用 projectRoot 組合正確的讀取路徑', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('' as unknown as Awaited<ReturnType<typeof fs.readFile>>)

    await handleMemoryRead({ moduleName: 'mem-_system', projectRoot: PROJECT_ROOT })

    const calledPath = vi.mocked(fs.readFile).mock.calls[0][0] as string
    expect(calledPath).toContain('other-project')
    expect(calledPath).toContain('mem-_system')
    expect(calledPath).toContain('SKILL.md')
  })

  it('未傳入 projectRoot 時應回傳 Validation Error', async () => {
    const result = await handleMemoryRead({ moduleName: 'mem-_system' })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Validation Error')
  })

  it('模組不存在時應回傳錯誤', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'))

    const result = await handleMemoryRead({ moduleName: 'mem-nonexistent', projectRoot: PROJECT_ROOT })

    expect(result.isError).toBe(true)
  })

  it('moduleName 為空字串時應回傳 Validation Error', async () => {
    const result = await handleMemoryRead({ moduleName: '', projectRoot: PROJECT_ROOT })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Validation Error')
  })

  it('路徑穿越（..）應回傳 Validation Error', async () => {
    const result = await handleMemoryRead({ moduleName: 'mem-_system', projectRoot: '/foo/../../../etc' })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Validation Error')
  })
})

// ---------------------------------------------------------------------------
// handleMemoryUpdate — 更新記憶卡匣
// ---------------------------------------------------------------------------
describe('handleMemoryUpdate', () => {
  it('應正確寫入並回傳成功訊息（replace 模式）', async () => {
    vi.mocked(fs.writeFile).mockResolvedValue(undefined)

    const content = `---\nlast_updated: "2026-01-01T00:00:00+08:00"\nstaleness: 5\n---\n# Content`
    const result = await handleMemoryUpdate({ moduleName: 'mem-_system', content, projectRoot: PROJECT_ROOT })

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toContain('Successfully updated mem-_system')
  })

  it('應使用 projectRoot 組合正確的寫入路徑', async () => {
    vi.mocked(fs.writeFile).mockResolvedValue(undefined)

    const content = `---\nlast_updated: "2026-01-01T00:00:00+08:00"\nstaleness: 0\n---`
    await handleMemoryUpdate({ moduleName: 'mem-_system', content, projectRoot: PROJECT_ROOT })

    const calledPath = vi.mocked(fs.writeFile).mock.calls[0][0] as string
    expect(calledPath).toContain('other-project')
    expect(calledPath).toContain('mem-_system')
  })

  it('未傳入 projectRoot 時應回傳 Validation Error', async () => {
    const content = `---\nlast_updated: ""\nstaleness: 0\n---`
    const result = await handleMemoryUpdate({ moduleName: 'mem-_system', content })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Validation Error')
  })

  it('應將 staleness 歸零並替換 last_updated', async () => {
    let writtenContent = ''
    vi.mocked(fs.writeFile).mockImplementation(async (_path, data) => {
      writtenContent = data as string
    })

    // replace 模式（預設）：直接用 content 替換
    const content = `---\nlast_updated: "2026-01-01T00:00:00+08:00"\nstaleness: 99\n---\n# Content`
    await handleMemoryUpdate({ moduleName: 'mem-_system', content, projectRoot: PROJECT_ROOT })

    expect(writtenContent).toContain('staleness: 0')
    expect(writtenContent).not.toContain('staleness: 99')
    expect(writtenContent).not.toContain('2026-01-01T00:00:00+08:00')
  })

  it('寫入失敗時應回傳錯誤', async () => {
    vi.mocked(fs.writeFile).mockRejectedValue(new Error('EACCES: permission denied'))

    const result = await handleMemoryUpdate({
      moduleName: 'mem-_system',
      content: '---\nlast_updated: ""\nstaleness: 0\n---',
      projectRoot: PROJECT_ROOT,
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Error:')
  })

  it('content 為空字串時應回傳 Validation Error', async () => {
    const result = await handleMemoryUpdate({ moduleName: 'mem-_system', content: '', projectRoot: PROJECT_ROOT })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Validation Error')
  })

  it('路徑穿越（..）應回傳 Validation Error', async () => {
    const content = `---\nlast_updated: ""\nstaleness: 0\n---`
    const result = await handleMemoryUpdate({ moduleName: 'mem-_system', content, projectRoot: '/foo/../../etc' })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Validation Error')
  })

  // [D13] mode 參數測試
  it('[D13] append 模式應先讀現有 SKILL.md 再附加 content', async () => {
    const existingContent = `---\nname: mem-test\nlast_updated: "old"\nstaleness: 5\n---\n\n## Tracked Files\n- src/foo.ts`
    vi.mocked(fs.readFile).mockResolvedValue(existingContent as unknown as Awaited<ReturnType<typeof fs.readFile>>)

    let writtenContent = ''
    vi.mocked(fs.writeFile).mockImplementation(async (_path, data) => {
      writtenContent = data as string
    })

    const patch = `## Known Issues\n- D12: 測試新增的問題`
    await handleMemoryUpdate({ moduleName: 'mem-test', content: patch, mode: 'append', projectRoot: PROJECT_ROOT })

    expect(writtenContent).toContain('## Tracked Files')    // 原始內容保留
    expect(writtenContent).toContain('## Known Issues')      // 新增內容存在
    expect(writtenContent).toContain('D12: 測試新增的問題') // 差分片段存在
    expect(writtenContent).not.toContain('staleness: 5')     // frontmatter 已歸零
  })

  it('[D13] append 模式檔案不存在（首次建立）時應以 content 為起點寫入', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT: no such file'))

    let writtenContent = ''
    vi.mocked(fs.writeFile).mockImplementation(async (_path, data) => {
      writtenContent = data as string
    })

    const initialContent = `---\nname: mem-new\nlast_updated: ""\nstaleness: 0\n---\n# New Module`
    const result = await handleMemoryUpdate({ moduleName: 'mem-new', content: initialContent, mode: 'append', projectRoot: PROJECT_ROOT })

    expect(result.isError).toBeUndefined()
    expect(writtenContent).toContain('# New Module')
  })

  it('[D13] append 模式讀取成功但寫入失敗時應回傳錯誤', async () => {
    const existingContent = `---\nlast_updated: "old"\nstaleness: 0\n---\n# Content`
    vi.mocked(fs.readFile).mockResolvedValue(existingContent as unknown as Awaited<ReturnType<typeof fs.readFile>>)
    vi.mocked(fs.writeFile).mockRejectedValue(new Error('EACCES: permission denied'))

    const result = await handleMemoryUpdate({
      moduleName: 'mem-_system',
      content: '額外附加段落',
      mode: 'append',
      projectRoot: PROJECT_ROOT,
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Error:')
  })

  it('時間戳應包含 +08:00 後綴', async () => {
    let writtenContent = ''
    vi.mocked(fs.writeFile).mockImplementation(async (_path, data) => {
      writtenContent = data as string
    })

    const content = `---\nlast_updated: "old"\nstaleness: 5\n---\n# Content`
    await handleMemoryUpdate({ moduleName: 'mem-_system', content, projectRoot: PROJECT_ROOT })

    expect(writtenContent).toContain('+08:00')
    expect(writtenContent).not.toMatch(/last_updated:.*Z/)
  })
})

// ---------------------------------------------------------------------------
// updateFrontmatterFields — 結構化 frontmatter 更新
// ---------------------------------------------------------------------------
describe('updateFrontmatterFields — frontmatter 結構化更新', () => {
  it('雙引號 frontmatter 應正確更新', () => {
    const input = `---\nlast_updated: "2026-01-01T00:00:00+08:00"\nstaleness: 5\n---\n# Content`
    const result = updateFrontmatterFields(input, { last_updated: 'new-ts', staleness: 0 })

    expect(result).toContain('last_updated: new-ts')
    expect(result).toContain('staleness: 0')
    expect(result).toContain('# Content')
  })

  it('單引號 frontmatter 應正確更新', () => {
    const input = `---\nlast_updated: '2026-01-01T00:00:00+08:00'\nstaleness: 5\n---\n# Content`
    const result = updateFrontmatterFields(input, { last_updated: 'new-ts', staleness: 0 })

    expect(result).toContain('last_updated: new-ts')
    expect(result).toContain('staleness: 0')
  })

  it('無引號 frontmatter 應正確更新', () => {
    const input = `---\nlast_updated: 2026-01-01T00:00:00+08:00\nstaleness: 5\n---\n# Content`
    const result = updateFrontmatterFields(input, { last_updated: 'new-ts', staleness: 0 })

    expect(result).toContain('staleness: 0')
    expect(result).toContain('# Content')
  })

  it('不影響其他 frontmatter 欄位', () => {
    const input = `---\nname: mem-test\nlast_updated: "old"\nstaleness: 5\nstatus: stale\n---\n# Content`
    const result = updateFrontmatterFields(input, { staleness: 0 })

    expect(result).toContain('name: mem-test')
    expect(result).toContain('status: stale')
    expect(result).toContain('staleness: 0')
  })
})
