/**
 * 記憶卡匣外掛系統 — 規則注入器單元測試
 * 覆蓋 CoreInjector 的偵測、注入、安全護欄與報告格式化
 * 使用 vi.mock('node:fs') 和 vi.mock('node:crypto') 完全隔離磁碟
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CartridgeConfig } from '../types.js'

// ---------------------------------------------------------------------------
// Mock — 攔截所有同步檔案系統操作與 crypto
// ---------------------------------------------------------------------------
vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
    copyFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    statSync: vi.fn(),
  },
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  copyFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  statSync: vi.fn(),
}))

vi.mock('node:crypto', () => ({
  default: {
    createHash: vi.fn(),
  },
  createHash: vi.fn(),
}))

import fs from 'node:fs'
import crypto from 'node:crypto'
import { CoreInjector } from '../injector.js'

const PROJECT_ROOT = '/mock/injector-test-project'

/** 建立測試用設定（只需 projectRoot） */
function createTestConfig(): CartridgeConfig {
  return {
    projectRoot: PROJECT_ROOT,
    skillsDir: '.agents/skills',
    memoryDir: '.agents/memory',
    excludeDirs: [],
    ignoreFiles: [],
    thresholds: { significant: 10, critical: 30 },
    scoring: { fileChanged: 10, fileDeleted: 20, fileAdded: 5, dailyDecay: 1 },
  }
}

/** 模擬 crypto.createHash 回傳指定雜湊值 */
function mockHash(hashValue: string) {
  const hashObj = {
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue(hashValue),
  }
  vi.mocked(crypto.createHash).mockReturnValue(hashObj as unknown as ReturnType<typeof crypto.createHash>)
  return hashObj
}

