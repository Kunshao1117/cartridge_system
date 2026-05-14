---
name: extension
description: >
  專案記憶：VS Code 外掛入口與 UI 模組。 Use when:
  處理外掛啟動生命週期、指令註冊、狀態列/TreeView/CodeLens/智慧歸屬等 UI 更新時載入。
last_updated: '2026-05-15T02:21:20+08:00'
staleness: 0
status: stable
metadata:
  author: antigravity
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
    - 'filesystem:write'
---

# Extension & UI Layer — 外掛入口記憶

> 本模組為外掛的主入口和 UI 層，負責編排所有運行時子模組的啟動、監聽和關閉。

## Tracked Files

- src/extension.ts
- src/status-bar.ts
- src/treeview-provider.ts
- src/codelens-provider.ts

## Key Decisions

- D01: 指令註冊（registerCommand）必須放在 activate() 最前面，在任何可能失敗的初始化邏輯之前
- D02: activationEvents 包含 `workspaceContains:.agents` + `onStartupFinished` 雙保險，確保在 Antigravity IDE 中無條件啟動
- D03: `onStartupFinished` 確保外掛在 IDE 啟動後自動啟用，不需要使用者手動觸發
- D04: 外掛解除安裝（deactivate）時，停止 CartridgeWatcher 並 dispose 狀態列
- D05: 狀態列項目使用 `StatusBarAlignment.Left` 靠左顯示，priority 10
- D06: 健康報告（cartridge.status）以 VS Code OutputChannel 呈現詳細資訊，每張卡匣一行、按嚴重度排序
- D07: 狀態列採五層等級總分制 — 加總所有記憶卡過期指數，依總分對應顏色：🟢全部同步(0) / 🔵有變動(10+) / 🟡需注意(30+) / 🟠顯著過期(60+) / 🔴嚴重過期(100+)
- D08: 外掛啟動時需呼叫 `detectMissedChanges()` 偵測停機期間的檔案變動。此方法作用於 scan() 之後、persist() 之前。它比對追蹤檔案的 mtime 與記憶卡的 `lastUpdated`，補記遺漏的 pendingChange 並重算 staleness。
- D09: 在啟動流程中會自動讀取 VS Code 工作區設定，將 `.cartridge` 動態寫入 `files.exclude` 和 `search.exclude`
- D10: v1.0 啟動流程新增 GitignoreFilter 初始化，作為 detectUntrackedFiles 和 CartridgeWatcher 的共用依賴
- D11: v1.0 啟動流程在 detectMissedChanges 後呼叫 detectUntrackedFiles(gitignoreFilter)，掃描全專案未歸屬檔案
- D12: v1.0 狀態列新增 👻 未歸屬檔案計數提示，tooltip 顯示未歸屬清單
- D13: v1.0 健康報告 OutputChannel 新增獨立的「未歸屬檔案」面板
- D14: v1.0 新增 `cartridge.scanGhosts` 指令，獨立清空並重新掃描全專案的未歸屬幽靈檔案
- D15: 修復 `cartridge.scan` 行為，在重新掃描時補全 `detectMissedChanges` 和 `refilterUntrackedFiles` 的呼叫
- D16: 已完善啟動時與運行中的 GitignoreFilter 和幽靈池雙向驅動，確保不漏接任何離線修改。
- D17: v2.0 棄用 chokidar 第三方套件，改用 VS Code 原生 `createFileSystemWatcher` + 自製 debounceMap（300ms 穩定等待）
- D18: v2.0 watcher.ts 全面重寫，所有 `persist()` 呼叫替換為 `markDirty()`，磁碟 I/O 延遲至安全時機
- D19: v2.0 新增 TreeView 側邊欄（treeview-provider.ts），直接引用 RAM 索引，以樹狀結構展示記憶卡匣健康燈號與幽靈池
- D20: v2.0 新增 CodeLens 行內標記（codelens-provider.ts），在每個開啟的檔案頂部顯示歸屬狀態與過期指數（O(1) fileMap 查詢）
- D21: v2.0 新增智慧歸屬推薦入口；`smart-owner.ts` 已歸屬 `index-manager`，extension 僅在 UI 指令流程消費推薦結果。
- D22: v2.0 新增 `cartridge.attributeFile` 指令與右鍵選單，支援智慧推薦 + QuickPick 一鍵歸檔
- D23: v2.0 背景化幽靈掃描 — detectUntrackedFiles 改為 setTimeout 3 秒後異步執行，不阻塞啟動主序列
- D24: v2.0 安全心跳 — setInterval 每 5 分鐘呼叫 flushIfDirty()，確保崩潰最大損失窗口僅 5 分鐘
- D25: v2.0 deactivate 增加 clearInterval、flushIfDirty、treeProvider.dispose()、codeLensProvider.dispose() 完整資源釋放
- D26: v2.0 indexManager.onChanged callback hook 連動 UI 三兄弟（StatusBar + TreeView + CodeLens）即時刷新
- D27: (2026-04-12) 補全啟動時的 `detectMissedChanges` 流程，針對過期卡匣不僅更新 RAM 內 `staleness`，也會主動呼叫 `writer.injectWarning()` 植入警報區塊，修正了啟動無法顯示警報區塊的遺漏。
- D28: v4.0.1 狀態列 Tooltip 幽靈感知 — `status-bar.ts` 的 `buildTooltip()` 方法新增 `💀 幽靈檔案 (需清理)` 摘要區塊。遍歷 `index.cartridges` 過濾 `ghostFiles.length > 0` 的條目，列出受影響的記憶卡名稱與幽靈數量。修復了 TreeView 有 💀 圖示但 Tooltip 無顯示的設計缺口。
- D29: 新增 `cartridge.showGhostFileInfo` 指令 — 由 TreeView 的 💀 幽靈 TreeItem 點擊觸發，顯示 modal 警告框含幽靈路徑、所屬記憶卡、修復說明，提供「開啟記憶卡」快捷按鈕，解決點擊靜音問題。
- D30: `cartridge.status` 健康報告新增 `💀 幽靈檔案報告` OutputChannel 段落 — 過濾 ghostFiles.length > 0 的記憶卡，列出幽靈路徑與修復指引。
- D31: treeview-provider.ts 幽靈 TreeItem 補上 `item.command` 綁定 `cartridge.showGhostFileInfo`，參數傳遞 `{ filePath, cartridgeId }`。

