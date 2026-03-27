---
name: mem-analyzer
description: >
  專案記憶：過期分析器模組。
  Use when: 處理過期指數計算、衰退演算法、異動事件處理時載入。
last_updated: "2026-03-28T06:01:58+08:00"
status: stable
staleness: 0
---

# Staleness Analyzer — 過期分析器記憶

## Tracked Files
- src/analyzer.ts

## Key Decisions
- D01: 過期指數採四級閾值制（0/1-9/10-29/30+）
- D02: 檔案修改 +10 分、刪除 +20 分、新增 +5 分
- D03: 同一檔案重複修改不重複加分
- D04: 每 24 小時未更新的記憶卡 +1 時間衰退分
- D05: getStalenessLevel() 公開函式供其他模組共用

## Known Issues
- 無

## Module Lessons
- 無

## Relations
- mem-watcher（上游事件來源）
- mem-index-manager（讀取反向映射表、寫入過期指數）
