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
  parseSections,
  mergeSections,
  normalizeTitle,
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

// ---------------------------------------------------------------------------
// normalizeTitle — 區段標題正規化
// ---------------------------------------------------------------------------
describe('normalizeTitle', () => {
  it('應壓縮空格並轉為小寫', () => {
    expect(normalizeTitle('##  Known  Issues')).toBe('## known issues')
  })

  it('應去除尾部空白', () => {
    expect(normalizeTitle('## Tracked Files   ')).toBe('## tracked files')
  })
})

// ---------------------------------------------------------------------------
// parseSections — Markdown 區段分割
// ---------------------------------------------------------------------------
describe('parseSections', () => {
  it('標準記憶技能結構應正確分割', () => {
    const body = `# Title\n\n> Desc\n\n## Tracked Files\n- f1\n\n## Key Decisions\n- D01\n\n## Known Issues\n- None\n`
    const result = parseSections(body)

    expect(result.preamble).toBe('# Title\n\n> Desc\n\n')
    expect(result.sections).toHaveLength(3)
    expect(result.sections[0].title).toBe('## Tracked Files')
    expect(result.sections[0].content).toContain('- f1')
    expect(result.sections[1].title).toBe('## Key Decisions')
    expect(result.sections[2].title).toBe('## Known Issues')
  })

  it('空內容應回傳空 preamble 和空陣列', () => {
    const result = parseSections('')
    expect(result.preamble).toBe('')
    expect(result.sections).toHaveLength(0)
  })

  it('只有 preamble 無 ## 區段應正確處理', () => {
    const body = '# Just a title\nSome text\n'
    const result = parseSections(body)
    expect(result.preamble).toBe('# Just a title\nSome text\n')
    expect(result.sections).toHaveLength(0)
  })

  it('程式碼區塊內的 ## 不應被切分', () => {
    const body = '## Real Section\ncontent\n```\n## Not A Section\n```\n## Another Real\nmore\n'
    const result = parseSections(body)

    expect(result.sections).toHaveLength(2)
    expect(result.sections[0].title).toBe('## Real Section')
    expect(result.sections[0].content).toContain('## Not A Section')
    expect(result.sections[1].title).toBe('## Another Real')
  })

  it('### 子標題不應被切分', () => {
    const body = '## Section\n### Sub\ncontent\n'
    const result = parseSections(body)

    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].content).toContain('### Sub')
  })

  it('CRLF 行尾應與 LF 產出相同結果', () => {
    const lf = '## A\ncontent\n## B\nmore\n'
    const crlf = '## A\r\ncontent\r\n## B\r\nmore\r\n'
    const lfResult = parseSections(lf)
    const crlfResult = parseSections(crlf)

    expect(crlfResult.sections).toHaveLength(lfResult.sections.length)
    expect(crlfResult.sections[0].title).toBe(lfResult.sections[0].title)
    expect(crlfResult.sections[1].title).toBe(lfResult.sections[1].title)
  })
})