## Known Issues

- 無

## Module Lessons

- D01: 指令必須先於工作區驗證和初始化邏輯之前完成註冊，否則 VS Code 在找不到指令時會回報 "command not found"
- D02: Antigravity IDE 使用獨立 CLI（`antigravity`），安裝時須用 `antigravity --install-extension`，不可用 `code`
- D07: VS Code 的 `showWarningMessage` 不支援多行格式，所有 `\n` 會被壓成一行。結構化多行報告必須改用 `OutputChannel` 呈現；**例外**：`{ modal: true, detail: string }` 模式下 detail 文字換行有效。
- L01: (2026-04-12) 修正前次更新的錯誤。移除對附屬子模組 (analyzer.ts, watcher.ts, writer.ts, injector.ts) 的越權追蹤，讓這些檔案回歸各自專屬的子卡。確保符合合約要求的「單一職責」與「粒度上限 (Max 8)」原則。
- L02: (2026-04-12) v2.0 watcher 棄用 chokidar 改用原生 Watcher。因原生 watcher 的事件參數是 Uri 非 string，所有事件處理器需要 `uri.fsPath` 拉出絕對路徑。
- L03: (2026-04-12) EventEmitter 不可放 index-manager 內部（MCP Server 共用模組不可依賴 vscode API），改用 `onChanged?: () => void` callback hook 模式。
- L04: (2026-04-12) 心跳 clearInterval 必須在 deactivate 中明確清除，否則會造成記憶體洩漏。

## Relations

- core-types（引用共用型別與設定工廠函式）
- index-manager（呼叫掃描以建立初始索引）
- mcp-tools（雙入口架構，共用檔案系統互動）

### 子模組

- injector（啟動時呼叫注入器確保記憶卡匣存在）
- watcher（啟動後委託監聽引擎管理檔案監聽）
- analyzer（過期分析器，接收監聽事件計算衰退指數）
- writer（記憶卡寫入器，植入/移除過期警報）
- gitignore-filter（提供 .gitignore 排除過濾）
- treeview-provider（v2.0 新增：側邊欄 TreeView 面板）
- codelens-provider（v2.0 新增：CodeLens 行內標記）
- index-manager（含 smart-owner：智慧歸屬推薦引擎）

## Applicable Skills

- code-quality
