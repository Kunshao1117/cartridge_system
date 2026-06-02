---
name: watcher
description: |
  專案記憶：檔案監聯引擎模組。 Use when: 處理檔案監聽、原生Watcher設定、監聽生命週期管理時載入。
last_updated: '2026-06-03T07:11:32+08:00'
staleness: 0
status: stable
metadata:
  author: antigravity
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
---

# Watcher Engine — 監聽引擎記憶

## Tracked Files

- src/watcher.ts
- src/tests/watcher.test.ts

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
- D10: v4.0 幽靈即時標記 — `handleEvent()` 在偵測到已追蹤檔案的 `unlink` 事件時，除了觸發過期分析，同步呼叫 `indexManager.markGhostFile()`，確保即時監聽路徑與啟動掃描路徑的幽靈標記一致。
- D11: 幽靈熱更新修復 — `handleEvent()` 時序 Bug：`processFileEvent()` 內部的 `markDirty()` 觸發 UI 刷新時 ghost 尚未寫入；`markGhostFile()` 結束後補一次 `this.indexManager.markDirty()`，確保 💀 圖示即時出現於 TreeView / StatusBar，無需手動重掃。
- D12: `debounceEvent()` unhandled Promise 修復 — setTimeout callback 內使用 `void this.handleEvent(...).catch(err => console.error(...))` 捕獲 async 例外，防止插件崩潰。
- D13: `handleSkillFileChange()` 在 `indexManager.scan()` 後必須呼叫 `indexManager.refilterUntrackedFiles(gitignoreFilter)`，讓已加入 `## Tracked Files` 的檔案立即移出未歸屬池。
- D14: `handleSkillFileChange()` 在 markDirty 後立即 `flushIfDirty()`，確保 `.cartridge/index.json` 與側邊欄狀態同步，不需要手動跑「重新掃描未歸屬檔案」。
- D15: 記憶卡 `SKILL.md` 事件必須在 `.gitignore` / exclude 檢查前優先處理；本 repo `.gitignore` 有 `.agents/*`，若先套 gitignore，`.agents/memory/**/SKILL.md` 會被擋掉，導致自動清除未歸屬提醒失效。
- D16: `handleSkillFileChange()` 比對索引 `skillPath` 時必須先正規化 Windows `\` 為 `/`，並在命中記憶卡後同時清除 pendingChanges 與 ghostFiles，避免 extension RAM index 在 MCP `memory_commit` 之後把舊索引狀態覆寫回磁碟。
- D17: vNext watcher 事件處理抽成 `monitoring/project-event-handler.ts` 共用 helper；VSIX watcher 保留 VS Code FileSystemWatcher 與 debounceMap，實際記憶卡優先、`.gitignore`、tracked/untracked/ghost 處理語意由共用 helper 執行，讓桌面版與插件規則一致。
- D18: 2026-06-03 桌面版發布前確認 `CartridgeWatcher.handleEvent()` 僅委派共用事件 helper，不改 VS Code watcher 註冊、300ms debounce、技能卡變更刷新與 UI callback 生命週期；此變更是共享語意抽取，不是插件監聽入口替換。

## Known Issues

- 無

## Module Lessons

- D01: watcher 與 UI 層必須透過 callback hook 解耦
- D02: 原生 FileSystemWatcher 沒有明確的 `ready` 事件，這對測試與啟動時序控制時會有差異，需仰賴 `setTimeout` 或明確的狀態等待。
- D03: 取代 chokidar 帶來極大的穩定性提昇與包容積減少，但也代表此模組從此高度耦合於 vscode API。
- L04: (2026-05-06) 幽靈標記必須在分析器 processFileEvent() 呼叫之後執行（即過期指數先更新），確保事件處理順序不影響過期計算邏輯。
- L05: (2026-05-13) markGhostFile() 本身不呼叫 markDirty()，所以在 handleEvent 中每次幽靈標記後都必須手動補呼叫 markDirty()，否則 UI 無法反映最新幽靈狀態。
- L06: (2026-05-17) 記憶卡變更事件與 memory_commit 是兩條不同同步路徑；watcher 需負責 extension RAM index / UI refresh，memory_commit 負責 MCP 磁碟索引同步，兩者都要清理 untrackedFiles。
- L07: (2026-05-17) `.agents/memory` 雖是 Git 白名單保留目錄，但 `.gitignore` 的 `.agents/*` 仍可能讓 runtime GitignoreFilter 回傳 ignored；watcher 的記憶卡路徑判斷不可放在 gitignore 檢查後面。
- L08: (2026-05-18) `.cartridge/index.json` 的 `skillPath` 可能由 Windows path relative 產生反斜線；watcher 接收到的 `relPath` 已被轉為斜線，未正規化會導致 `clearPendingChanges()` 漏跑，進而讓已存在的 ghost/pending drift 重新落地。
- L09: (2026-06-02) 高風險索引器與寫入器不應為桌面版重寫；以共用事件 helper 組合既有類別，可在不改公開契約的情況下支援 VSIX 與桌面監控。
- L10: (2026-06-03) 發布桌面版前需同時跑 VSIX watcher 回歸與桌面 monitoring event handler 測試，確保共用 helper 沒有讓插件忽略 `.agents/memory/**/SKILL.md` 優先處理或 `.gitignore` reload。

## Relations

- extension（父卡：外掛啟動後委託監聽）
- desktop-console.monitoring（共用事件處理 helper）
- analyzer（兄弟卡：接收異動事件的下游消費者）
- index-manager（根層共用服務：提供需監聽的檔案清單）

## Applicable Skills

- test-patterns
