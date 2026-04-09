---
name: mcp-tools
description: |
  專案記憶：MCP 工具介面模組（第二階段）。 Use when: 處理MCP伺服器註冊、工具路由、AI工具呼叫介面時載入。
last_updated: '2026-04-09T18:56:49+08:00'
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
- D15: patch 模式閘門機制強化 — 三層防護：(1) `parseSubSections()` 兩層解析支援 `###` 子區段粒度合併，只替換提及的子區段保留未提及的（最小匹配原則）；(2) `dryRun` 參數支援操作前預覽，不寫入磁碟只回傳結構化 JSON 報告（含 replaced/added/removed/preserved 區段名稱列表與行數差異）；(3) 大幅刪減保護閘門，行數減少超過 30% 時自動產生警告。`MergeResult` 從數字計數升級為字串陣列追蹤具體區段名稱。`PatchReport` 介面定義結構化回傳格式。
- D16: memory_list 回傳增強 — 每個模組包含 trackedFilesCount 欄位。追蹤超過 8 個檔案的模組自動附帶拆分建議。已於 v1.0 去除對 scopePath 的依賴。
- D17: memory_read 回傳增強 — 讀取記憶卡時若索引存在，附加父子節點提示（提示 AI 同時讀取父卡獲取共用架構脈絡）。
- D18: memory_update patch 模式新增 pendingChanges 遺漏偵測 — 若 pendingChanges 中有 add 事件但 patch 未包含 ## Tracked Files 區段，在 warnings 中提醒 AI 確認是否需要更新追蹤清單。
- D19: 新增 resolveSkillPath() 共用路徑解析函式，三層策略：索引查找（最快）→ 平面路徑回退（向後相容）→ 遞迴搜尋（最後手段）。四個 MCP 工具全部改用此函式解析巢狀路徑。
- D20: memory_list 回傳新增 depth 欄位，取代過度暴露的 parent 細節
- D21: memory_update 的 replace/append 模式允許 resolveSkillPath 回傳 null（新建情境），回退到平面路徑創建
- D23: `package.json` 為全專案共用設定檔，由系統記憶卡統一追蹤。MCP 工具模組不再重複追蹤，追蹤數從 8 降至 7。
- D25: parseSections / parseSubSections 新增行內標題正規化前處理 — 新增 `normalizeInlineHeadings()` 函式，逐行掃描（程式碼區塊感知）偵測行內的 `## ` / `### ` 並在前方自動插入換行符。解決原始檔案因缺少換行導致區段標題黏連、patch 模式產生重複區段的問題。`PatchReport` 新增 `autoFixes` 欄位回報自動修正紀錄。
- D26: 職責分離重構 — 新增 `memory_commit` 工具，將記憶卡更新拆為兩步驟：(1) AI 用原生工具寫入 SKILL.md 內容（穩定性最高）；(2) 呼叫 memory_commit 完成後設資料同步（時間戳注入、staleness 歸零、索引同步、trackedFiles 重新解析、fileMap 重建、結構驗證）。memory_update 的 patch/append 模式標記為已棄用，replace 模式保留為向後相容備用。memory-ops 技能指引首選流程更新為 write_to_file → memory_commit。
- D27: v0.9.0 棄用模式正式移除 — 完全移除 `memory_update` 的 `patch`/`append` 模式程式碼（約 390 行），包含：`parseSections()`、`mergeSections()`、`parseSubSections()`、`normalizeTitle()`、`normalizeInlineHeadings()`、`rebuildSectionContent()` 函式及相關型別定義（`Section`、`SubSection`、`ParsedDocument`、`MergeResult`、`PatchReport`）。移除 `mode`、`dryRun` 參數，工具僅保留整張替換模式。同步移除 23 個對應單元測試。

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
- D15: 子區段級合併的關鍵設計：當 patch 的 `##` 區段同時包含 `###` 子區段且原始區段也包含 `###` 時，執行子區段級合併；否則回退到整段替換（向下相容）。`rebuildSectionContent()` 負責從 leading + subSections 重組完整的區段文字。測試需使用 `parseSubSections()` 建構含子區段的 Section 物件。
- D16: `memory_status` 的 fallback 路徑使用正則解析 SKILL.md frontmatter，而非 `gray-matter`，因為 handler 已 mock `fs/promises` 不需要處理 gray-matter 的 stringify。正則解析需處理單引號、雙引號和無引號三種格式。
- D17: 測試 mock 中避免宣告僅用於計數的變數（如 `writeCount++`），ESLint no-unused-vars 會報錯。若不需要驗證呼叫次數，直接用空的 mockImplementation 即可。
- D18: resolveSkillPath 會在 handler 進入商業邏輯前調用 fs.readFile 讀取索引檔，測試必須新增 fs.access mock 且理解 readFile 的呼叫順序變化（第一次不再是 SKILL.md 而是 cartridge_index.json）。
- D22: memory_list 改為優先從索引檔讀取全部卡匣（含巢狀子卡），不再依賴目錄掃描。索引檔透過 `Object.keys(cartridges)` 取得模組清單，確保 depth=2+ 的子卡也被包含在回傳結果中。目錄掃描降級為索引不存在時的回退方案。
- D19: `memory_list` 若依賴 `readdir` 掃描 `.agents/skills/` 的直接子目錄，巢狀在父卡底下的子卡會被完全遺漏。正確做法是從 `cartridge_index.json` 讀取全量卡匣清單，因為索引管理器在掃描時已執行遞迴搜尋。
- D24: v4.0 路徑遷移 — resolveSkillPath() 擴展為 5 層策略：索引查找 → memory/ 平面回退 → skills/ 平面回退 → memory/ 遞迴搜尋 → skills/ 遞迴搜尋。handleMemoryList() 回退掃描先掃 memory/ 再掃 skills/*。handleMemoryUpdate() 新建路徑改為 .agents/memory/。findSkillRecursive() 新增 requireMemPrefix 參數。
- D25: Markdown 區段標題解析不能只依賴 `startsWith('## ')`。當上游寫入缺少換行符時，`## ` 會被黏在前一行末尾，導致 `split('\n')` 後無法識別。正確做法是在解析前做一次行內標題正規化，將非行首的 `## ` / `### ` 前自動插入換行符。此正規化需追蹤 ``` 狀態以避免影響程式碼區塊內容。
- D26: handleMemoryCommit 從 index-manager.ts 匯入 parseTrackedFiles() 來重新解析追蹤檔案清單，確保索引與 SKILL.md 內容同步。同時重建 fileMap 反向映射，先清除模組的舊映射再建立新映射。測試需 mock readFile 區分索引檔和 SKILL.md 的回傳值。

## Applicable Skills
- security-sre
- test-patterns
