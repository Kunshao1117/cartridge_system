---
name: mem-injector
description: >
  專案記憶：基底卡匣注入器模組。
  Use when: 處理基礎技能注入、範本比對、專案初始化佈署時載入。
last_updated: "2026-03-28T06:38:42+08:00"
status: stable
staleness: 0
---

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
- mem-watcher（注入完成後啟動監聽引擎）
