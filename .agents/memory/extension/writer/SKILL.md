---
name: writer
description: |
  專案記憶：記憶卡寫入器模組。 Use when: 處理警報植入、警報移除、記憶卡過期警示注入時載入。
last_updated: '2026-03-30T03:13:02+08:00'
status: stable
staleness: 0
---

# Memory Writer — 記憶卡寫入器記憶

## Tracked Files
- src/writer.ts
- src/tests/writer.test.ts

## Key Decisions
- D01: 使用 HTML 註解標記（WARNING_START/WARNING_END）標記警報區塊邊界，實現精確插入與移除
- D02: `injectWarning()` 先移除既有警報（idempotent），再植入新警報，避免重複堆疊
- D03: `checkAndCleanWarning()` 偵測 staleness === 0 且警報存在時，自動觸發清除動作
- D04: 警報植入時自動更新 frontmatter（staleness 值、status: stale）
- D05: 過期等級分兩種：🔴 嚴重（critical）和 🟠 顯著（warning）
- D06: writer.ts 使用同步 fs API（readFileSync/writeFileSync/existsSync），測試需 vi.mock('node:fs')，非 vi.mock('fs/promises')
- D07: 警報時間戳從 `new Date().toISOString()` 改為 `getTaiwanISO()`，統一全系統時區處理

## Known Issues
- 無
## Module Lessons
- D01: `matter.stringify()` 在前後新增 frontmatter 時，內容的前導換行需謹慎處理，否則警報移除後可能殘留空行
- D02: gray-matter 在測試中可讓它真實執行（純字串解析），不需要 mock，測試語義更完整
- D03: vi.mock('node:fs') 需同時 mock default export 與 named exports，否則 ESM 解構引入會失敗
- D04: vitest 對 `node:fs` 的 vi.mock factory 存在 ESM interop 邊緣問題，新增於 mock factory 中的 `readFileSync` vi.fn() 在某些測試順序下會回傳意料之外的值。避免在已用 vi.mock('node:fs') 的測試檔中新增使用 readFileSync 的新方法。

## Relations
- extension（父卡：由外掛主流程編排）
- analyzer（兄弟卡：提供 getStalenessLevel() 判斷警報等級）
- watcher（兄弟卡：上游事件驅動者，偵測到 staleness 重設時呼叫 checkAndCleanWarning）
- mcp-tools（根層模組：共用 timestamp.ts 時間戳模組）
