---
name: mem-injector
description: |
  專案記憶：基底卡匣注入器模組。 Use when: 處理基礎技能注入、範本比對、專案初始化佈署時載入。
last_updated: '2026-03-30T02:10:00+08:00'
status: stale
staleness: 10
---
<!-- CARTRIDGE_SYSTEM_WARNING_START -->

> [!CAUTION]
> 🟠 **系統強制攔截**：此記憶已過期失真！
> 追蹤檔案異動：`src/injector.ts`（2026-03-30T02:42:16+08:00）
> AI 嚴禁基於此記憶施工，必須優先閱讀最新原始碼並更新此記憶卡。
> staleness: 10 | threshold: 🟠 顯著過期

<!-- CARTRIDGE_SYSTEM_WARNING_END -->

# Core Injector — 基底注入器記憶

## Tracked Files
- src/injector.ts
- src/templates/

## Key Decisions
- D01: SHA-256 雜湊值比對範本與實體檔案
- D02: 絕不覆蓋 mem-* 前綴的記憶卡匣（安全防護）
- D03: 三態偵測：Missing / Outdated / Match
- D04: 黃金範本隨外掛原始碼打包
- D05: CommonJS 環境使用 __dirname 取得範本路徑（非 import.meta.dirname）

## Known Issues
- 無

## Module Lessons
- D01: 從 ESM 轉 CommonJS 後，import.meta.dirname 需改為 __dirname

## Relations
- mem-extension（父卡：注入完成後交棒給外掛主流程）
- mem-watcher（兄弟卡：注入完成後啟動監聽引擎）
