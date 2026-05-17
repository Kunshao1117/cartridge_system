---
name: index-manager
description: >
  專案記憶：記憶索引管理器模組。管理卡匣索引、檔案反向映射、離線偵測、未歸屬檔案池、Cache-First 持久化。Use when:
  處理卡匣索引、檔案反向映射、持久化讀寫時載入。
last_updated: '2026-05-17T21:52:22+08:00'
status: stable
staleness: 0
dependencies:
  - core-types
metadata:
  author: antigravity
  version: '3.1'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:write'
---

# Cartridge Index Manager — 索引管理器記憶

## Tracked Files

- src/index-manager.ts
- src/smart-owner.ts
- src/tests/index-manager.test.ts
- src/tests/detect-missed-changes.test.ts

## Key Decisions

- D01: CartridgeIndexManager 負責掃描、持久化與讀取索引檔（`.cartridge/index.json`）
- D02: fileMap 以 filePath 為 key、cartridgeId[] 為 value 的反向映射
- D03: pendingChanges 去重邏輯：同一檔案同一事件類型只記錄一筆
- D04: 追蹤檔案解析使用正則表達式匹配 ## Tracked Files 區段
- D05: scan() 解析 frontmatter 中的 parent，存入 CartridgeEntry。已於 v1.0 完全移除 scopePath
- D06: 廢除 findOwner() 邏輯，不再嘗試自動歸屬新檔案，確保所有未追蹤檔案進入幽靈池
- D07: getChildren() 查詢指定記憶卡的子卡清單（透過 parent 欄位反查）
- D08: scan() 改為遞迴掃描（scanRecursive），最大 4 層深度，從目錄結構自動推導 depth 和 parent（取代 frontmatter 宣告）
- D09: 新增 MAX_SCAN_DEPTH 常數（4），始終從第 1 層開始递增 depth
- D10: 新增 resolveModulePath() 輔助方法，從索引解析模組名稱為絕對檔案路徑
- D11: v4.0 路徑遷移 — scan() 先掃 .agents/memory/（無前綴限制），再掃 .agents/skills/（保留前綴過濾）實現向後相容
- D12: v0.9.0 索引檔搬遷 — `.cartridge/index.json`
- D13: v1.0 離線刪除偵測修復 — detectMissedChanges() 的 catch 區塊改為記錄 unlink 事件，取代靜默忽略
- D14: v1.0 巢狀 ID 碰撞防護 — cartridgeId 改用 dot-separated 路徑（例如 api.auth），根層不受影響
- D15: v1.0 語意描述保存 — scanRecursive() 從 frontmatter 讀取 description 並存入 CartridgeEntry
- D16: v1.0 未歸屬檔案池 — 新增 addUntrackedFile/removeUntrackedFile/getUntrackedFiles 管理方法
- D17: v1.0 全專案目錄掃描 — 新增 detectUntrackedFiles(gitignoreFilter)，掃描不在 gitignore/已追蹤/已歸屬範圍中的檔案
- D18: v1.0 幽靈雙向即時過濾 — 新增 `clearUntrackedFiles()` 和 `refilterUntrackedFiles()` 處理檔案刪除或 `.gitignore` 變更的清單刷新
- D19: v2.0 Cache-First 持久化 — 新增 isDirty flag + markDirty() + flushIfDirty()，磁碟寫入延遲至安全時機（deactivate / 心跳 / 手動指令）
- D20: v2.0 onChanged callback hook — 由 extension.ts 注入，MCP Server 可安全忽略（因 MCP 端不依賴 vscode API）
- D21: v2.0 detectUntrackedFiles 簽名變更 — 不再內部呼叫 scanDirectory，改為接受外部傳入的 `allFiles: string[]` 參數，保持模組不依賴 vscode API
- D22: v2.0 persist() 保留 public — MCP Server 的 memory_commit 需要在明確保存時機直接呼叫
- D23: v4.0 幽靈追蹤偵測 — CartridgeEntry 新增 ghostFiles: string[] 欄位，記錄已追蹤但磁碟不存在的檔案
- D24: v4.0 markGhostFile() — 將已追蹤但已刪除的檔案標記為幽靈，支援去重；**注意：markGhostFile 本身不呼叫 markDirty()**，呼叫端需自行補呼叫
- D25: v4.0 clearGhostFiles() — memory_commit 後自動清除幽靈標記，確保同步後狀態乾淨
- D26: v4.0 validateTrackedFiles() — 全量磁碟存在性驗證，由啟動掃描或手動指令觸發，標記所有幽靈檔案
- D27: v4.0 detectMissedChanges() catch 區塊 — 除了記錄 unlink pendingChange，也同步呼叫 markGhostFile，確保啟動偵測與即時監聽的幽靈標記一致
- D28: v4.0 依賴推導同步載入 — `buildAndMergeDependencies()` 使用 `require()` 同步載入 `dependency-propagator.js`（而非 `await import()`），因為此方法需在 scan() 流程中保持同步一致性。與 mcp-handlers.ts 中 `handleMemoryDeps` 的非同步 `import()` 形成互補設計。
- D29: parseTrackedFiles 正則容錯升級 — 將 `## Tracked Files\n` 改為 `## Tracked Files[ \t]*\n`，接受行尾空格的標題；結束匹配改為 `\s*$` 支援 EOF 無換行情境，防止些微格式偏差導致 trackedFiles 靜默回傳空陣列。
- D30: scanRecursive I/O 防護 — `fs.readFileSync` 與 `matter()` 分別包裝 try-catch，YAML 格式錯誤或讀取失敗不再崩潰插件，改為 console.warn 跳過該卡片繼續掃描。
- D31: scanRecursive 格式異常偵測 — 解析後 trackedFiles 為空但 content 含 `## Tracked` 的卡片輸出 console.warn，協助診斷格式偏差（不阻斷掃描）。
- D32: buildAndMergeDependencies 崩潰防護 — 整個 require() 與依賴傳播區塊包裝 try-catch，依賴推導失敗時輸出 console.error 並繼續，不崩潰插件。
- D33: `shouldWarnEmptyTrackedFiles()` 區分格式偏差與刻意空追蹤卡；父層總覽、導航與歸檔卡若明確宣告不追蹤檔案，不再觸發 Tracked Files 解析為空警告。
- D34: 本卡 frontmatter `dependencies` 保留 `core-types`，因 `index-manager.ts` 實際匯入 `types.ts`、`config.ts` 與 `timestamp.ts`；若 core-types 過期，索引資料結構、路徑設定或時間戳語義都必須重新檢查。
- D35: `smart-owner.ts` 歸屬本卡，因它根據 `CartridgeIndex` 與 trackedFiles 提供未歸屬檔案推薦；extension 只消費推薦結果，不持有推薦演算法。
- D36: `refilterUntrackedFiles()` 是未歸屬池整理的共用入口；它只移除已被最新 fileMap 追蹤或已被 GitignoreFilter 排除的舊項目，不新增新的 untracked entry。
- D37: `refilterUntrackedFiles()` 若實際清掉項目會呼叫 `markDirty()`，確保 watcher / extension UI 與 `.cartridge/index.json` 可以在後續 flush 反映狀態。

