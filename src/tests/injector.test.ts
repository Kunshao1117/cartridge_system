/**
 * 記憶卡匣外掛系統 — 規則注入器單元測試
 * 覆蓋 CoreInjector 的偵測、注入、安全護欄與報告格式化
 * v0.9.0 新增：三方比對四象限決策測試
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

/** 建立測試用設定（含 cartridgeDir） */
function createTestConfig(): CartridgeConfig {
  return {
    projectRoot: PROJECT_ROOT,
    skillsDir: '.agents/skills',
    memoryDir: '.agents/memory',
    cartridgeDir: '.cartridge',
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
// CoreInjector — 範本偵測與注入（基礎功能）
// ---------------------------------------------------------------------------
describe('CoreInjector — 範本偵測與注入', () => {
  it('範本目錄不存在時應回傳空報告', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p: unknown) => {
      const pathStr = String(p)
      if (pathStr.includes('templates')) return false
      return true
    })

    const injector = new CoreInjector(createTestConfig())
    const report = await injector.inject()

    expect(report).toHaveLength(0)
    expect(fs.copyFileSync).not.toHaveBeenCalled()
  })

  it('全新專案注入：目標檔案不存在時應複製', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p: unknown) => {
      const pathStr = String(p)
      if (pathStr.includes('.agents') && pathStr.includes('rules')) return false  // 目標不存在
      return true
    })
    // 特定測試需要 readFileSync 既回傳 JSON 又回傳 Buffer
    vi.mocked(fs.readFileSync).mockImplementation((p: unknown) => {
      const pathStr = String(p)
      if (pathStr.includes('injector.json')) throw new Error('ENOENT')
      return Buffer.from('template content') as unknown as string
    })

    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'rules', isDirectory: () => false, isFile: () => true },
    ] as unknown as ReturnType<typeof fs.readdirSync>)

    mockHash('template-hash')

    const injector = new CoreInjector(createTestConfig())
    const report = await injector.inject()

    expect(report).toHaveLength(1)
    expect(report[0].status).toBe('missing')
    expect(fs.copyFileSync).toHaveBeenCalledTimes(1)
  })

  it('mem-* 路徑安全護欄：絕不處理記憶卡檔案', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockImplementation((p: unknown) => {
      const pathStr = String(p)
      if (pathStr.includes('injector.json')) throw new Error('ENOENT')
      return Buffer.from('content') as unknown as string
    })

    vi.mocked(fs.readdirSync).mockImplementation((dir: unknown) => {
      const dirStr = String(dir)
      if (dirStr.includes('mem-system')) {
        return [
          { name: 'SKILL.md', isDirectory: () => false, isFile: () => true },
        ] as unknown as ReturnType<typeof fs.readdirSync>
      }
      return [
        { name: 'safe-file.md', isDirectory: () => false, isFile: () => true },
        { name: 'mem-system', isDirectory: () => true, isFile: () => false },
      ] as unknown as ReturnType<typeof fs.readdirSync>
    })

    mockHash('some-hash')

    const injector = new CoreInjector(createTestConfig())
    const report = await injector.inject()

    const templatePaths = report.map(r => r.templatePath)
    expect(templatePaths.some(p => p.includes('mem-'))).toBe(false)
    expect(templatePaths.some(p => p === 'safe-file.md')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// CoreInjector — 三方比對四象限決策測試
// ---------------------------------------------------------------------------
describe('CoreInjector — 三方比對決策', () => {
  it('範本無更新 + 使用者無修改 → match（靜默跳過）', async () => {
    const deployedHash = 'hash-baseline'
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockImplementation((p: unknown) => {
      const pathStr = String(p)
      if (pathStr.includes('injector.json')) {
        return JSON.stringify({ version: 1, settings: { conflictPolicy: 'ask' }, deployedHashes: { 'config.md': deployedHash } })
      }
      return Buffer.from('same content') as unknown as string
    })

    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'config.md', isDirectory: () => false, isFile: () => true },
    ] as unknown as ReturnType<typeof fs.readdirSync>)

    // 範本、目標、基準雜湊全部相同
    mockHash(deployedHash)

    const injector = new CoreInjector(createTestConfig())
    const report = await injector.inject()

    expect(report).toHaveLength(1)
    expect(report[0].status).toBe('match')
    expect(fs.copyFileSync).not.toHaveBeenCalled()
  })

  it('範本無更新 + 使用者有修改 → skipped（尊重客製化）', async () => {
    const baselineHash = 'hash-baseline'
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockImplementation((p: unknown) => {
      const pathStr = String(p)
      if (pathStr.includes('injector.json')) {
        return JSON.stringify({ version: 1, settings: { conflictPolicy: 'ask' }, deployedHashes: { 'config.md': baselineHash } })
      }
      if (pathStr.includes('templates')) return Buffer.from('original template') as unknown as string
      return Buffer.from('user modified content') as unknown as string
    })

    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'config.md', isDirectory: () => false, isFile: () => true },
    ] as unknown as ReturnType<typeof fs.readdirSync>)

    // 範本雜湊 = 基準雜湊，但使用者檔案雜湊不同
    mockHashByContent(new Map([
      ['original template', baselineHash],
      ['user modified content', 'hash-user-modified'],
    ]))

    const injector = new CoreInjector(createTestConfig())
    const report = await injector.inject()

    expect(report).toHaveLength(1)
    expect(report[0].status).toBe('skipped')
    expect(fs.copyFileSync).not.toHaveBeenCalled()
  })

  it('範本有更新 + 使用者無修改 → outdated（自動覆蓋）', async () => {
    const baselineHash = 'hash-old-template'
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockImplementation((p: unknown) => {
      const pathStr = String(p)
      if (pathStr.includes('injector.json')) {
        return JSON.stringify({ version: 1, settings: { conflictPolicy: 'ask' }, deployedHashes: { 'config.md': baselineHash } })
      }
      if (pathStr.includes('templates')) return Buffer.from('new template') as unknown as string
      return Buffer.from('old template') as unknown as string
    })

    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'config.md', isDirectory: () => false, isFile: () => true },
    ] as unknown as ReturnType<typeof fs.readdirSync>)

    // 範本雜湊 ≠ 基準雜湊（範本已更新），目標雜湊 = 基準雜湊（使用者沒改）
    mockHashByContent(new Map([
      ['new template', 'hash-new-template'],
      ['old template', baselineHash],
    ]))

    const injector = new CoreInjector(createTestConfig())
    const report = await injector.inject()

    expect(report).toHaveLength(1)
    expect(report[0].status).toBe('outdated')
    expect(fs.copyFileSync).toHaveBeenCalledTimes(1)
  })

  it('範本有更新 + 使用者有修改 + 策略 ask → conflict', async () => {
    const baselineHash = 'hash-old-template'
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockImplementation((p: unknown) => {
      const pathStr = String(p)
      if (pathStr.includes('injector.json')) {
        return JSON.stringify({ version: 1, settings: { conflictPolicy: 'ask' }, deployedHashes: { 'config.md': baselineHash } })
      }
      if (pathStr.includes('templates')) return Buffer.from('new template') as unknown as string
      return Buffer.from('user custom') as unknown as string
    })

    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'config.md', isDirectory: () => false, isFile: () => true },
    ] as unknown as ReturnType<typeof fs.readdirSync>)

    mockHashByContent(new Map([
      ['new template', 'hash-new-template'],
      ['user custom', 'hash-user-custom'],
    ]))

    const injector = new CoreInjector(createTestConfig())
    const report = await injector.inject()

    expect(report).toHaveLength(1)
    expect(report[0].status).toBe('conflict')
    expect(fs.copyFileSync).not.toHaveBeenCalled()
  })

  it('範本有更新 + 使用者有修改 + 策略 alwaysUpdate → 自動覆蓋', async () => {
    const baselineHash = 'hash-old-template'
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockImplementation((p: unknown) => {
      const pathStr = String(p)
      if (pathStr.includes('injector.json')) {
        return JSON.stringify({ version: 1, settings: { conflictPolicy: 'alwaysUpdate' }, deployedHashes: { 'config.md': baselineHash } })
      }
      if (pathStr.includes('templates')) return Buffer.from('new template') as unknown as string
      return Buffer.from('user custom') as unknown as string
    })

    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'config.md', isDirectory: () => false, isFile: () => true },
    ] as unknown as ReturnType<typeof fs.readdirSync>)

    mockHashByContent(new Map([
      ['new template', 'hash-new-template'],
      ['user custom', 'hash-user-custom'],
    ]))

    const injector = new CoreInjector(createTestConfig())
    const report = await injector.inject()

    expect(report).toHaveLength(1)
    expect(report[0].status).toBe('outdated')  // 已解決為 outdated
    expect(fs.copyFileSync).toHaveBeenCalledTimes(1)
  })

  it('首次安裝無基準檔 → 回退到簡單比對', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockImplementation((p: unknown) => {
      const pathStr = String(p)
      if (pathStr.includes('injector.json')) throw new Error('ENOENT')
      if (pathStr.includes('templates')) return Buffer.from('new template') as unknown as string
      return Buffer.from('old target') as unknown as string
    })

    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'workflow.md', isDirectory: () => false, isFile: () => true },
    ] as unknown as ReturnType<typeof fs.readdirSync>)

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
})

