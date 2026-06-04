# mcp-tools.tool-registry Legacy Archive Volume 001

Migrated: 2026-06-04T07:15:00+08:00
Archive policy: schema v2 lazy upgrade preserved the original legacy SKILL.md content verbatim for trace-back.

## Original Legacy Content

---
name: tool-registry
description: >
  專案記憶：MCP 工具名冊與統一回傳契約。Use when: 處理工具風險分級、MCP tools 清單生成、治理 envelope
  或高階工具回傳格式時載入。
last_updated: '2026-06-04T06:59:51+08:00'
status: stable
staleness: 0
dependencies:
  - core-types
metadata:
  author: antigravity
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
    - 'filesystem:write'
---

# Tool Registry — MCP 工具名冊與回傳契約記憶

> 本模組承接 MCP 工具治理中介層，讓工具定義與高階治理回傳格式有單一來源。

## Tracked Files

- src/tool-registry.ts
- src/mcp-response.ts
- src/tests/tool-registry.test.ts
- src/tests/mcp-response.test.ts

## Key Decisions

- D01: `tool-registry.ts` 是 MCP tools 定義的單一來源，集中保存 name、description、safetySummary、inputSchema、risk、capability、readOnly、requiresExplicitApproval、safeForStartup 與 expectedLatency。
- D02: `mcp-server.ts` 的 `ListToolsRequestSchema` 從 registry 生成公開工具清單，避免工具描述散落在 server 入口。
- D03: `mcp-response.ts` 定義八個 MCP 工具共用的 envelope，標準欄位包含 status、summary、findings、recommendedActions、metadata 與 legacy。
- D04: `memory_list`、`memory_read`、`memory_status`、`memory_commit`、`memory_deps`、`memory_audit`、`workspace_brief` 與 `commit_preflight` 均採 envelope；舊版文字或原始資料以 `legacy` 保留。
- D05: `memory_commit` 被標為 high risk、write capability、requiresExplicitApproval=true；AI 不應在未授權情況下自動呼叫寫入型工具。
- D06: `memory_commit` 的公開 inputSchema 新增 `confirm` boolean 並列入 required；dispatcher 會以此執行 server 層硬性確認。
- D07: `findToolDefinition()` 提供 dispatcher 查詢 registry metadata 的穩定入口，避免分派層自行遍歷或複製工具名冊。
- D08: 依新版核心規範，父卡 `mcp-tools` 屬於 Relations 導覽，不寫入 frontmatter `dependencies`，避免父子拓樸被誤判為過期傳播依賴。
- D09: `mcp-response.ts` 的 envelope 新增 `legacy` 欄位，讓治理工具可用標準 `summary/findings/recommendedActions` 給新 AI 流程讀取，同時保留舊版欄位相容。
- D10: `mcp-response.ts` 自行定義 `McpToolResult` 形狀，避免回傳契約為了 type-only import 反向依賴 `mcp-handlers.ts`，造成 Memory Graph 顯示不必要循環。
- D11: `workspace-brief.ts`、`commit-preflight.ts` 與 `tool-dispatcher.ts` 的 `McpToolResult` 型別來源統一改為 `mcp-response.ts`，讓回傳型別由契約檔持有。
- D12: `mcp-response.ts` 使用 `core-types` 持有的 `timestamp.ts` 產生 envelope metadata；若 core-types 時間戳語義過期，MCP 回傳契約也必須重新檢查。
- D13: MCP tools/list 驗收需回傳八個工具：memory_list、memory_read、memory_status、memory_commit、memory_deps、memory_audit、workspace_brief、commit_preflight。
- D14: `createToolErrorEnvelope()` 維持讀取型錯誤 helper；寫入型工具的 validation/path/runtime error 由 handler 使用 `createToolEnvelope()` 明確標示 `readOnly: false`。
- D15: `memory_audit` 登錄為 medium risk、governance capability、readOnly=true，不需要 explicit approval；它只產生完整健檢報告，不進行記憶卡修復。
- D16: v5.0 tools/list 擴充為十二個工具，新增 `context_inventory`、`context_audit`、`context_diff`、`context_plan`，全部為 readOnly context governance/analyze 工具。
- D17: `context_diff` 擁有專用 schema，除了 `projectRoot` 也要求 `leftId` 與 `rightId`，避免呼叫者用模組名稱誤傳 context asset id。
- D18: v5.1 tools/list description 會附加 `安全性：...`，讓 AI 在只看公開工具清單時也能知道哪些工具只讀、哪些工具需要 confirm 或適合開工時使用。
- D19: v5.2 公開 inputSchema 保留 `projectRoot` property 但不列為 required；Gateway `workspace` 或 CLI `--workspace` 會由 dispatcher 補入，舊客戶端仍可手動傳入相同路徑。
- D20: `memory_commit` 的公開 required 欄位維持 `moduleName` 與 `confirm`；projectRoot 選填不代表放寬寫入授權，dispatcher 仍先檢查 `confirm:true`。
- D21: npm 發布 manifest 測試以 npm 正規化後的 `bin` 與 `repository.url` 為準；`bin` path 使用 `dist/mcp-server.js`，repository 使用 `git+https://github.com/Kunshao1117/cartridge_system.git`。
- D22: v5.3.2 發版時 `src/tests/tool-registry.test.ts` 的 manifest 版本斷言需與 `package.json` 同步，避免版本升級後測試仍釘在舊版號。
- D23: v5.3.3 新增第十三個 MCP 工具 `memory_graph`，登錄為 low risk、readOnly、analyze、safeForStartup，用於輸出 AI 可讀整體記憶圖譜摘要。
- D24: v5.3.4 發版時 `src/tests/tool-registry.test.ts` 的 package manifest 版本斷言同步更新為 5.3.4；此為 VSIX 版本 bump，不改 MCP server runtime 版本常數。
- D25: v5.3.5 發版時 `src/tests/tool-registry.test.ts` 的 package manifest 版本斷言同步更新為 5.3.5；此為側邊欄更新按鈕的 VSIX 版本 bump，不改 MCP server runtime 版本常數。
- D26: v5.4 tools/list 擴充為十七個工具，新增 `project_context_list`、`project_context_read`、`project_context_validate`、`project_context_status`；四者皆 readOnly 且不需要 explicit approval，語義上與 `.agents/memory/` stale / `memory_commit` 分離。
- D27: v5.4.0 發布時 `src/tests/tool-registry.test.ts` 的 package manifest 版本斷言同步更新為 5.4.0；本版作為 npm runtime 發布版，版本測試需與 package manifest 一致。
- D28: v5.4.2 發布時 `src/tests/tool-registry.test.ts` 的 package manifest 版本斷言同步更新為 5.4.2；schema v2 壓縮治理與健康面板訊號是使用者可見行為變更，package manifest 需同步 patch 版。

