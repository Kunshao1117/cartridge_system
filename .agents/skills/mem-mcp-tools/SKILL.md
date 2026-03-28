---
name: mem-mcp-tools
description: |
  專案記憶：MCP 工具介面模組（第二階段）。 Use when: 處理MCP伺服器註冊、工具路由、AI工具呼叫介面時載入。
last_updated: '2026-03-28T18:20:36+08:00'
status: stable
staleness: 0
---

# MCP Tool Interface — 工具介面記憶（第二階段）

> 本模組提供標準化 AI 呼叫工具，支援跨專案動態路徑解析。

## Tracked Files
- src/mcp-server.ts
- src/mcp-handlers.ts
- src/path-guard.ts
- src/timestamp.ts
- src/tests/mcp-handlers.test.ts
- src/tests/path-guard.test.ts
- src/tests/timestamp.test.ts
- package.json
## Key Decisions
- D01: 獨立出 `mcp-server.ts` 作為標準 stdio Server 入口，與 VS Code Extension 解耦，雙核心透過實體檔案系統互動。
- D02: 首發提供 3 個核心工具：`memory_list`, `memory_read`, `memory_update`，取代直接檔案寫入。
- D05: 新增 `mcp-handlers.ts` 商業邏輯解耦層，三個純函式（handleMemoryList/Read/Update）從 MCP SDK 解耦，讓工具邏輯可獨立進行 vitest 單元測試。`mcp-server.ts` 僅保留 SDK 連接與路由職責。
- D07: 三個工具均新增必填參數 `projectRoot`，呼叫方必須明確傳入目標專案根目錄路徑。未傳直接回傳 Validation Error，廢棄啟動時固定路徑的 fallback 設計。Handler 函式簽名移除 `agentsDir` 參數，改由內部從 `args.projectRoot` 動態組合 `.agents/skills` 路徑。
- D09: `projectRoot` 路徑安全強化 — Zod schema 新增 `refine(isAbsolute + 無 ..)` 格式守衛 + `validateProjectRoot()` 語意守衛雙層防禦，阻擋路徑穿越攻擊。
- D10: 時間戳生成統一改為 `getTaiwanISO()`（`Intl.DateTimeFormat` + `toLocaleString('sv')`），取代 `Date.now() + tzOffset` 手動偏移。
- D11: frontmatter 更新從正則替換改為 `gray-matter` 結構化解析 → 修改 → 序列化（`updateFrontmatterFields()`），完整支援單引號、雙引號、無引號格式。
- D12: Read-Before-Write 保護機制（已演進為 D13 雙模式）
- D13: memory_update 雙模式寫入 — mode='replace'(預設)整張替換 / mode='append'附加至末尾。AI 可明確選擇寫入策略，避免重複段落堆疊。
- D14: memory_update 新增 patch 模式（區段級替換）— 以 `##` 為分割粒度，同名區段就地替換、新區段附加到末尾、未提及區段保持不動。新增 `parseSections()` 段落分割函式（含 CRLF 正規化、程式碼區塊守衛）和 `mergeSections()` 合併函式（含標題正規化比對）。patch 內容必須含至少一個 `##` 區段否則回傳錯誤。回傳結果包含替換/新增統計。

## Known Issues
- 無

## Module Lessons
- D03: MCP 伺服器使用 `process.cwd()` 作為工作區路徑會導致 Gateway 啟動時讀取到錯誤的工作區。**正確做法**：透過 `--workspace` 命令列參數接受工作區路徑，並在 Gateway 設定檔（`cartridge-system.json`）中明確傳入目標路徑。（現已由 D07 取代，`--workspace` 參數不再需要）
- D04: `npm run package`（vsce package）不會重新執行 tsup 編譯。修改 `src/mcp-server.ts` 後，必須先執行 `npm run build` 更新 `dist/`，再執行 `gateway__rescan` 才能使修復生效。
- D06: 測試 mcp-handlers 時使用 `vi.mock('fs/promises')` 搭配 `vi.mocked().mockResolvedValue()` 即可完全隔離磁碟 I/O。`writeFile` 回傳 `undefined`（void）需使用 `mockResolvedValue(undefined)` 而非 `mockResolvedValue()`。
- D08: 跨專案參數必填設計原則 — 共用 MCP 工具若與工作目錄相關，應將路徑設為必填而非選填 fallback，強制呼叫方在每次呼叫時明確宣告操作對象，避免跨專案誤讀。
- D09: 路徑驗證需雙層防禦：Zod refine 做格式守衛（快速失敗），`validateProjectRoot` 做語意守衛（正規化 + 穿越檢查）。單層防禦不夠，因為 Zod refine 無法做 `path.normalize`。
- D10: `toLocaleString('sv', { timeZone })` 是取得近似 ISO 格式最簡潔的方法，瑞典語系的日期格式天生接近 ISO 8601。
- D11: `gray-matter` 的 `matter.stringify(content, frontmatter)` 會自動處理 YAML 序列化，不需要手動拼接引號或格式。
- D12: `memory_update` 工具明確區分兩種呼叫語意：mode='replace' 傳入完整 SKILL.md 內容（含 frontmatter）；mode='append' 傳入純差分段落不含 frontmatter。測試中，replace 測試不需 readFile mock，append 測試需模擬現有檔案的 readFile 回傳。
- D14: Markdown 段落分割使用字元位置切割（substring）而非逐行拼接，可精確保留原始格式（包含空行、縮排等）。合併時保持原檔區段順序，新區段附加到末尾。patch 模式的測試需同時模擬 readFile（現有檔案）和 writeFile，驗證未提及區段的完整保留。
## Relations
- mem-index-manager（查詢卡匣資料）
- mem-analyzer（查詢過期狀態）
- mem-watcher（控制監聽生命週期）
