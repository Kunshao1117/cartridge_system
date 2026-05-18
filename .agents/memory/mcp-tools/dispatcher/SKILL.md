---
name: mcp-tools.dispatcher
description: >
  專案記憶：MCP 工具分派與工具層防線。Use when: 處理 MCP tool routing、unknown tool 錯誤、 high-risk
  tool 明確確認與 dispatcher 測試時載入。
last_updated: '2026-05-18T19:37:47+08:00'
status: stable
staleness: 0
dependencies:
  - core-types
  - mcp-tools.handlers
  - mcp-tools.tool-registry
  - mcp-tools.workspace-brief
  - mcp-tools.commit-preflight
  - mcp-tools.memory-audit
  - mcp-tools.context-governance
metadata:
  author: antigravity
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
    - 'filesystem:write'
---

# Tool Dispatcher — MCP 工具分派與防線記憶

> 本模組把 MCP tool name 到 handler 的執行分派集中化，讓 `tool-registry.ts` 的治理 metadata 真正進入執行路徑。

## Tracked Files

- src/tool-dispatcher.ts
- src/tool-workspace.ts
- src/tests/tool-dispatcher.test.ts

## Key Decisions

- D01: `dispatchToolCall()` 是 MCP tool call 的單一分派入口，`mcp-server.ts` 不再維護手寫 if/else routing。
- D02: dispatcher 先以 `findToolDefinition()` 驗證工具已登錄，再尋找對應 handler；未知工具統一回傳 MCP error envelope。
- D03: `requiresExplicitApproval=true` 的工具必須通過 dispatcher 層 `confirm: true` 檢查，未確認時不會進入 handler。
- D04: `memory_commit` 的明確確認屬於 MCP 工具層 guardrail，不改動 `handleMemoryCommit()` 的底層同步邏輯，保留 handler 單元測試相容性。
- D05: `dependencies` 僅保留實際 import/consume 的工程依賴：handlers、tool-registry、workspace-brief、commit-preflight、memory-audit；父卡 `mcp-tools` 改放 Relations，不再作為過期傳播依賴。
- D06: dispatcher 的 `McpToolResult` 型別來源改為 `mcp-response.ts`，只從 `mcp-handlers.ts` 匯入實際底層 handler 函式。
- D07: `mcp-tools.handlers`、`mcp-tools.tool-registry`、`mcp-tools.workspace-brief` 與 `mcp-tools.commit-preflight` 均為 dispatcher 的實際 import/consume dependencies；任一上游 handler 或工具契約過期時，dispatcher 的路由表、授權防線或 handler map 也必須重新檢查。
- D08: Gateway 實測必須透過 dispatcher 入口呼叫 `cartridge-system__memory_deps`、`cartridge-system__workspace_brief`、`cartridge-system__commit_preflight`，確認真實工具路由可用。
- D09: dispatcher 產生的 unknown tool 與 explicit approval required 仍使用統一 envelope；底層 handler 也已收斂 envelope，因此 dispatcher 不需要為舊工具做格式轉換。
- D10: dispatcher 已將 `memory_audit` 加入 handler map；此工具是 read-only governance tool，不需 `confirm:true`，但仍必須先通過 registry 登錄檢查。
- D11: dispatcher 實際 import `mcp-tools.memory-audit` 的 handler；若 `mcp-tools.memory-audit` 過期，dispatcher 的 handler map 與第八工具路由也必須重新檢查。
- D12: v5.0 dispatcher 加入四個 context governance handler：`context_inventory`、`context_audit`、`context_diff`、`context_plan`；全部 read-only，不需要 `confirm:true`。
- D13: dispatcher 測試新增 context tool routing，確保 tools/list 擴充後 tools/call 不會落入 unknown tool。
- D14: `mcp-tools.context-governance` 是 dispatcher 的實際 handler dependency；context tools 的 handler export、名稱或 read-only 契約改變時，dispatcher handler map 與 route tests 必須同步檢查。
- D15: v5.2 `tool-workspace.ts` 承接 Gateway-first workspace 注入：`defaultProjectRoot` 由 server 或 Gateway 提供時，dispatcher 會先補齊 `projectRoot` 再進入 handler。
- D16: v5.2 若可信 workspace 與 `arguments.projectRoot` 正規化後不同，dispatcher 回傳 `workspace_project_root_conflict`，避免多專案 Gateway 呼叫被 tool argument 覆蓋。
- D17: `core-types` 持有 projectRoot 路徑驗證與工作區身分比較；若 `core-types` 的路徑語義變更，dispatcher 的 Gateway/CLI workspace 注入與衝突判斷必須重新檢查，因此列為 staleness propagation dependency。

## Known Issues

- 目前 dispatcher handler map 仍需與 `CARTRIDGE_TOOLS` 人工同步；測試會覆蓋主要路由，但尚未自動產生 handler map。

## Module Lessons

- L01: 高風險工具防線應放在 MCP server 入口附近，避免底層 handler 被不同入口重用時混入互動式授權邏輯。
- L02: 父子卡是導覽拓樸，不等於 staleness propagation dependency；dispatcher 子卡不應只因位於 `mcp-tools/` 下而依賴父卡。
- L03: dispatcher 可以同時依賴 handler 函式與 response 契約，但型別應從契約檔取得，避免把 handler 實作當作共用型別來源。
- L04: Gateway 驗證比 stdio E2E 更接近實際 AI 使用情境；若 Gateway 工具入口未暴露，報告必須標示無法驗證，不可寫成通過。
- L05: dispatcher 的責任是路由與防線，不應承擔工具結果格式修補；回傳格式應由 `mcp-response.ts` 與各 handler 共同保證。
- L06: 每新增一個 MCP tool，都要同時更新 registry、dispatcher handler map 與 dispatcher 測試 mock，避免 tools/list 已公開但 tools/call 找不到 handler。
- L07: Director 指定 Gateway MCP 真實呼叫時，若 Gateway 工具入口、參數或提示不明，AI 必須先回報卡點並等待授權；不得自行改用 stdio、終端 handler 或其他替代方案宣稱完成原驗證。
- L08: 新增 MCP tool 時，dispatcher mock 測試必須同步新增 handler mock，否則路由測試會在 import 階段失真。
- L09: Gateway workspace 與下游 tool argument 屬於兩個信任層；相容舊客戶端時可接受 `projectRoot`，但不能讓它覆蓋 Gateway/CLI 的可信 workspace。

## Relations

- mcp-tools（父卡：MCP server routing 與工具介面）
- mcp-tools.handlers（依賴：底層 memory_* handler）
- mcp-tools.tool-registry（依賴：工具 metadata、風險等級與授權需求）
- mcp-tools.workspace-brief（依賴：workspace_brief handler）
- mcp-tools.commit-preflight（依賴：commit_preflight handler）
- mcp-tools.memory-audit（依賴：memory_audit handler）
- mcp-tools.context-governance（依賴：context governance handlers）
- core-types（依賴：projectRoot 路徑驗證與工作區身分比較）

## Applicable Skills

- memory-ops
- security-sre
- test-patterns
