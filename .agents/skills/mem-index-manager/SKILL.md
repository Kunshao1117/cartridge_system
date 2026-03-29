---
name: mem-index-manager
description: |
  專案記憶：記憶索引管理器模組。 Use when: 處理卡匣索引、檔案反向映射、持久化讀寫時載入。
last_updated: '2026-03-29T14:22:00+08:00'
status: stable
staleness: 0
---

# Cartridge Index Manager — 索引管理器記憶

## Tracked Files
- src/index-manager.ts
- src/tests/index-manager.test.ts

## Key Decisions
- D01: CartridgeIndexManager 負責掃描、持久化與讀取 cartridge_index.json
- D02: fileMap 以 filePath 為 key、cartridgeId[] 為 value 的反向映射
- D03: pendingChanges 去重邏輯：同一檔案同一事件類型只記錄一筆
- D04: 追蹤檔案解析使用正則表達式匹配 ## Tracked Files 區段
- D05: scan() 解析 frontmatter 中的 parent 和 scopePath 欄位，存入 CartridgeEntry
- D06: findOwner() 使用最長前綴匹配算法，從所有記憶卡的 scopePath 中找出最精確的歸屬
- D07: getChildren() 查詢指定記憶卡的子卡清單（透過 parent 欄位反查）
- D08: scan() 改為遞迴掃描（scanRecursive），最大 4 層深度，從目錄結構自動推導 depth 和 parent（取代 frontmatter 宣告）
- D09: 新增 MAX_SCAN_DEPTH 常數（4），始終從第 1 層開始递增 depth
- D10: 新增 resolveModulePath() 輔助方法，從索引解析模組名稱為絕對檔案路徑

## Known Issues
- 無

## Key Decisions Addendum
- D07: parseTrackedFiles 在解析前統一將 CRLF (`\r\n`) 正規化為 LF (`\n`)，修復 Windows 儲存的 SKILL.md 無法解析追蹤路徑的問題
- D08: filter 過濾 `#` / `<` / `←` 開頭的虛假行，避免 ### 分組標題、HTML 註解、備註殸留污染 fileMap

## Module Lessons
- D01: staleness 重設後必須同步呼叫 clearPendingChanges()，否則去重邏輯會封鎖後續的相同檔案事件，導致再次修改無法觸發計分。
- D02: parseTrackedFiles() 必須清除 Markdown 格式符號再存入索引。若記憶卡寫 `` `src/file.ts` `` 或 `src/file.ts (description)`，解析出的路徑會帶反引號或說明文字，導致監聽器永遠跟蹤不到實際檔案路徑。已加入三步淨化：去反引號、截斷說明文字。
- D03: 測試 CartridgeIndexManager 時可直接操作 manager['index'] 私有屬性注入假資料，跳過有 fs 依賴的 scan()，使單元測試無需 mock fs。
- D04: 遞迴掃描必須給 readdir 可能拋错的目錄加 try-catch，否則單一損壞的子目錄會導致整個掃描失敗。

## Relations
- mem-watcher（mem-extension 子卡：提供監聽檔案清單）
- mem-analyzer（mem-extension 子卡：接收過期指數更新）
- mem-mcp-tools（根層模組：第二階段對外暴露查詢能力）
