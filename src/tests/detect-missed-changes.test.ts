/**
 * 記憶卡匣外掛系統 — 離線變動偵測單元測試
 * 覆蓋 detectMissedChanges() 的所有邏輯分支
 * 使用 vi.mock('node:fs') 模擬 statSync 回傳控制 mtime
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CartridgeIndexManager } from '../index-manager.js'
import { createConfig } from '../config.js'
import type { CartridgeConfig, CartridgeIndex } from '../types.js'

// 模擬 node:fs，只攔截 statSync，其餘保持原始行為
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    default: {
      ...actual,
      statSync: vi.fn(),
    },
  }
})

import fs from 'node:fs'

const PROJECT_ROOT = '/mock/detect-test-project'

/** 預設計分權重（與 config.ts DEFAULT_SCORING 一致） */
const DEFAULT_SCORING: CartridgeConfig['scoring'] = {
  fileChanged: 10,
  fileDeleted: 20,
  fileAdded: 5,
  dailyDecay: 1,
}

/** 建立含預設索引的管理器 */
function createManagerWithIndex(
  indexOverride: Partial<CartridgeIndex> = {},
): CartridgeIndexManager {
  const config = createConfig(PROJECT_ROOT)
  const manager = new CartridgeIndexManager(config)

  manager['index'] = {
    version: 1,
    lastScanned: '2026-03-29T10:00:00+08:00',
    cartridges: {},
    fileMap: {},
    ...indexOverride,
  }

  return manager
}

