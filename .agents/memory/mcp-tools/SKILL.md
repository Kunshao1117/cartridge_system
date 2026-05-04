---
name: mcp-tools
description: |
  專案記憶：MCP 工具介面模組（第三階段）。 Use when: 處理MCP伺服器註冊、工具路由、AI工具呼叫介面時載入。
last_updated: '2026-05-04T22:35:27+08:00'
status: stable
staleness: 0
metadata:
  author: antigravity
  version: '3.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
    - 'filesystem:write'
---

# MCP Tool Interface — 工具介面記憶（第三階段）

> 本模組提供標準化 AI 呼叫工具，支援跨專案動態路徑解析。
> v3.0 設計哲學：**MCP 只讀 + 元資料同步，內容寫入完全由 AI 原生工具負責。**

## Tracked Files

- src/mcp-server.ts
- src/mcp-handlers.ts
- src/path-guard.ts
- src/timestamp.ts
- src/tests/mcp-handlers.test.ts
- src/tests/path-guard.test.ts
- src/tests/timestamp.test.ts

## Key Decisions

- D01: 獨立出 `mcp-server.ts` 作為標準 stdio Server 入口，與 VS Code Extension 解耦，雙核心透過實體檔案系統互動。
- D02: 首發提供 3 個核心工具：`memory_list`, `memory_read`, `memory_update`，取代直接檔案寫入。
- D05: 新增 `mcp-handlers.ts` 商業邏輯解耦層，三個純函式（handleMemoryList/Read/Update）從 MCP SDK 解耦，讓工具邏輯可獨立進行 vitest 單元測試。`mcp-server.ts` 僅保留 SDK 連接與路由職責。
- D07: 三個工具均新增必填參數 `projectRoot`，呼叫方必須明確傳入目標專案根目錄路徑。未傳直接回傳 Validation Error，廢棄啟動時固定路徑的 fallback 設計。
- D09: `projectRoot` 路徑安全強化 — Zod schema 新增 `refine(isAbsolute + 無 ..)` 格式守衛 + `validateProjectRoot()` 語意守衛雙層防禦，阻擋路徑穿越攻擊。
- D10: 時間戳生成統一改為 `getTaiwanISO()`（`Intl.DateTimeFormat` + `toLocaleString('sv')`），取代 `Date.now() + tzOffset` 手動偏移。
- D11: frontmatter 更新從正則替換改為 `gray-matter` 結構化解析 → 修改 → 序列化（`updateFrontmatterFields()`），完整支援單引號、雙引號、無引號格式。
- D16: memory_list 回傳增強 — 每個模組包含 trackedFilesCount 欄位。追蹤超過 8 個檔案的模組自動附帶拆分建議。
- D17: memory_read 回傳增強 — 讀取記憶卡時若索引存在，附加父子節點提示（提示 AI 同時讀取父卡獲取共用架構脈絡）。
- D19: 新增 resolveSkillPath() 共用路徑解析函式，三層策略：索引查找（最快）→ 平面路徑回退（向後相容）→ 遞迴搜尋（最後手段）。
- D20: memory_list 回傳新增 depth 欄位，取代過度暴露的 parent 細節
- D22: memory_list 改為優先從索引檔讀取全部卡匣（含巢狀子卡），不再依賴目錄掃描。
- D26: 職責分離重構 — 新增 `memory_commit` 工具，將記憶卡更新拆為兩步驟：(1) AI 用原生工具寫入 SKILL.md 內容；(2) 呼叫 memory_commit 完成後設資料同步。memory_update 的 patch/append 模式標記為已棄用。
- D28: memory_commit 與 memory_update 作業結束前，新增 `stripWarningBlock()` 手續自動拔除過期 Markdown 警報。
- D29: v3.0.0 **[重大]** MCP 工具集職責純化 — 正式移除 `memory_update` 工具（含 `memoryUpdateSchema`、`handleMemoryUpdate` 函式及 13 個對應測試）。MCP API 確立「只讀 + 元資料同步」設計哲學：`memory_list`/`memory_read`/`memory_status` 為純讀取工具，`memory_commit` 為唯一的後設資料同步工具，內容寫入完全由 AI 原生工具（`write_to_file` / `replace_file_content`）負責。測試總數：105 → 94 個。

## Known Issues

- 無

## Module Lessons

- D03: MCP 伺服器使用 `process.cwd()` 作為工作區路徑會導致 Gateway 啟動時讀取到錯誤的工作區。**正確做法**：透過 `--workspace` 命令列參數接受工作區路徑。（現已由 D07 取代）
- D04: `npm run package`（vsce package）不會重新執行 tsup 編譯。修改 `src/mcp-server.ts` 後，必須先執行 `npm run build` 更新 `dist/`，再執行 `gateway__rescan` 才能使修復生效。
- D06: 測試 mcp-handlers 時使用 `vi.mock('fs/promises')` 搭配 `vi.mocked().mockResolvedValue()` 即可完全隔離磁碟 I/O。
- D08: 跨專案參數必填設計原則 — 共用 MCP 工具若與工作目錄相關，應將路徑設為必填而非選填 fallback。
- D09: 路徑驗證需雙層防禦：Zod refine 做格式守衛（快速失敗），`validateProjectRoot` 做語意守衛（正規化 + 穿越檢查）。
- D10: `toLocaleString('sv', { timeZone })` 是取得近似 ISO 格式最簡潔的方法。
- D11: `gray-matter` 的 `matter.stringify(content, frontmatter)` 會自動處理 YAML 序列化。
- D28: memory_commit 的二步流被證實為唯一穩定路徑。已全面廢除 MCP 的 append 與 patch 實務。
- D26: handleMemoryCommit 從 index-manager.ts 匯入 parseTrackedFiles() 來重新解析追蹤檔案清單，確保索引與 SKILL.md 內容同步。

## Relations

- extension（父卡：啟動外掛編排）
- index-manager（共用服務：索引讀寫）

## Applicable Skills

- security-sre
- test-patterns
