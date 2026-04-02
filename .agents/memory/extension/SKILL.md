---
name: extension
description: |
  專案記憶：VS Code 外掛入口與狀態列模組。 Use when: 處理外掛啟動生命週期、指令註冊、狀態列 UI 更新時載入。
last_updated: '2026-04-02T20:03:10+08:00'
status: stale
staleness: 0
scopePath: src/
---
# Extension & Status Bar — 外掛入口記憶

> 本模組為外掛的主入口和 UI 層，負責編排所有運行時子模組的啟動、監聽和關閉。

## Tracked Files
- src/extension.ts
- src/status-bar.ts

## Key Decisions
- D01: 指令註冊（registerCommand）必須放在 activate() 最前面，在任何可能失敗的初始化邏輯之前
- D02: activationEvents 包含 `workspaceContains:.agents` + `onStartupFinished` 雙保險，確保在 Antigravity IDE 中無條件啟動
- D03: `onStartupFinished`  確保外掛在 IDE 啟動後自動啟用，不需要使用者手動觸發
- D04: 外掛解除安裝（deactivate）時，停止 CartridgeWatcher 並 dispose 狀態列
- D05: 狀態列項目使用 `StatusBarAlignment.Left` 靠左顯示，priority 10
- D06: 健康報告（cartridge.status）以 VS Code OutputChannel 呈現詳細資訊，每張卡匣一行、按嚴重度排序
- D07: 狀態列採五層等級總分制 — 加總所有記憶卡過期指數，依總分對應顏色：🟢全部同步(0) / 🔵有變動(10+) / 🟡需注意(30+) / 🟠顯著過期(60+) / 🔴嚴重過期(100+)
- D08: 外掛啟動時需呼叫 `detectMissedChanges()` 偵測停機期間的檔案變動。此方法作用於 scan() 之後、persist() 之前。它比對追蹤檔案的 mtime 與記憶卡的 `lastUpdated`，補記遺漏的 pendingChange 並重算 staleness。
- D09: 在啟動流程中會自動讀取 VS Code 工作區設定，將 `.cartridge` 動態寫入 `files.exclude` 和 `search.exclude`，以隱藏系統目錄。

## Known Issues
- 無

## Module Lessons
- D01: 指令必須先於工作區驗證和初始化邏輯之前完成註冊，否則 VS Code 在找不到指令時會回報 "command not found"
- D02: Antigravity IDE 使用獨立 CLI（`antigravity`），安裝時須用 `antigravity --install-extension`，不可用 `code`
- D07: VS Code 的 `showWarningMessage` 不支援多行格式，所有 `\n` 會被壓成一行。結構化多行報告必須改用 `OutputChannel` 呈現
## Relations
- core-types（引用共用型別與設定工廠函式）
- index-manager（呼叫掃描以建立初始索引）
- mcp-tools（雙入口架構，共用檔案系統互動）
### 子模組
- injector（啟動時呼叫注入器確保記憶卡匣存在）
- watcher（啟動後委託監聽引擎管理檔案監聽）
- analyzer（過期分析器，接收監聽事件計算衰退指數）
- writer（記憶卡寫入器，植入/移除過期警報）
- D08: 外掛啟動時需呼叫 `detectMissedChanges()` 偵測停機期間的檔案變動。此方法作用於 scan() 之後、persist() 之前。它比對追蹤檔案的 mtime 與記憶卡的 `lastUpdated`，補記遺漏的 pendingChange 並重算 staleness。

## Applicable Skills
- code-quality
