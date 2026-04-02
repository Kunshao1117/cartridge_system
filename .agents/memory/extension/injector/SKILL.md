---
name: injector
description: |
  專案記憶：基底卡匣注入器模組。 Use when: 處理基礎技能注入、範本比對、專案初始化佈署時載入。
last_updated: '2026-04-02T18:11:36+08:00'
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
- D02: 絕不覆寫記憶卡匣（安全防護，相容新舊路徑：* 前綴 + memory/ 目錄）
- D03: 五態偵測：Missing / Outdated / Match / Skipped / Conflict
- D04: 黃金範本隨外掛原始碼打包
- D05: CommonJS 環境使用 __dirname 取得範本路徑（非 import.meta.dirname）
- D06: v4.0 路徑遷移 — 安全防護擴展至 memory/ 目錄，除了 * 前綴判斷外新增 memory/ 路徑保護
- D07: v4.1 棄用日誌系統 — 移除 inject() 啟動時自動建立 .agents/logs 目錄的邏輯，logs 目錄不再由注入器管理
- D08: v0.9.0 三方比對覆蓋決策 — 新增 `.cartridge/injector.json` 狀態檔記錄上次部署的範本雜湊（`deployedHashes`）。覆蓋邏輯從簡單二態比對升級為四象限決策：(1) 範本無更新+使用者無修改→靜默跳過（match）；(2) 範本無更新+使用者有修改→尊重客製化（skipped）；(3) 範本有更新+使用者無修改→安全覆蓋（outdated）；(4) 範本有更新+使用者有修改→依 `conflictPolicy` 設定決策（conflict/outdated/skipped）。支援三種衝突策略：`ask`（預設）、`alwaysUpdate`、`alwaysKeepMine`。
## Known Issues
- 無

## Module Lessons
### D03
D03: 測試注入器時需 mock node:fs 和 node:crypto 兩個模組。existsSync 的呼叫順序包含 inject() 內部的目錄檢查和 listFilesRecursive 的前置檢查，必須按序列精確控制每一次回傳值。

## Relations
- extension（父卡：由外掛主流程編排）
- watcher（兄弟卡：上游事件來源）
- writer（兄弟卡：下游警報寫入）
- index-manager（根層共用服務：讀取反向映射表、寫入過期指數）

## Applicable Skills
- security-sre
- test-patterns
