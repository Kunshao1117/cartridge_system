---
name: mem-analyzer
description: |
  專案記憶：過期分析器模組。 Use when: 處理過期指數計算、衰退演算法、異動事件處理時載入。
last_updated: '2026-03-30T03:13:01+08:00'
status: stable
staleness: 0
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
- D06: processFileEvent() 中 persist() 需 spy mock，避免測試觸及 fs；writer 以 vi.fn() stub 驗證呼叫次數與參數

## Known Issues
- 無
## Module Lessons
- D01: StalenessAnalyzer 測試可直接 stub MemoryWriter 介面（vi.fn()），不需要 mock fs，測試語義最清晰
- D02: manager.persist() 在整合流程中必須 spy mock（vi.spyOn），否則測試會嘗試寫入磁碟

## Relations
- mem-extension（父卡：由外掛主流程編排）
- mem-watcher（兄弟卡：上游事件來源）
- mem-writer（兄弟卡：下游警報寫入）
- mem-index-manager（根層共用服務：讀取反向映射表、寫入過期指數）
