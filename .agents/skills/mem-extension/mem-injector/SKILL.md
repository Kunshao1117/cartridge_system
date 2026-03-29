---
name: mem-injector
description: |
  專案記憶：基底卡匣注入器模組。 Use when: 處理基礎技能注入、範本比對、專案初始化佈署時載入。
last_updated: '2026-03-30T04:06:39+08:00'
status: stable
staleness: 0
---

# Core Injector — 基底注入器記憶

## Tracked Files
- src/injector.ts
- src/templates/
- src/tests/injector.test.ts

## Key Decisions
- D01: SHA-256 雜湊值比對範本與實體檔案
- D02: 絕不覆蓋 mem-* 前綴的記憶卡匣（安全防護）
- D03: 三態偵測：Missing / Outdated / Match
- D04: 黃金範本隨外掛原始碼打包
- D05: CommonJS 環境使用 __dirname 取得範本路徑（非 import.meta.dirname）

## Known Issues
- 無

## Module Lessons
### D03
D03: 測試注入器時需 mock node:fs 和 node:crypto 兩個模組。existsSync 的呼叫順序包含 inject() 內部的目錄檢查和 listFilesRecursive 的前置檢查，必須按序列精確控制每一次回傳值。
