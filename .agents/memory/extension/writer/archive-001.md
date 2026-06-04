# extension.writer Legacy Archive Volume 001

Migrated: 2026-06-04T07:15:00+08:00
Archive policy: schema v2 lazy upgrade preserved the original legacy SKILL.md content verbatim for trace-back.

## Original Legacy Content

---
name: writer
description: |
  專案記憶：記憶卡寫入器模組。 Use when: 處理警報植入、警報移除、記憶卡過期警示注入時載入。
last_updated: '2026-05-16T18:18:04+08:00'
status: stable
staleness: 0
metadata:
  author: antigravity
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:write'
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
- D05: 過期等級判斷改由 core-types 的 `staleness.ts` 提供；writer 只負責將 significant / critical 呈現為 🟠 / 🔴 警報，不再 import analyzer。
- D06: writer.ts 使用同步 fs API（readFileSync/writeFileSync/existsSync），測試需 vi.mock('node:fs')，非 vi.mock('fs/promises')
- D07: 警報時間戳從 `new Date().toISOString()` 改為 `getTaiwanISO()`，統一全系統時區處理
- D08: writer 不再依賴 analyzer；`extension.writer` 的 engineering dependencies 降為 core-types，解除 analyzer/writer 循環。

## Known Issues
- 無
## Module Lessons
- D01: `matter.stringify()` 在前後新增 frontmatter 時，內容的前導換行需謹慎處理，否則警報移除後可能殘留空行
- D02: gray-matter 在測試中可讓它真實執行（純字串解析），不需要 mock，測試語義更完整
- D03: vi.mock('node:fs') 需同時 mock default export 與 named exports，否則 ESM 解構引入會失敗
- D04: vitest 對 `node:fs` 的 vi.mock factory 存在 ESM interop 邊緣問題，新增於 mock factory 中的 `readFileSync` vi.fn() 在某些測試順序下會回傳意料之外的值。避免在已用 vi.mock('node:fs') 的測試檔中新增使用 readFileSync 的新方法。
- L05: 警報呈現需要過期等級，但不應依賴事件分析器；共用純函式應放在 core-types 層以避免 UI/寫入器與分析器互相綁死。

## Relations
- extension（父卡：由外掛主流程編排）
- watcher（兄弟卡：上游事件驅動者，偵測到 staleness 重設時呼叫 checkAndCleanWarning）
- core-types（共用：getStalenessLevel 與 timestamp）

## Applicable Skills
- test-patterns
