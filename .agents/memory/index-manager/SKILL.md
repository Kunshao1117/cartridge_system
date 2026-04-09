---
name: index-manager
description: |
  專案記憶：記憶索引管理器模組。管理卡匣索引、檔案反向映射、離線偵測、未歸屬檔案池。Use when: 處理卡匣索引、檔案反向映射、持久化讀寫時載入。
last_updated: '2026-04-09T18:56:50+08:00'
status: stale
staleness: 0
metadata:
  author: antigravity
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:write'
---

# Cartridge Index Manager — 索引管理器記憶

## Tracked Files
- src/index-manager.ts
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

## Key Decisions Addendum
- D07: parseTrackedFiles 在解析前統一將 CRLF (`\r\n`) 正規化為 LF (`\n`)
- D08: filter 過濾 `#` / `<` / `←` 開頭的虛假行

## Known Issues
- 無

## Module Lessons
- D05: 測試 detectMissedChanges() 時需 mock node:fs 的 statSync 來控制 mtimeMs 回傳值
- D13: 新增必要欄位時，所有測試的 fixture 物件也必須同步更新
- D18: v1.0 scopePath 技術債教訓 — findOwner() 的最長前綴匹配會靠靜呑噥全部 scopePath 範圍內的新檔案，阻既幽靈池又封死過期計分。已全面移除。

## Relations
- watcher（extension 子卡：提供監聽檔案清單）
- analyzer（extension 子卡：接收過期指數更新）
- mcp-tools（根層模組：第二階段對外暴露查詢能力）
- gitignore-filter（根層模組：detectUntrackedFiles 需要 GitignoreFilter 實例）

## Applicable Skills
- test-patterns