## Known Issues

- 尚未讓 README 自動從 registry 生成工具表，文件仍需人工同步。

## Module Lessons

- L01: MCP 工具增加時，應先集中治理工具定義，再重構 handler routing；分階段可降低 API 破壞風險。
- L02: 工具名冊是被 server、dispatcher 與治理工具消費的上游；它本身不因父卡總覽過期而必然需要重檢。
- L03: 回傳契約擴充應優先保持 additive；新增 `legacy` 比搬移或刪除欄位更能降低 Gateway 與既有呼叫者風險。
- L04: 依賴掃描器會看 TypeScript import 文字；即使是 type-only import，也可能在記憶圖上形成邊，因此共用契約檔應避免反向引用 handler。
- L05: 型別來源應靠近契約擁有者；MCP 回傳型別放在 `mcp-response.ts` 能避免高階工具為型別去 import handler 實作檔。
- L06: response envelope 的時間戳來源應歸 core-types，而不是 handlers，避免 tool-registry 與 handlers 形成雙向工程依賴。
- L07: 工具名冊驗證要走協議層 `tools/list`，不能只讀 `CARTRIDGE_TOOLS` 常數，否則無法證明 MCP server 對外公開清單正確。
- L08: 回傳契約收斂不能只做高階工具；底層 memory_* 工具若維持純文字，Gateway 使用者仍會遇到解析分岔。
- L09: 工具數量變動時，README、CHANGELOG、tools/list 協議 E2E 與 Gateway 驗證文字都必須同步更新，避免 AI 以舊的七工具假設判斷專案狀態。
- L10: v5.0 context tools 仍沿用同一份 envelope；新增治理領域不需要為上下文工具建立第二套回傳格式。
- L11: 安全提示應放在 registry 單一來源，再由 MCP server 公開；不要讓 README、server 與 dispatcher 各自維護不同文字。
- L12: tools/list schema 應描述呼叫契約，不應重複 Gateway 的工作區欄位；projectRoot 可選化能讓 Gateway-first 使用者少傳一份重複路徑，同時不破壞舊客戶端。
- L13: `npm publish --dry-run` 在 npm 11 會正規化 package manifest；測試應驗證實際發布形狀，而不是只驗證手寫 JSON 的偏好格式。
- L14: 發版 bump version 時要同步搜尋測試中的硬編碼版本，尤其是 manifest/pack 白名單測試。
- L15: (2026-05-19) v5.3.1 版本 bump 後，manifest 測試需同步從 5.3.0 改為 5.3.1，否則全量測試會只剩版本斷言失敗。
- L16: (2026-05-19) v5.3.2 版本 bump 後，manifest 測試需同步改為 5.3.2；MCP server runtime 版本常數維持既有測試契約，不在卡匣機櫃 VSIX 修補版中擴張範圍。
- L17: (2026-05-19) 新增 MCP tool 時需同步更新 `CARTRIDGE_TOOLS`、dispatcher handler map、README 工具表、工具數文字與測試硬編碼工具清單。
- L18: (2026-05-19) VSIX/package 版本 bump 後要搜尋 `packageJson.version` 與 `5.x.x` 斷言；`tool-registry.test.ts` 是目前固定 package manifest 版本的測試點。
- L19: (2026-05-29) npm runtime 發布版的 manifest 測試不只保護 VSIX package，也保護 npx 安裝版本；版本 bump 時需同步 dry-run 檢查 tarball 名稱。

## Relations

- mcp-tools（父卡：MCP 工具註冊、路由與工具契約）
- core-types（依賴：MCP response envelope metadata 時間戳）
- mcp-tools.workspace-brief（消費 envelope 的高階治理工具）
- mcp-tools.commit-preflight（消費 envelope 的高階治理工具）
- mcp-tools.memory-audit（消費 envelope 的完整健檢工具）
- mcp-tools.dispatcher（消費工具 metadata 並執行明確確認防線）
- mcp-tools.context-governance（消費工具 metadata 並提供 v5 context tools）
- mcp-tools.memory-graph（消費 envelope 契約並提供 memory_graph 工具）
- mcp-tools.project-context（消費 envelope 契約並提供 project_context 工具）

## Applicable Skills

- memory-ops
- security-sre
- test-patterns
