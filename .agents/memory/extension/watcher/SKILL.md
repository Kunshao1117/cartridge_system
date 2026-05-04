---
name: watcher
description: |
  專案記憶：檔案監聯引擎模組。 Use when: 處理檔案監聽、原生Watcher設定、監聽生命週期管理時載入。
last_updated: '2026-04-12T12:43:19.822Z'
staleness: 0
status: stable
---


# Watcher Engine — 監聽引擎記憶

## Tracked Files

- src/watcher.ts

## Key Decisions

- D01: v2.0 全面棄用 chokidar，改用 VS Code 原生 `vscode.workspace.createFileSystemWatcher`
- D02: 僅監聽記憶卡中明確追蹤的檔案，非整個專案目錄
- D03: 新增 `debounceMap` 機制：每次變更延遲 300ms 以合併密集 I/O 事件，徹底消除頻繁存檔時的 UI 抖動
- D04: 原生 Watcher 傳入的 uri 需要解開 fsPath 並透過 `path.relative` 轉為相對於 projectRoot 的相對路徑
- D05: start() 同時加入記憶卡 SKILL.md 路徑，用於偵測 AI 更新記憶，更新時觸發刷新行為
- D06: handleEvent() 修正未追蹤檔案加入機制：任何非受追蹤事件，如果是 `.gitignore` 變更，則重掃；否則加入幽靈清單
- D07: `.gitignore` 的儲存事件（`change`）被捕捉時，主動呼叫 `indexManager.refilterUntrackedFiles` 更新幽靈池
- D08: v2.0 移除了舊版的 `scopePath` 監聽殘留，將所有幽靈事件完整打入未歸屬檔案池
- D09: (2026-04-12) 修復 v2.0 重構遺漏，將 `MemoryWriter` 重新注入並完整呼叫 `markDirty()` 與 `checkAndCleanWarning()`，確保記憶變更時 TreeView/StatusBar/CodeLens 即時聯動並自動移除 Markdown 警報。

## Known Issues

- 無

## Module Lessons

- D01: watcher 與 UI 層必須透過 callback hook 解耦
- D02: 原生 FileSystemWatcher 沒有明確的 `ready` 事件，這對測試與啟動時序控制時會有差異，需仰賴 `setTimeout` 或明確的狀態等待。
- D03: 取代 chokidar 帶來極大的穩定性提昇與包容積減少，但也代表此模組從此高度耦合於 vscode API。

## Relations

- extension（父卡：外掛啟動後委託監聽）
- analyzer（兄弟卡：接收異動事件的下游消費者）
- index-manager（根層共用服務：提供需監聽的檔案清單）

## Applicable Skills

- test-patterns
