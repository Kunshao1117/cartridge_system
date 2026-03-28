---
name: mem-index-manager
description: |
  專案記憶：記憶索引管理器模組。 Use when: 處理卡匣索引、檔案反向映射、持久化讀寫時載入。
last_updated: '2026-03-28T17:10:00+08:00'
status: stable
staleness: 0

---

# Cartridge Index Manager — 索引管理器記憶

## Tracked Files
- src/index-manager.ts
- src/tests/index-manager.test.ts

## Key Decisions
- D01: 索引持久化為 JSON 格式（cartridge_index.json）
- D02: 維護雙向映射：卡匣→檔案 與 檔案→卡匣
- D03: 啟動時自動掃描 .agents/skills/mem-*/SKILL.md 建立索引
- D04: 追蹤檔案解析使用正則表達式匹配 ## Tracked Files 區段
- D05: 路徑正規化使用 forward slash 以跨平台相容
- D06: parseTrackedFiles 函式匯出（export），使 vitest 可直接引入並測試路徑淨化邏輯

## Known Issues
- 無

## Key Decisions Addendum
- D07: parseTrackedFiles 在解析前統一將 CRLF (`\r\n`) 正規化為 LF (`\n`)，修復 Windows 儲存的 SKILL.md 無法解析追蹤路徑的問題
- D08: filter 過濾 `#` / `<` / `←` 開頭的虛假行，避免 ### 分組標題、HTML 註解、備註殸留污染 fileMap

## Module Lessons
- D01: staleness 重設後必須同步呼叫 clearPendingChanges()，否則去重邏輯會封鎖後續的相同檔案事件，導致再次修改無法觸發計分。
- D02: parseTrackedFiles() 必須清除 Markdown 格式符號再存入索引。若記憶卡寫 `` `src/file.ts` `` 或 `src/file.ts (description)`，解析出的路徑會帶反引號或說明文字，導致監聽器永遠跟蹤不到實際檔案路徑。已加入三步淨化：去反引號、截斷說明文字。
- D03: 測試 CartridgeIndexManager 時可直接操作 manager['index'] 私有屬性注入假資料，跳過有 fs 依賴的 scan()，使單元測試無需 mock fs。

## Relations
- mem-watcher（提供監聽檔案清單）
- mem-analyzer（接收過期指數更新）
- mem-mcp-tools（第二階段對外暴露查詢能力）