// ---------------------------------------------------------------------------
// mergeSections — 區段合併
// ---------------------------------------------------------------------------
describe('mergeSections', () => {
  const makeSection = (title: string, content: string) => ({
    title,
    normalizedTitle: normalizeTitle(title),
    content,
  })

  it('同名區段應就地替換', () => {
    const original = [makeSection('## A', 'old\n'), makeSection('## B', 'keep\n')]
    const patch = [makeSection('## A', 'new\n')]
    const result = mergeSections(original, patch)

    expect(result.sections[0].content).toBe('new\n')
    expect(result.sections[1].content).toBe('keep\n')
    expect(result.replaced).toBe(1)
    expect(result.added).toBe(0)
  })

  it('新區段應附加到末尾', () => {
    const original = [makeSection('## A', 'a\n')]
    const patch = [makeSection('## B', 'b\n')]
    const result = mergeSections(original, patch)

    expect(result.sections).toHaveLength(2)
    expect(result.sections[1].title).toBe('## B')
    expect(result.added).toBe(1)
  })

  it('混合操作（替換 + 附加）應統計正確', () => {
    const original = [makeSection('## A', 'old\n'), makeSection('## B', 'keep\n')]
    const patch = [makeSection('## A', 'new\n'), makeSection('## C', 'added\n')]
    const result = mergeSections(original, patch)

    expect(result.sections).toHaveLength(3)
    expect(result.replaced).toBe(1)
    expect(result.added).toBe(1)
  })

  it('標題格式微差異應正規化後正確匹配', () => {
    const original = [makeSection('## Known Issues', 'old\n')]
    const patch = [makeSection('##  known  issues', 'new\n')]
    const result = mergeSections(original, patch)

    expect(result.replaced).toBe(1)
    expect(result.sections[0].title).toBe('## Known Issues') // 保持原檔標題
    expect(result.sections[0].content).toBe('new\n')
  })

  it('空內容區段應清空原有內容', () => {
    const original = [makeSection('## Issues', '- bug1\n- bug2\n')]
    const patch = [makeSection('## Issues', '')]
    const result = mergeSections(original, patch)

    expect(result.sections[0].content).toBe('')
    expect(result.replaced).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// handleMemoryUpdate — patch 模式整合測試
// ---------------------------------------------------------------------------
describe('handleMemoryUpdate — patch 模式', () => {
  it('應正確替換目標區段並保留其他區段', async () => {
    const existing = `---\nname: mem-test\nlast_updated: "old"\nstaleness: 5\n---\n\n# Title\n\n## Tracked Files\n- f1\n\n## Key Decisions\n- D01: old\n\n## Known Issues\n- None\n`
    vi.mocked(fs.readFile).mockResolvedValue(existing as unknown as Awaited<ReturnType<typeof fs.readFile>>)

    let writtenContent = ''
    vi.mocked(fs.writeFile).mockImplementation(async (_path, data) => {
      writtenContent = data as string
    })

    const patch = `## Key Decisions\n- D01: old\n- D02: new\n`
    await handleMemoryUpdate({ moduleName: 'mem-test', content: patch, mode: 'patch', projectRoot: PROJECT_ROOT })

    expect(writtenContent).toContain('## Tracked Files')    // 未提及的區段保留
    expect(writtenContent).toContain('- f1')                  // 原始內容保留
    expect(writtenContent).toContain('- D02: new')            // 新內容存在
    expect(writtenContent).toContain('## Known Issues')       // 未提及的區段保留
    expect(writtenContent).not.toContain('staleness: 5')      // frontmatter 已更新
    expect(writtenContent).toContain('+08:00')                // 台灣時區
  })

  it('新區段應附加到檔案末尾', async () => {
    const existing = `---\nname: mem-test\nlast_updated: "old"\nstaleness: 0\n---\n\n## Tracked Files\n- f1\n`
    vi.mocked(fs.readFile).mockResolvedValue(existing as unknown as Awaited<ReturnType<typeof fs.readFile>>)

    let writtenContent = ''
    vi.mocked(fs.writeFile).mockImplementation(async (_path, data) => {
      writtenContent = data as string
    })

    const patch = `## New Section\n- item\n`
    const result = await handleMemoryUpdate({ moduleName: 'mem-test', content: patch, mode: 'patch', projectRoot: PROJECT_ROOT })

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toContain('0 replaced')
    expect(result.content[0].text).toContain('1 added')
    expect(writtenContent).toContain('## Tracked Files')  // 原有保留
    expect(writtenContent).toContain('## New Section')    // 新區段附加
  })

  it('patch 內容無 ## 區段應回傳驗證錯誤', async () => {
    const existing = `---\nname: mem-test\nlast_updated: "old"\nstaleness: 0\n---\n\n## A\ncontent\n`
    vi.mocked(fs.readFile).mockResolvedValue(existing as unknown as Awaited<ReturnType<typeof fs.readFile>>)

    const result = await handleMemoryUpdate({ moduleName: 'mem-test', content: '純文字無標題', mode: 'patch', projectRoot: PROJECT_ROOT })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Patch Error')
  })

  it('目標檔案不存在時應回傳錯誤', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'))

    const result = await handleMemoryUpdate({ moduleName: 'mem-nonexistent', content: '## A\ncontent\n', mode: 'patch', projectRoot: PROJECT_ROOT })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Patch Error')
    expect(result.content[0].text).toContain('基底檔案')
  })
})
