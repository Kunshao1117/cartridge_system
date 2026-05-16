---
name: tool-registry
description: >
  專案記憶：MCP 工具名冊與統一回傳契約。Use when: 處理工具風險分級、MCP tools 清單生成、治理 envelope
  或高階工具回傳格式時載入。
last_updated: '2026-05-15T15:41:36+08:00'
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

- D01: `tool-registry.ts` 是 MCP tools 定義的單一來源，集中保存 name、description、inputSchema、risk、capability、readOnly 與 requiresExplicitApproval。
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

## Relations

- mcp-tools（父卡：MCP 工具註冊、路由與工具契約）
- core-types（依賴：MCP response envelope metadata 時間戳）
- mcp-tools.workspace-brief（消費 envelope 的高階治理工具）
- mcp-tools.commit-preflight（消費 envelope 的高階治理工具）
- mcp-tools.memory-audit（消費 envelope 的完整健檢工具）
- mcp-tools.dispatcher（消費工具 metadata 並執行明確確認防線）

## Applicable Skills

- memory-ops
- security-sre
- test-patterns
