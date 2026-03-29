/**
 * 記憶卡匣外掛系統 — MCP 工具商業邏輯單元測試
 * 使用 vi.mock 模擬 fs/promises，不觸及實際磁碟
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  handleMemoryList,
  handleMemoryRead,
  handleMemoryUpdate,
  handleMemoryStatus,
  stalenessToLevel,
  updateFrontmatterFields,
  parseSections,
  parseSubSections,
  mergeSections,
  normalizeTitle,
} from '../mcp-handlers.js'

// 模擬 fs/promises，隔離所有磁碟操作
vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
}))

import * as fs from 'fs/promises'

const PROJECT_ROOT = '/mock/other-project'

beforeEach(() => {
  vi.clearAllMocks()
  // resolveSkillPath 會呼叫 fs.access 驗證路徑存在，預設為成功（平面路徑回退）
  vi.mocked(fs.access).mockResolvedValue(undefined)
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

    // resolveSkillPath 先讀索引、再由 handler 讀 SKILL.md，取最後一次包含模組名的呼叫
    const calls = vi.mocked(fs.readFile).mock.calls
    const skillReadCall = calls.find(c => (c[0] as string).includes('mem-_system'))
    expect(skillReadCall).toBeDefined()
    expect(skillReadCall![0] as string).toContain('other-project')
    expect(skillReadCall![0] as string).toContain('SKILL.md')
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
    subSections: [],
  })

  it('同名區段應就地替換', () => {
    const original = [makeSection('## A', 'old\n'), makeSection('## B', 'keep\n')]
    const patch = [makeSection('## A', 'new\n')]
    const result = mergeSections(original, patch)

    expect(result.sections[0].content).toBe('new\n')
    expect(result.sections[1].content).toBe('keep\n')
    expect(result.replaced).toEqual(['## A'])
    expect(result.added).toEqual([])
  })

  it('新區段應附加到末尾', () => {
    const original = [makeSection('## A', 'a\n')]
    const patch = [makeSection('## B', 'b\n')]
    const result = mergeSections(original, patch)

    expect(result.sections).toHaveLength(2)
    expect(result.sections[1].title).toBe('## B')
    expect(result.added).toEqual(['## B'])
  })

  it('混合操作（替換 + 附加）應統計正確', () => {
    const original = [makeSection('## A', 'old\n'), makeSection('## B', 'keep\n')]
    const patch = [makeSection('## A', 'new\n'), makeSection('## C', 'added\n')]
    const result = mergeSections(original, patch)

    expect(result.sections).toHaveLength(3)
    expect(result.replaced).toEqual(['## A'])
    expect(result.added).toEqual(['## C'])
  })

  it('標題格式微差異應正規化後正確匹配', () => {
    const original = [makeSection('## Known Issues', 'old\n')]
    const patch = [makeSection('##  known  issues', 'new\n')]
    const result = mergeSections(original, patch)

    expect(result.replaced).toEqual(['## Known Issues'])
    expect(result.sections[0].title).toBe('## Known Issues') // 保持原檔標題
    expect(result.sections[0].content).toBe('new\n')
  })

  it('空內容區段應清空原有內容', () => {
    const original = [makeSection('## Issues', '- bug1\n- bug2\n')]
    const patch = [makeSection('## Issues', '')]
    const result = mergeSections(original, patch)

    expect(result.sections[0].content).toBe('')
    expect(result.replaced).toEqual(['## Issues'])
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
    const result = await handleMemoryUpdate({ moduleName: 'mem-test', content: patch, mode: 'patch', projectRoot: PROJECT_ROOT })

    expect(writtenContent).toContain('## Tracked Files')    // 未提及的區段保留
    expect(writtenContent).toContain('- f1')                  // 原始內容保留
    expect(writtenContent).toContain('- D02: new')            // 新內容存在
    expect(writtenContent).toContain('## Known Issues')       // 未提及的區段保留
    expect(writtenContent).not.toContain('staleness: 5')      // frontmatter 已更新
    expect(writtenContent).toContain('+08:00')                // 台灣時區

    // 驗證結構化 JSON 回傳
    const report = JSON.parse(result.content[0].text)
    expect(report.status).toBe('success')
    expect(report.replaced).toContain('## Key Decisions')
    expect(report.preserved).toContain('## Tracked Files')
    expect(report.preserved).toContain('## Known Issues')
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
    const report = JSON.parse(result.content[0].text)
    expect(report.replaced).toEqual([])
    expect(report.added).toContain('## New Section')
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

// ---------------------------------------------------------------------------
// parseSubSections — 子區段解析
// ---------------------------------------------------------------------------
describe('parseSubSections', () => {
  it('應正確解析 ### 子區段', () => {
    const content = '### Backend\n- Next.js\n\n### Frontend\n- React\n'
    const result = parseSubSections(content)

    expect(result.leading).toBe('')
    expect(result.subSections).toHaveLength(2)
    expect(result.subSections[0].title).toBe('### Backend')
    expect(result.subSections[0].content).toContain('Next.js')
    expect(result.subSections[1].title).toBe('### Frontend')
  })

  it('無 ### 時應回傳空陣列和完整 leading', () => {
    const content = '- item1\n- item2\n'
    const result = parseSubSections(content)

    expect(result.leading).toBe(content)
    expect(result.subSections).toHaveLength(0)
  })

  it('程式碼區塊內的 ### 不應被切分', () => {
    const content = '```\n### Not A SubSection\n```\n### Real Sub\ncontent\n'
    const result = parseSubSections(content)

    expect(result.subSections).toHaveLength(1)
    expect(result.subSections[0].title).toBe('### Real Sub')
  })

  it('leading 文字應被正確保留', () => {
    const content = 'Some intro text\n\n### Sub1\ncontent\n'
    const result = parseSubSections(content)

    expect(result.leading).toBe('Some intro text\n\n')
    expect(result.subSections).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// mergeSections — 子區段級合併
// ---------------------------------------------------------------------------
describe('mergeSections — 子區段級合併', () => {
  const makeSection = (title: string, content: string) => {
    const { subSections } = parseSubSections(content)
    return {
      title,
      normalizedTitle: normalizeTitle(title),
      content,
      subSections,
    }
  }

  it('只提供部分 ### 時應保留未提及的 ### 子區段', () => {
    const original = [
      makeSection('## Tech Stack', '### Backend\n- Next.js\n\n### Dashboard UI\n- Vite\n\n### Infrastructure\n- Cloudflare\n'),
    ]
    const patch = [
      makeSection('## Tech Stack', '### Backend\n- Next.js 15\n'),
    ]
    const result = mergeSections(original, patch)

    // Backend 應被替換
    expect(result.replaced).toEqual(['## Tech Stack > ### Backend'])
    // Dashboard UI 和 Infrastructure 應被保留
    expect(result.sections[0].content).toContain('### Dashboard UI')
    expect(result.sections[0].content).toContain('### Infrastructure')
    expect(result.sections[0].content).toContain('Next.js 15')
    expect(result.sections[0].content).not.toContain('- Next.js\n')
    // 不應有任何移除記錄
    expect(result.removed).toEqual([])
  })

  it('新的 ### 子區段應附加到同個 ## 區段末尾', () => {
    const original = [
      makeSection('## Tech Stack', '### Backend\n- Next.js\n'),
    ]
    const patch = [
      makeSection('## Tech Stack', '### New Sub\n- new content\n'),
    ]
    const result = mergeSections(original, patch)

    expect(result.added).toEqual(['## Tech Stack > ### New Sub'])
    expect(result.sections[0].content).toContain('### Backend')
    expect(result.sections[0].content).toContain('### New Sub')
  })

  it('無 ### 的 patch 替換含 ### 的原始區段時應產生警告', () => {
    const original = [
      makeSection('## Tech Stack', '### Backend\n- old\n\n### Frontend\n- old\n'),
    ]
    const patch = [
      makeSection('## Tech Stack', '- plain text replacement\n'),
    ]
    const result = mergeSections(original, patch)

    expect(result.replaced).toEqual(['## Tech Stack'])
    expect(result.removed).toHaveLength(2)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('2 個子區段')
  })
})

// ---------------------------------------------------------------------------
// handleMemoryUpdate — dryRun 閘門機制
// ---------------------------------------------------------------------------
describe('handleMemoryUpdate — dryRun 閘門', () => {
  it('dryRun: true 應不寫入磁碟', async () => {
    const existing = `---\nname: mem-test\nlast_updated: "old"\nstaleness: 0\n---\n\n## A\nold content\n`
    vi.mocked(fs.readFile).mockResolvedValue(existing as unknown as Awaited<ReturnType<typeof fs.readFile>>)

    const result = await handleMemoryUpdate({
      moduleName: 'mem-test',
      content: '## A\nnew content\n',
      mode: 'patch',
      dryRun: true,
      projectRoot: PROJECT_ROOT,
    })

    expect(result.isError).toBeUndefined()
    expect(vi.mocked(fs.writeFile)).not.toHaveBeenCalled()
  })

  it('dryRun: true 應回傳完整預覽報告', async () => {
    const existing = `---\nname: mem-test\nlast_updated: "old"\nstaleness: 0\n---\n\n## Tracked Files\n- f1\n\n## Key Decisions\n- D01\n`
    vi.mocked(fs.readFile).mockResolvedValue(existing as unknown as Awaited<ReturnType<typeof fs.readFile>>)

    const result = await handleMemoryUpdate({
      moduleName: 'mem-test',
      content: '## Key Decisions\n- D01\n- D02\n',
      mode: 'patch',
      dryRun: true,
      projectRoot: PROJECT_ROOT,
    })

    const report = JSON.parse(result.content[0].text)
    expect(report.status).toBe('dry_run')
    expect(report.replaced).toContain('## Key Decisions')
    expect(report.preserved).toContain('## Tracked Files')
    expect(report.linesBefore).toBeGreaterThan(0)
    expect(report.linesAfter).toBeGreaterThan(0)
  })

  it('大幅刪減應產生警告', async () => {
    // 建立一個較長的檔案
    const longContent = '- line\n'.repeat(20)
    const existing = `---\nname: mem-test\nlast_updated: "old"\nstaleness: 0\n---\n\n## A\n${longContent}\n## B\n${longContent}`
    vi.mocked(fs.readFile).mockResolvedValue(existing as unknown as Awaited<ReturnType<typeof fs.readFile>>)

    let writtenContent = ''
    vi.mocked(fs.writeFile).mockImplementation(async (_path, data) => {
      writtenContent = data as string
    })

    const result = await handleMemoryUpdate({
      moduleName: 'mem-test',
      content: '## A\n- short\n## B\n- short\n',
      mode: 'patch',
      projectRoot: PROJECT_ROOT,
    })

    const report = JSON.parse(result.content[0].text)
    expect(report.warnings.some((w: string) => w.includes('大幅刪減'))).toBe(true)
    // 仍然寫入（只警告不阻擋）
    expect(writtenContent).toContain('- short')
  })
})

// ---------------------------------------------------------------------------
// stalenessToLevel — 過期等級轉換
// ---------------------------------------------------------------------------
describe('stalenessToLevel — 過期等級轉換', () => {
  it('0 應為 healthy', () => {
    expect(stalenessToLevel(0)).toBe('healthy')
  })
  it('5 應為 mild', () => {
    expect(stalenessToLevel(5)).toBe('mild')
  })
  it('10 應為 significant', () => {
    expect(stalenessToLevel(10)).toBe('significant')
  })
  it('30 應為 critical', () => {
    expect(stalenessToLevel(30)).toBe('critical')
  })
  it('負數應為 healthy', () => {
    expect(stalenessToLevel(-1)).toBe('healthy')
  })
})

// ---------------------------------------------------------------------------
// handleMemoryStatus — 過期狀態診斷
// ---------------------------------------------------------------------------
describe('handleMemoryStatus', () => {
  it('應從索引檔回傳結構化 JSON', async () => {
    const indexData = {
      cartridges: {
        'mem-analyzer': {
          staleness: 15,
          lastUpdated: '2026-03-28T10:15:00+08:00',
          trackedFiles: ['src/analyzer.ts'],
          pendingChanges: [
            { filePath: 'src/analyzer.ts', eventType: 'change', timestamp: '2026-03-29T11:00:00+08:00' },
          ],
        },
      },
    }
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(indexData) as unknown as Awaited<ReturnType<typeof fs.readFile>>
    )

    const result = await handleMemoryStatus({ moduleName: 'mem-analyzer', projectRoot: PROJECT_ROOT })
    const status = JSON.parse(result.content[0].text)

    expect(status.module).toBe('mem-analyzer')
    expect(status.staleness).toBe(15)
    expect(status.level).toBe('significant')
    expect(status.pendingChanges).toHaveLength(1)
    expect(status.pendingChanges[0].absolutePath).toContain('analyzer.ts')
    expect(status.actionRequired).toContain('view_file')
  })

  it('索引檔不存在時應回退讀 SKILL.md frontmatter', async () => {
    const skillContent = '---\nname: mem-test\nlast_updated: "2026-03-28T10:00:00+08:00"\nstaleness: 5\n---\n# Test'
    // 呼叫流程：1. handler 讀索引(reject) → 2. resolveSkillPath 讀索引(reject) → 3. 讀 SKILL.md(resolve)
    vi.mocked(fs.readFile)
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockResolvedValueOnce(skillContent as unknown as Awaited<ReturnType<typeof fs.readFile>>)

    const result = await handleMemoryStatus({ moduleName: 'mem-test', projectRoot: PROJECT_ROOT })
    const status = JSON.parse(result.content[0].text)

    expect(status.staleness).toBe(5)
    expect(status.level).toBe('mild')
    expect(status._note).toContain('索引檔不存在')
  })

  it('模組不在索引中應回傳錯誤', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({ cartridges: {} }) as unknown as Awaited<ReturnType<typeof fs.readFile>>
    )

    const result = await handleMemoryStatus({ moduleName: 'mem-nonexistent', projectRoot: PROJECT_ROOT })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('not found')
  })

  it('路徑穿越（..）應回傳 Validation Error', async () => {
    const result = await handleMemoryStatus({ moduleName: 'mem-test', projectRoot: '/foo/../../etc' })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Validation Error')
  })
})

// ---------------------------------------------------------------------------
// handleMemoryList — 增強回傳（含過期狀態）
// ---------------------------------------------------------------------------
describe('handleMemoryList — 增強回傳', () => {
  it('有索引時應回傳含過期狀態的 JSON 陣列', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { isDirectory: () => true, name: 'mem-_system' },
      { isDirectory: () => true, name: 'mem-analyzer' },
    ] as unknown as Awaited<ReturnType<typeof fs.readdir>>)

    const indexData = {
      cartridges: {
        'mem-_system': { staleness: 0, pendingChanges: [] },
        'mem-analyzer': { staleness: 15, pendingChanges: [{ filePath: 'src/analyzer.ts' }] },
      },
    }
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(indexData) as unknown as Awaited<ReturnType<typeof fs.readFile>>
    )

    const result = await handleMemoryList({ projectRoot: PROJECT_ROOT })
    const list = JSON.parse(result.content[0].text)

    expect(list).toHaveLength(2)
    expect(list[0].module).toBe('mem-_system')
    expect(list[0].level).toBe('healthy')
    expect(list[1].module).toBe('mem-analyzer')
    expect(list[1].level).toBe('significant')
    expect(list[1].pendingChangesCount).toBe(1)
  })

  it('索引不存在時應回退到純文字模式', async () => {
    vi.mocked(fs.readdir).mockResolvedValue([
      { isDirectory: () => true, name: 'mem-_system' },
    ] as unknown as Awaited<ReturnType<typeof fs.readdir>>)
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'))

    const result = await handleMemoryList({ projectRoot: PROJECT_ROOT })

    expect(result.content[0].text).toContain('Available memories:')
    expect(result.content[0].text).toContain('mem-_system')
  })
})

// ---------------------------------------------------------------------------
// handleMemoryUpdate — pendingChanges 清除
// ---------------------------------------------------------------------------
describe('handleMemoryUpdate — pendingChanges 清除', () => {
  it('更新成功後應清除索引中的 pendingChanges', async () => {
    const indexData = {
      cartridges: {
        'mem-test': { staleness: 10, pendingChanges: [{ filePath: 'src/test.ts' }] },
      },
    }
    let writtenIndex = ''

    vi.mocked(fs.writeFile).mockImplementation(async (filePath, data) => {
      const fp = filePath as string
      if (fp.includes('cartridge_index')) {
        writtenIndex = data as string
      }
    })
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify(indexData) as unknown as Awaited<ReturnType<typeof fs.readFile>>
    )

    const content = '---\nname: mem-test\nlast_updated: "old"\nstaleness: 5\n---\n# Content'
    await handleMemoryUpdate({ moduleName: 'mem-test', content, projectRoot: PROJECT_ROOT })

    expect(writtenIndex).toBeTruthy()
    const parsed = JSON.parse(writtenIndex)
    expect(parsed.cartridges['mem-test'].pendingChanges).toEqual([])
    expect(parsed.cartridges['mem-test'].staleness).toBe(0)
  })

  it('索引不存在時更新仍應成功', async () => {
    // 第一次 writeFile 寫 SKILL.md 成功，第二次寫索引失敗
    vi.mocked(fs.writeFile).mockImplementation(async () => {
      // 不拋出任何錯誤，讓寫入全部成功
    })
    // readFile 讀取索引檔失敗
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'))

    const content = '---\nname: mem-test\nlast_updated: "old"\nstaleness: 0\n---\n# Content'
    const result = await handleMemoryUpdate({ moduleName: 'mem-test', content, projectRoot: PROJECT_ROOT })

    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toContain('Successfully updated')
  })
})

// ---------------------------------------------------------------------------
// handleMemoryUpdate — parentModule 巢狀建立
// ---------------------------------------------------------------------------
describe('handleMemoryUpdate — parentModule 巢狀建立', () => {
  it('指定 parentModule 時應建在父卡目錄下', async () => {
    // resolveSkillPath 找不到子卡（null）也找不到索引 → fs.access 平面路徑檢查
    vi.mocked(fs.access)
      .mockRejectedValueOnce(new Error('ENOENT'))  // resolveSkillPath 策略 1: 索引讀取後 access 失敗
      .mockRejectedValueOnce(new Error('ENOENT'))  // resolveSkillPath 策略 2: 平面路徑不存在（子卡）
      .mockResolvedValueOnce(undefined)             // resolveSkillPath 策略 2: 平面路徑存在（父卡）

    // readFile: 索引讀取失敗（子卡和父卡的 resolveSkillPath 各一次）
    vi.mocked(fs.readFile)
      .mockRejectedValueOnce(new Error('ENOENT'))
      .mockRejectedValueOnce(new Error('ENOENT'))

    let writtenPath = ''
    vi.mocked(fs.writeFile).mockImplementation(async (filePath) => {
      if (!writtenPath) writtenPath = filePath as string
    })

    const content = '---\nname: mem-api-auth\nlast_updated: "old"\nstaleness: 0\n---\n# Auth Module'
    await handleMemoryUpdate({
      moduleName: 'mem-api-auth',
      content,
      projectRoot: PROJECT_ROOT,
      parentModule: 'mem-api',
    })

    // 應包含父卡名稱作為路徑的一部分
    expect(writtenPath).toContain('mem-api')
    expect(writtenPath).toContain('mem-api-auth')
    expect(writtenPath).toContain('SKILL.md')
  })
})

