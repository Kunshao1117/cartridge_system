---
name: injector
description: |
  專案記憶：基底卡匣注入器模組（已廢除）。 Use when: 查詢此模組的歷史架構決策紀錄。
  此模組已於 v3.0.0 正式廢除，不再管理任何作業中的原始碼檔案。
last_updated: '2026-05-04T22:27:06+08:00'
status: stable
staleness: 0
metadata:
  author: antigravity
  version: '3.0'
  origin: project
  memory_awareness: none
  tool_scope: []
---


# Core Injector — 基底注入器記憶（歸檔）

> ⚠️ 此模組已於 v3.0.0 廢除。`src/injector.ts`、`src/templates/`、`src/tests/injector.test.ts` 均已刪除。

## Tracked Files

- （無 — 所有追蹤檔案已刪除）

## Key Decisions

- D01: SHA-256 雜湊值比對範本與實體檔案
- D02: 絕不覆寫記憶卡匣（安全防護，相容新舊路徑：* 前綴 + memory/ 目錄）
- D03: 五態偵測：Missing / Outdated / Match / Skipped / Conflict
- D04: 黃金範本隨外掛原始碼打包
- D05: CommonJS 環境使用 \_\_dirname 取得範本路徑（非 import.meta.dirname）
- D06: v4.0 路徑遷移 — 安全防護擴展至 memory/ 目錄，除了 * 前綴判斷外新增 memory/ 路徑保護
- D07: v4.1 棄用日誌系統 — 移除 inject() 啟動時自動建立 .agents/logs 目錄的邏輯
- D08: v0.9.0 三方比對覆蓋決策 — 四象限覆蓋邏輯 + `.cartridge/injector.json` 狀態檔
- D09: v3.0.0 **[重大]** 整個注入器模組廢除 — 外掛安裝時不再自動注入任何 Antigravity 框架基礎結構（Rules/Workflows/Skills/Templates）。決策理由：框架作業系統的生命週期應由獨立的安裝腳本（如 install.ps1）管理，與記憶卡管理工具解耦。外掛職責純化為記憶卡匣的生命週期追蹤與 AI 代理 MCP 介面。`CoreInjector` 類別、`src/templates/` 目錄、`.cartridge/injector.json` 狀態檔均同步廢除。

## Known Issues

- 無

## Module Lessons

### D03

D03: 測試注入器時需 mock node:fs 和 node:crypto 兩個模組。existsSync 的呼叫順序包含 inject() 內部的目錄檢查和 listFilesRecursive 的前置檢查，必須按序列精確控制每一次回傳值。

## Relations

- extension（父卡：由外掛主流程編排）

## Applicable Skills

- security-sre