/** 模擬 crypto.createHash 依讀取內容回傳不同雜湊 */
function mockHashByContent(contentToHash: Map<string, string>) {
  vi.mocked(crypto.createHash).mockImplementation(() => {
    let inputContent = ''
    const hashObj = {
      update: vi.fn().mockImplementation((data: Buffer | string) => {
        inputContent = data.toString()
        return hashObj
      }),
      digest: vi.fn().mockImplementation(() => {
        return contentToHash.get(inputContent) ?? `hash-of-${inputContent}`
      }),
    }
    return hashObj as unknown as ReturnType<typeof crypto.createHash>
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// CoreInjector — 範本偵測與注入
// ---------------------------------------------------------------------------
describe('CoreInjector — 範本偵測與注入', () => {
  it('範本目錄不存在時應回傳空報告', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p: unknown) => {
      const pathStr = String(p)
      // .agents 目錄、logs 目錄存在，但範本目錄不存在
      if (pathStr.includes('templates')) return false
      return true
    })

    const injector = new CoreInjector(createTestConfig())
    const report = await injector.inject()

    expect(report).toHaveLength(0)
    // 不應嘗試複製任何檔案
    expect(fs.copyFileSync).not.toHaveBeenCalled()
  })

  it('全新專案注入：目標檔案不存在時應複製', async () => {
    /**
     * existsSync 呼叫順序：
     *  1. agentsDir (.agents)        → true（已存在）
     *  2. templatesDir (dist/templates) → true（範本目錄存在）
     *  3. listFilesRecursive: existsSync(dir) → true（範本目錄）
     *  4. detectStatus: targetPath (.agents/rules) → false（目標檔案不存在 → missing）
     *  5. inject 內 targetDir 檢查   → true（目標目錄已存在）
     */
    vi.mocked(fs.existsSync)
      .mockReturnValueOnce(true)   // agentsDir
      .mockReturnValueOnce(true)   // templatesDir
      .mockReturnValueOnce(true)   // listFilesRecursive 內部
      .mockReturnValueOnce(false)  // detectStatus → targetPath 不存在 → missing
      .mockReturnValueOnce(true)   // targetDir 檢查

    // readdirSync for listFilesRecursive — 只有檔案，無子目錄
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'rules', isDirectory: () => false, isFile: () => true },
    ] as unknown as ReturnType<typeof fs.readdirSync>)

    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('template content'))
    mockHash('template-hash')

    const injector = new CoreInjector(createTestConfig())
    const report = await injector.inject()

    expect(report).toHaveLength(1)
    expect(report[0].status).toBe('missing')
    expect(fs.copyFileSync).toHaveBeenCalledTimes(1)
  })

  it('檔案雜湊一致時應標記為 match 且不覆寫', async () => {
    // 所有 existsSync 回傳 true：目錄和檔案都存在
    vi.mocked(fs.existsSync).mockReturnValue(true)

    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'config.md', isDirectory: () => false, isFile: () => true },
    ] as unknown as ReturnType<typeof fs.readdirSync>)

    // 兩個檔案內容相同 → 雜湊相同
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('same content'))
    mockHash('identical-hash')

    const injector = new CoreInjector(createTestConfig())
    const report = await injector.inject()

    expect(report).toHaveLength(1)
    expect(report[0].status).toBe('match')
    expect(fs.copyFileSync).not.toHaveBeenCalled()
  })

  it('檔案雜湊不同時應標記為 outdated 並覆寫', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)

    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'workflow.md', isDirectory: () => false, isFile: () => true },
    ] as unknown as ReturnType<typeof fs.readdirSync>)

    // 範本讀取與目標讀取回傳不同內容
    vi.mocked(fs.readFileSync)
      .mockReturnValueOnce(Buffer.from('new template'))
      .mockReturnValueOnce(Buffer.from('old target'))

    // 不同內容產生不同雜湊
    mockHashByContent(new Map([
      ['new template', 'hash-new'],
      ['old target', 'hash-old'],
    ]))

    const injector = new CoreInjector(createTestConfig())
    const report = await injector.inject()

    expect(report).toHaveLength(1)
    expect(report[0].status).toBe('outdated')
    expect(fs.copyFileSync).toHaveBeenCalledTimes(1)
  })

  it('mem-* 路徑安全護欄：絕不處理記憶卡檔案', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)

    // 範本目錄含一般檔案和 mem-* 資料夾
    vi.mocked(fs.readdirSync).mockImplementation((dir: unknown) => {
      const dirStr = String(dir)
      if (dirStr.includes('mem-system')) {
        // mem-* 子目錄的內容
        return [
          { name: 'SKILL.md', isDirectory: () => false, isFile: () => true },
        ] as unknown as ReturnType<typeof fs.readdirSync>
      }
      // 根範本目錄
      return [
        { name: 'safe-file.md', isDirectory: () => false, isFile: () => true },
        { name: 'mem-system', isDirectory: () => true, isFile: () => false },
      ] as unknown as ReturnType<typeof fs.readdirSync>
    })

    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('content'))
    mockHash('some-hash')

    const injector = new CoreInjector(createTestConfig())
    const report = await injector.inject()

    // 只有 safe-file.md 出現在報告中，mem-system/SKILL.md 被跳過
    const templatePaths = report.map(r => r.templatePath)
    expect(templatePaths.some(p => p.includes('mem-'))).toBe(false)
    expect(templatePaths.some(p => p === 'safe-file.md')).toBe(true)
  })

  it('.agents/ 目錄不存在時應自動建立', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p: unknown) => {
      const pathStr = String(p)
      // .agents 目錄不存在
      if (pathStr.endsWith('.agents')) return false
      // 範本目錄也不存在（提早退出）
      if (pathStr.includes('templates')) return false
      return true
    })

    const injector = new CoreInjector(createTestConfig())
    await injector.inject()

    // 應建立 .agents 目錄
    const mkdirCalls = vi.mocked(fs.mkdirSync).mock.calls
    const createdPaths = mkdirCalls.map(c => String(c[0]))
    expect(createdPaths.some(p => p.includes('.agents'))).toBe(true)
  })

  it('目標子目錄不存在時應自動建立', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p: unknown) => {
      const pathStr = String(p)
      // 範本目錄和基礎目錄存在
      if (pathStr.includes('templates')) return true
      if (pathStr.endsWith('.agents') || pathStr.endsWith('logs')) return true
      // 目標子目錄不存在
      if (pathStr.includes('skills') && !pathStr.includes('templates')) return false
      // 目標檔案不存在
      return false
    })

    vi.mocked(fs.readdirSync).mockImplementation((dir: unknown) => {
      const dirStr = String(dir)
      if (dirStr.includes('sub-dir')) {
        return [
          { name: 'deep-file.md', isDirectory: () => false, isFile: () => true },
        ] as unknown as ReturnType<typeof fs.readdirSync>
      }
      return [
        { name: 'sub-dir', isDirectory: () => true, isFile: () => false },
      ] as unknown as ReturnType<typeof fs.readdirSync>
    })

    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('content'))
    mockHash('hash')

    const injector = new CoreInjector(createTestConfig())
    await injector.inject()

    // mkdirSync 應被呼叫來建立子目錄
    expect(fs.mkdirSync).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// CoreInjector — formatReport 報告格式化
// ---------------------------------------------------------------------------
describe('CoreInjector — formatReport 報告格式化', () => {
  it('空報告應輸出「無範本檔案需處理」', () => {
    const injector = new CoreInjector(createTestConfig())
    // 未呼叫 inject()，report 為空
    expect(injector.formatReport()).toBe('（無範本檔案需處理）')
  })

  it('混合狀態報告應正確分組統計', async () => {
    const injector = new CoreInjector(createTestConfig())
    // 手動注入測試報告
    injector['report'] = [
      { templatePath: 'rules/a.md', targetPath: '/target/a.md', status: 'missing' },
      { templatePath: 'rules/b.md', targetPath: '/target/b.md', status: 'missing' },
      { templatePath: 'workflows/c.md', targetPath: '/target/c.md', status: 'outdated' },
      { templatePath: 'skills/d.md', targetPath: '/target/d.md', status: 'match' },
      { templatePath: 'skills/e.md', targetPath: '/target/e.md', status: 'match' },
      { templatePath: 'skills/f.md', targetPath: '/target/f.md', status: 'match' },
    ]

    const output = injector.formatReport()

    expect(output).toContain('🆕 注入 2 個新檔案')
    expect(output).toContain('🔄 更新 1 個過時檔案')
    expect(output).toContain('✅ 跳過 3 個一致檔案')
  })
})
