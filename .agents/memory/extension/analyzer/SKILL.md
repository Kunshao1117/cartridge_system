---
name: analyzer
description: |
  專案記憶：過期分析器模組。 Use when: 處理過期指數計算、衰退演算法、異動事件處理時載入。
last_updated: '2026-05-06T08:18:12+08:00'
status: stable
staleness: 0
metadata:
  author: antigravity
  version: '2.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
---

# Staleness Analyzer — 過期分析器記憶

## Tracked Files

- src/analyzer.ts
- src/tests/analyzer.test.ts

## Key Decisions

- D01: 過期指數採四級閾值制（0/1-9/10-29/30+）
- D02: 檔案修改 +10 分、刪除 +20 分、新增 +5 分
- D03: 同一檔案重複修改不重複加分
- D04: 每 24 小時未更新的記憶卡 +1 時間衰退分
- D05: getStalenessLevel() 公開函式供其他模組共用
- D06: v2.0 解除 I/O 耦合，將原有的 `persist()` 呼叫全部改為 `markDirty()`，由全域 Cache-First 負責後續保存
- D07: processFileEvent() 中不需再 spy mock fs，只需驗證 writer 與 markDirty 被正確呼叫
- D08: v4.0 測試 fixture 規範 — 所有 `CartridgeEntry` 測試 fixture 必須包含 `ghostFiles: []`、`dependencies: []`、`indirectStaleness: 0` 三個必要欄位，否則會觸發 TypeScript 型別錯誤。

## Known Issues

- 無

## Module Lessons

- D01: StalenessAnalyzer 測試可直接 stub MemoryWriter 介面（vi.fn()），不需要 mock fs，測試語義最清晰
- L02: (2026-05-06) v4.0 新增 ghostFiles/dependencies/indirectStaleness 欄位後，所有測試檔的 CartridgeEntry fixture 必須同步更新，這是跨測試檔的隱性耦合點。

## Relations

- extension（父卡：由外掛主流程編排）
- watcher（兄弟卡：上游事件來源）
- writer（兄弟卡：下游警報寫入）
- index-manager（根層共用服務：讀取反向映射表、標記 Dirty）

## Applicable Skills

- test-patterns