/** 毫秒時間戳輔助 */
const toMs = (iso: string) => new Date(iso).getTime()

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// detectMissedChanges — 離線變動偵測
// ---------------------------------------------------------------------------
describe('detectMissedChanges — 離線變動偵測', () => {
  it('檔案比記憶卡新時應補記異動並計算過期指數', () => {
    const manager = createManagerWithIndex({
      cartridges: {
        'mem-test': {
          skillPath: '.agents/skills/mem-test/SKILL.md',
          trackedFiles: ['src/foo.ts'],
          staleness: 0,
          lastUpdated: '2026-03-28T10:00:00+08:00',
          pendingChanges: [],
          depth: 1,
          parent: null,
        },
      },
      fileMap: { 'src/foo.ts': ['mem-test'] },
    })

    // 檔案修改時間比記憶卡更新時間晚
    vi.mocked(fs.statSync).mockReturnValue({
      mtimeMs: toMs('2026-03-29T12:00:00+08:00'),
    } as unknown as ReturnType<typeof fs.statSync>)

    manager.detectMissedChanges(DEFAULT_SCORING)

    const entry = manager.getIndex().cartridges['mem-test']
    expect(entry.pendingChanges).toHaveLength(1)
    expect(entry.pendingChanges[0].filePath).toBe('src/foo.ts')
    expect(entry.pendingChanges[0].eventType).toBe('change')
    expect(entry.staleness).toBe(DEFAULT_SCORING.fileChanged)
  })

  it('檔案比記憶卡舊時不應產生任何異動', () => {
    const manager = createManagerWithIndex({
      cartridges: {
        'mem-test': {
          skillPath: '.agents/skills/mem-test/SKILL.md',
          trackedFiles: ['src/bar.ts'],
          staleness: 0,
          lastUpdated: '2026-03-29T10:00:00+08:00',
          pendingChanges: [],
          depth: 1,
          parent: null,
        },
      },
      fileMap: { 'src/bar.ts': ['mem-test'] },
    })

    // 檔案修改時間比記憶卡更新時間早
    vi.mocked(fs.statSync).mockReturnValue({
      mtimeMs: toMs('2026-03-28T08:00:00+08:00'),
    } as unknown as ReturnType<typeof fs.statSync>)

    manager.detectMissedChanges(DEFAULT_SCORING)

    const entry = manager.getIndex().cartridges['mem-test']
    expect(entry.pendingChanges).toHaveLength(0)
    expect(entry.staleness).toBe(0)
  })

  it('記憶卡無更新時間時應跳過該卡匣', () => {
    const manager = createManagerWithIndex({
      cartridges: {
        'mem-no-date': {
          skillPath: '.agents/skills/mem-no-date/SKILL.md',
          trackedFiles: ['src/a.ts'],
          staleness: 0,
          lastUpdated: '',
          pendingChanges: [],
          depth: 1,
          parent: null,
        },
      },
    })

    manager.detectMissedChanges(DEFAULT_SCORING)

    // statSync 不應被呼叫
    expect(fs.statSync).not.toHaveBeenCalled()
    expect(manager.getIndex().cartridges['mem-no-date'].pendingChanges).toHaveLength(0)
  })

  it('記憶卡更新時間格式無效時應跳過（isNaN 防護）', () => {
    const manager = createManagerWithIndex({
      cartridges: {
        'mem-bad-date': {
          skillPath: '.agents/skills/mem-bad-date/SKILL.md',
          trackedFiles: ['src/b.ts'],
          staleness: 0,
          lastUpdated: 'not-a-date',
          pendingChanges: [],
          depth: 1,
          parent: null,
        },
      },
    })

    manager.detectMissedChanges(DEFAULT_SCORING)

    expect(fs.statSync).not.toHaveBeenCalled()
  })

  it('追蹤檔案不存在時應靜默跳過不拋錯', () => {
    const manager = createManagerWithIndex({
      cartridges: {
        'mem-missing-file': {
          skillPath: '.agents/skills/mem-missing-file/SKILL.md',
          trackedFiles: ['src/gone.ts'],
          staleness: 0,
          lastUpdated: '2026-03-28T10:00:00+08:00',
          pendingChanges: [],
          depth: 1,
          parent: null,
        },
      },
    })

    // 模擬檔案不存在
    vi.mocked(fs.statSync).mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory')
    })

    // 不應拋出錯誤
    expect(() => manager.detectMissedChanges(DEFAULT_SCORING)).not.toThrow()

    const entry = manager.getIndex().cartridges['mem-missing-file']
    expect(entry.pendingChanges).toHaveLength(0)
    expect(entry.staleness).toBe(0)
  })

  it('目錄型追蹤路徑（尾部 /）應被跳過', () => {
    const manager = createManagerWithIndex({
      cartridges: {
        'mem-dir-track': {
          skillPath: '.agents/skills/mem-dir-track/SKILL.md',
          trackedFiles: ['src/templates/', 'src/real-file.ts'],
          staleness: 0,
          lastUpdated: '2026-03-28T10:00:00+08:00',
          pendingChanges: [],
          depth: 1,
          parent: null,
        },
      },
    })

    vi.mocked(fs.statSync).mockReturnValue({
      mtimeMs: toMs('2026-03-29T12:00:00+08:00'),
    } as unknown as ReturnType<typeof fs.statSync>)

    manager.detectMissedChanges(DEFAULT_SCORING)

    // statSync 只應被呼叫 1 次（跳過目錄型路徑）
    expect(fs.statSync).toHaveBeenCalledTimes(1)
    const entry = manager.getIndex().cartridges['mem-dir-track']
    expect(entry.pendingChanges).toHaveLength(1)
    expect(entry.pendingChanges[0].filePath).toBe('src/real-file.ts')
  })

  it('多檔案混合場景：部分新、部分舊', () => {
    const lastUpdated = '2026-03-28T10:00:00+08:00'
    const manager = createManagerWithIndex({
      cartridges: {
        'mem-mixed': {
          skillPath: '.agents/skills/mem-mixed/SKILL.md',
          trackedFiles: ['src/new.ts', 'src/old.ts', 'src/also-new.ts'],
          staleness: 0,
          lastUpdated,
          pendingChanges: [],
          depth: 1,
          parent: null,
        },
      },
    })

    vi.mocked(fs.statSync)
      .mockReturnValueOnce({ mtimeMs: toMs('2026-03-29T12:00:00+08:00') } as unknown as ReturnType<typeof fs.statSync>) // new.ts — 較新
      .mockReturnValueOnce({ mtimeMs: toMs('2026-03-27T08:00:00+08:00') } as unknown as ReturnType<typeof fs.statSync>) // old.ts — 較舊
      .mockReturnValueOnce({ mtimeMs: toMs('2026-03-29T15:00:00+08:00') } as unknown as ReturnType<typeof fs.statSync>) // also-new.ts — 較新

    manager.detectMissedChanges(DEFAULT_SCORING)

    const entry = manager.getIndex().cartridges['mem-mixed']
    expect(entry.pendingChanges).toHaveLength(2)
    expect(entry.pendingChanges.map(c => c.filePath)).toEqual(['src/new.ts', 'src/also-new.ts'])
    // 2 個 change 事件 × fileChanged(10) = 20
    expect(entry.staleness).toBe(2 * DEFAULT_SCORING.fileChanged)
  })

  it('既有待處理異動應與新偵測合併計算過期指數', () => {
    const manager = createManagerWithIndex({
      cartridges: {
        'mem-existing': {
          skillPath: '.agents/skills/mem-existing/SKILL.md',
          trackedFiles: ['src/x.ts'],
          staleness: 0,
          lastUpdated: '2026-03-28T10:00:00+08:00',
          pendingChanges: [
            // 已有一筆先前的 unlink 異動
            { filePath: 'src/deleted.ts', eventType: 'unlink', timestamp: '2026-03-28T12:00:00+08:00' },
          ],
          depth: 1,
          parent: null,
        },
      },
    })

    vi.mocked(fs.statSync).mockReturnValue({
      mtimeMs: toMs('2026-03-29T12:00:00+08:00'),
    } as unknown as ReturnType<typeof fs.statSync>)

    manager.detectMissedChanges(DEFAULT_SCORING)

    const entry = manager.getIndex().cartridges['mem-existing']
    // 1 筆舊 unlink + 1 筆新 change
    expect(entry.pendingChanges).toHaveLength(2)
    // staleness = fileDeleted(20) + fileChanged(10) = 30
    expect(entry.staleness).toBe(DEFAULT_SCORING.fileDeleted + DEFAULT_SCORING.fileChanged)
  })

  it('同一檔案不應重複記錄（去重整合驗證）', () => {
    const manager = createManagerWithIndex({
      cartridges: {
        'mem-dedup': {
          skillPath: '.agents/skills/mem-dedup/SKILL.md',
          trackedFiles: ['src/dup.ts'],
          staleness: 0,
          lastUpdated: '2026-03-28T10:00:00+08:00',
          // 已經有該檔案的異動紀錄
          pendingChanges: [
            { filePath: 'src/dup.ts', eventType: 'change', timestamp: '2026-03-28T11:00:00+08:00' },
          ],
          depth: 1,
          parent: null,
        },
      },
    })

    vi.mocked(fs.statSync).mockReturnValue({
      mtimeMs: toMs('2026-03-29T12:00:00+08:00'),
    } as unknown as ReturnType<typeof fs.statSync>)

    manager.detectMissedChanges(DEFAULT_SCORING)

    const entry = manager.getIndex().cartridges['mem-dedup']
    // 去重後仍只有 1 筆
    expect(entry.pendingChanges).toHaveLength(1)
  })

  it('卡匣無追蹤檔案時應跳過', () => {
    const manager = createManagerWithIndex({
      cartridges: {
        'mem-empty': {
          skillPath: '.agents/skills/mem-empty/SKILL.md',
          trackedFiles: [],
          staleness: 0,
          lastUpdated: '2026-03-28T10:00:00+08:00',
          pendingChanges: [],
          depth: 1,
          parent: null,
        },
      },
    })

    manager.detectMissedChanges(DEFAULT_SCORING)

    expect(fs.statSync).not.toHaveBeenCalled()
    expect(manager.getIndex().cartridges['mem-empty'].staleness).toBe(0)
  })
})
