---
name: mem-mcp-tools
description: |
  專案記憶：MCP 工具介面模組（第二階段）。 Use when: 處理MCP伺服器註冊、工具路由、AI工具呼叫介面時載入。
last_updated: "2026-03-28T09:50:00+08:00"
status: stable
staleness: 0
---


# MCP Tool Interface — 工具介面記憶（第二階段）

> 本模組目前進入第二階段實作規劃，提供標準化 AI 呼叫工具。

## Tracked Files
- src/mcp-server.ts
- src/mcp-handlers.ts
- src/tests/mcp-handlers.test.ts
- package.json

## Key Decisions
- D01: 獨立出 `mcp-server.ts` 作為標準 stdio Server 入口，與 VS Code Extension 解耦，雙核心透過實體檔案系統互動。
- D02: 首發提供 3 個核心工具：`memory_list`, `memory_read`, `memory_update`，取代直接檔案寫入。
- D05: 新增 `mcp-handlers.ts` 商業邏輯解耦層，三個純函式（handleMemoryList/Read/Update）從 MCP SDK 解耦，讓工具邏輯可獨立進行 vitest 單元測試。`mcp-server.ts` 僅保留 SDK 連接與路由職責。

## Known Issues
- 無

## Module Lessons
- D03: MCP 伺服器使用 `process.cwd()` 作為工作區路徑會導致 Gateway 啟動時讀取到錯誤的工作區。**正確做法**：透過 `--workspace` 命令列參數接受工作區路徑，並在 Gateway 設定檔（`cartridge-system.json`）中明確傳入目標路徑。
- D04: `npm run package`（vsce package）不會重新執行 tsup 編譯。修改 `src/mcp-server.ts` 後，必須先執行 `npm run build` 更新 `dist/`，再執行 `gateway__rescan` 才能使修復生效。
- D06: 測試 mcp-handlers 時使用 `vi.mock('fs/promises')` 搭配 `vi.mocked().mockResolvedValue()` 即可完全隔離磁碟 I/O。`writeFile` 回傳 `undefined`（void）需使用 `mockResolvedValue(undefined)` 而非 `mockResolvedValue()`。

## Relations
- mem-index-manager（查詢卡匣資料）
- mem-analyzer（查詢過期狀態）
- mem-watcher（控制監聽生命週期）
