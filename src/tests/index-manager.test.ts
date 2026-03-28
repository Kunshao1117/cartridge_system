/**
 * 記憶卡匣外掛系統 — 索引管理器單元測試
 * 覆蓋 parseTrackedFiles 路徑淨化邏輯與 CartridgeIndexManager 核心方法
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { parseTrackedFiles } from '../index-manager.js'
import { CartridgeIndexManager } from '../index-manager.js'
import { createConfig } from '../config.js'

// ---------------------------------------------------------------------------
// parseTrackedFiles — 路徑淨化邏輯
// ---------------------------------------------------------------------------
describe('parseTrackedFiles — 路徑淨化邏輯', () => {
  it('應正確解析標準純路徑', () => {
    const content = `
## Tracked Files
- src/index-manager.ts
- src/config.ts

## Key Decisions
`
    expect(parseTrackedFiles(content)).toEqual([
      'src/index-manager.ts',
      'src/config.ts',
    ])
  })

  it('應去除 Markdown 反引號', () => {
    const content = `
## Tracked Files
- \`src/mcp-server.ts\`

## Key Decisions
`
    expect(parseTrackedFiles(content)).toEqual(['src/mcp-server.ts'])
  })

  it('應截斷第一個空格後的說明文字', () => {
    const content = `
## Tracked Files
- src/extension.ts (VS Code 外掛入口)
- package.json (MCP dependencies)

## Key Decisions
`
    expect(parseTrackedFiles(content)).toEqual([
      'src/extension.ts',
      'package.json',
    ])
  })

  it('應同時處理反引號與說明文字的混合格式', () => {
    const content = `
## Tracked Files
- \`src/writer.ts\`
- src/analyzer.ts (過期分析器)
- src/watcher.ts

## Key Decisions
`
    expect(parseTrackedFiles(content)).toEqual([
      'src/writer.ts',
      'src/analyzer.ts',
      'src/watcher.ts',
    ])
  })

  it('應在無 Tracked Files 區段時回傳空陣列', () => {
    const content = `
## Key Decisions
- D01: some decision

## Module Lessons
`
    expect(parseTrackedFiles(content)).toEqual([])
  })

  it('應忽略全為空的行', () => {
    const content = `
## Tracked Files
- src/types.ts

- src/config.ts

## Key Decisions
`
    expect(parseTrackedFiles(content)).toEqual([
      'src/types.ts',
      'src/config.ts',
    ])
  })
})

// ---------------------------------------------------------------------------
// CartridgeIndexManager — addPendingChange 去重邏輯
// ---------------------------------------------------------------------------
describe('CartridgeIndexManager — addPendingChange 去重邏輯', () => {
  let manager: CartridgeIndexManager

  beforeEach(() => {
    const config = createConfig('d:/cartridge_system')
    manager = new CartridgeIndexManager(config)
    // 手動注入一個卡匣記錄，跳過 fs 依賴的 scan()
    manager['index'] = {
      version: 1,
      lastScanned: '',
      cartridges: {
        'mem-test': {
          skillPath: '.agents/skills/mem-test/SKILL.md',
          trackedFiles: ['src/test.ts'],
          staleness: 0,
          lastUpdated: '',
          pendingChanges: [],
        },
      },
      fileMap: { 'src/test.ts': ['mem-test'] },
    }
  })

  it('同一檔案兩次 change 事件只應記錄一筆', () => {
    manager.addPendingChange('mem-test', 'src/test.ts', 'change')
    manager.addPendingChange('mem-test', 'src/test.ts', 'change')

    const changes = manager.getIndex().cartridges['mem-test'].pendingChanges
    expect(changes).toHaveLength(1)
  })

  it('clearPendingChanges 後應清空待處理清單', () => {
    manager.addPendingChange('mem-test', 'src/test.ts', 'change')
    expect(manager.getIndex().cartridges['mem-test'].pendingChanges).toHaveLength(1)

    manager.clearPendingChanges('mem-test')
    expect(manager.getIndex().cartridges['mem-test'].pendingChanges).toHaveLength(0)
  })

  it('getAffectedCartridges 應支援 forward slash 正規化', () => {
    const result = manager.getAffectedCartridges('src\\test.ts')
    // Windows 反斜線正規化後應找到 mem-test
    expect(result).toEqual(['mem-test'])
  })
})
