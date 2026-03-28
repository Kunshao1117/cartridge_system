---
name: mem-extension
description: >
  專案記憶：VS Code 外掛入口與狀態列模組。
  Use when: 處理外掛啟動生命週期、指令註冊、狀態列 UI 更新時載入。
last_updated: "2026-03-28T09:12:00+08:00"
status: stable
staleness: 0
---

# Extension & Status Bar — 外掛入口記憶

## Tracked Files
- src/extension.ts
- src/status-bar.ts

## Key Decisions
- D01: 指令註冊（registerCommand）必須放在 activate() 最前面，在任何可能失敗的初始化邏輯之前
- D02: activationEvents 包含 `workspaceContains:.agents` + `onStartupFinished` 雙保險，確保在 Antigravity IDE 中無條件啟動
- D03: `onStartupFinished`  確保外掛在 IDE 啟動後自動啟用，不需要使用者手動觸發
- D04: 外掛解除安裝（deactivate）時，停止 CartridgeWatcher 並 dispose 狀態列
- D05: 狀態列項目使用 `StatusBarAlignment.Right` 靠右顯示，priority 100
- D06: 健康報告（cartridge.status）以 VS Code OutputChannel 呈現詳細資訊

## Known Issues
- 無

## Module Lessons
- D01: 指令必須先於工作區驗證和初始化邏輯之前完成註冊，否則 VS Code 在找不到指令時會回報 "command not found"
- D02: Antigravity IDE 使用獨立 CLI（`antigravity`），安裝時須用 `antigravity --install-extension`，不可用 `code`

## Relations
- mem-injector（啟動時呼叫注入器確保記憶卡匣存在）
- mem-watcher（啟動後委託監聽引擎管理檔案監聽）
- mem-index-manager（呼叫掃描以建立初始索引）
