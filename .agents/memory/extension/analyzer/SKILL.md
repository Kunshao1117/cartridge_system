---
name: analyzer
description: |
  專案記憶：過期分析器模組。 Use when: 處理過期指數計算、衰退演算法、異動事件處理時載入。
last_updated: '2026-04-12T11:40:30+08:00'
status: stale
staleness: 20
---
<!-- CARTRIDGE_SYSTEM_WARNING_START -->

> [!CAUTION]
> 🟠 **系統強制攔截**：此記憶已過期失真！
> 追蹤檔案異動：`src/analyzer.ts`、`src/tests/analyzer.test.ts`（2026-04-12T11:47:50+08:00）
> AI 嚴禁基於此記憶施工，必須優先閱讀最新原始碼並更新此記憶卡。
> staleness: 20 | threshold: 🟠 顯著過期

<!-- CARTRIDGE_SYSTEM_WARNING_END -->

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

## Known Issues
- 無

## Module Lessons
- D01: StalenessAnalyzer 測試可直接 stub MemoryWriter 介面（vi.fn()），不需要 mock fs，測試語義最清晰

## Relations
- extension（父卡：由外掛主流程編排）
- watcher（兄弟卡：上游事件來源）
- writer（兄弟卡：下游警報寫入）
- index-manager（根層共用服務：讀取反向映射表、標記 Dirty）

## Applicable Skills
- test-patterns