## Key Decisions Addendum

- D07: parseTrackedFiles 在解析前統一將 CRLF (`\r\n`) 正規化為 LF (`\n`)
- D08: filter 過濾 `#` / `<` / `←` 開頭的虛假行

## Known Issues

- 無

## Module Lessons

- D05: 測試 detectMissedChanges() 時需 mock node:fs 的 statSync 來控制 mtimeMs 回傳值
- D13: 新增必要欄位時，所有測試的 fixture 物件也必須同步更新（v4.0 新增 ghostFiles 欄位即觸發此模式）
- D18: v1.0 scopePath 技術債教訓 — findOwner() 的最長前綴匹配會靠靜呑噥全部 scopePath 範圍內的新檔案，阻既幽靈池又封死過期計分。已全面移除。
- D19: 幽靈檔案池 (Untracked Files Pool) 被證實為極為重要之機制，讓索引不只管「已追蹤檔案」，更能幫助總監主動抓出落單的實作程式碼，徹底消滅盲區。
- L05: (2026-04-12) v2.0 EventEmitter 不可放 index-manager 內部，因其同時被 MCP Server 引用。改用 callback hook 確保跨環境安全。
- L06: (2026-05-06) ghostFiles 欄位以 Optional-safe 方式初始化（`existingEntry?.ghostFiles ?? []`），確保舊索引向後相容。
- L07: (2026-05-13) scanRecursive 的 readFileSync 與 matter() 解析各自需要獨立 try-catch，因為 readFileSync 可能拋 ENOENT/EPERM，而 matter() 可能拋 YAML syntax error，兩種 catch 行為相同（skip + warn）但原因不同，需要分開捕獲以便 debug 時區分原因。
- L08: (2026-05-15) Tracked Files 空區塊警告必須排除「刻意不追蹤」的父卡、導航卡與歸檔卡，否則 `memory_deps` 每次重建索引都會輸出無效噪音。
- L09: (2026-05-15) smart-owner 屬索引歸屬演算法，不屬 UI 層；放在 index-manager 可避免 extension 與 index-manager 的 Memory Graph 雙向依賴。
- L10: (2026-05-17) `scan()` 會保留既有 untracked pool，因此任何「記憶卡內容已變更」流程都必須在 scan 後呼叫 `refilterUntrackedFiles()`，否則已歸卡檔案仍會殘留於側邊欄待處理項目。

## Relations

- watcher（extension 子卡：提供監聯檔案清單）
- analyzer（extension 子卡：接收過期指數更新）
- mcp-tools（根層模組：第二階段對外暴露查詢能力）
- gitignore-filter（根層模組：detectUntrackedFiles 需要 GitignoreFilter 實例）

## Applicable Skills

- test-patterns

_此模組的子節點：index-manager.dep-engine_
