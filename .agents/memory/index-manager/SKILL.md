---
name: index-manager
description: |
  專案記憶：記憶索引管理器模組。 Use when: 處理卡匣索引、檔案反向映射、持久化讀寫時載入。
last_updated: '2026-04-02T18:11:37+08:00'
status: stable
staleness: 0
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
- D05: scan() 解析 frontmatter 中的 parent 和 scopePath 欄位，存入 CartridgeEntry
- D06: findOwner() 使用最長前綴匹配算法，從所有記憶卡的 scopePath 中找出最精確的歸屬
- D07: getChildren() 查詢指定記憶卡的子卡清單（透過 parent 欄位反查）
- D08: scan() 改為遞迴掃描（scanRecursive），最大 4 層深度，從目錄結構自動推導 depth 和 parent（取代 frontmatter 宣告）
- D09: 新增 MAX_SCAN_DEPTH 常數（4），始終從第 1 層開始递增 depth
- D10: 新增 resolveModulePath() 輔助方法，從索引解析模組名稱為絕對檔案路徑
- D11: v4.0 路徑遷移 — scan() 先掃 .agents/memory/（無  前綴限制），再掃 .agents/skills/（保留  前綴過濾）實現向後相容。scanRecursive() 新增 requireMemPrefix 參數控制過濾策略
- D12: v0.9.0 索引檔搬遷 — `cartridge_index.json`（根目錄）遷移至 `.cartridge/index.json`，與新增的 `.cartridge/injector.json` 統一存放在 `.cartridge/` 運行時狀態目錄。`persist()` 新增目錄自動建立邏輯。`CartridgeConfig` 新增 `cartridgeDir` 欄位。
## Known Issues
- 無

## Key Decisions Addendum
- D07: parseTrackedFiles 在解析前統一將 CRLF (`\r\n`) 正規化為 LF (`\n`)，修復 Windows 儲存的 SKILL.md 無法解析追蹤路徑的問題
- D08: filter 過濾 `#` / `<` / `←` 開頭的虛假行，避免 ### 分組標題、HTML 註解、備註殸留污染 fileMap

## Module Lessons
### D05
D05: 測試 detectMissedChanges() 時需 mock node:fs 的 statSync 來控制 mtimeMs 回傳值。使用 vi.mock('node:fs', async (importOriginal) => {...}) 模式可保留模組其餘原始行為，只覆蓋需要控制的方法。

## Relations
- watcher（extension 子卡：提供監聽檔案清單）
- analyzer（extension 子卡：接收過期指數更新）
- mcp-tools（根層模組：第二階段對外暴露查詢能力）
- D08: `detectMissedChanges()` 新增至索引管理器，在 scan 之後自動比對追蹤檔案的 mtime 與記憶卡的 lastUpdated。跳過目錄型追蹤路徑（尾部 `/`）。staleness 重算使用與 `StalenessAnalyzer.calculateStaleness()` 相同的計分權重。

## Applicable Skills
- test-patterns