// ---------------------------------------------------------------------------
// CoreInjector — formatReport 報告格式化
// ---------------------------------------------------------------------------
describe('CoreInjector — formatReport 報告格式化', () => {
  it('空報告應輸出「無範本檔案需處理」', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)  // injector.json 不存在
    vi.mocked(fs.readFileSync).mockImplementation(() => { throw new Error('ENOENT') })
    const injector = new CoreInjector(createTestConfig())
    expect(injector.formatReport()).toBe('（無範本檔案需處理）')
  })

  it('混合狀態報告應正確分組統計', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    vi.mocked(fs.readFileSync).mockImplementation(() => { throw new Error('ENOENT') })
    const injector = new CoreInjector(createTestConfig())
    // 手動注入測試報告
    injector['report'] = [
      { templatePath: 'rules/a.md', targetPath: '/target/a.md', status: 'missing' },
      { templatePath: 'rules/b.md', targetPath: '/target/b.md', status: 'missing' },
      { templatePath: 'workflows/c.md', targetPath: '/target/c.md', status: 'outdated' },
      { templatePath: 'skills/d.md', targetPath: '/target/d.md', status: 'match' },
      { templatePath: 'skills/e.md', targetPath: '/target/e.md', status: 'skipped' },
      { templatePath: 'skills/f.md', targetPath: '/target/f.md', status: 'conflict' },
    ]

    const output = injector.formatReport()

    expect(output).toContain('🆕 注入 2 個新檔案')
    expect(output).toContain('🔄 更新 1 個過時檔案')
    expect(output).toContain('✅ 跳過 1 個一致檔案')
    expect(output).toContain('⏭️ 跳過 1 個已客製化檔案')
    expect(output).toContain('⚠️ 1 個衝突待處理')
  })
})
