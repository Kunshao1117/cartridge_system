---
name: mcp-tools.dispatcher
description: >
  專案記憶：MCP 工具分派與工具層防線。Use when: 處理 MCP tool routing、unknown tool 錯誤、 high-risk
  tool 明確確認與 dispatcher 測試時載入。
last_updated: '2026-05-15T02:40:02+08:00'
status: stable
staleness: 0
dependencies:
  - mcp-tools.handlers
  - mcp-tools.tool-registry
  - mcp-tools.workspace-brief
  - mcp-tools.commit-preflight
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
- src/tests/tool-dispatcher.test.ts

## Key Decisions

- D01: `dispatchToolCall()` 是 MCP tool call 的單一分派入口，`mcp-server.ts` 不再維護手寫 if/else routing。
- D02: dispatcher 先以 `findToolDefinition()` 驗證工具已登錄，再尋找對應 handler；未知工具統一回傳 MCP error envelope。
- D03: `requiresExplicitApproval=true` 的工具必須通過 dispatcher 層 `confirm: true` 檢查，未確認時不會進入 handler。
- D04: `memory_commit` 的明確確認屬於 MCP 工具層 guardrail，不改動 `handleMemoryCommit()` 的底層同步邏輯，保留 handler 單元測試相容性。
- D05: `dependencies` 僅保留實際 import/consume 的工程依賴：handlers、tool-registry、workspace-brief、commit-preflight；父卡 `mcp-tools` 改放 Relations，不再作為過期傳播依賴。
- D06: dispatcher 的 `McpToolResult` 型別來源改為 `mcp-response.ts`，只從 `mcp-handlers.ts` 匯入實際底層 handler 函式。
- D07: `mcp-tools.handlers`、`mcp-tools.tool-registry`、`mcp-tools.workspace-brief` 與 `mcp-tools.commit-preflight` 均為 dispatcher 的實際 import/consume dependencies；任一上游 handler 或工具契約過期時，dispatcher 的路由表、授權防線或 handler map 也必須重新檢查。
- D08: Gateway 實測必須透過 dispatcher 入口呼叫 `cartridge-system__memory_deps`、`cartridge-system__workspace_brief`、`cartridge-system__commit_preflight`，確認真實工具路由可用。

## Known Issues

- 目前 dispatcher handler map 仍需與 `CARTRIDGE_TOOLS` 人工同步；測試會覆蓋主要路由，但尚未自動產生 handler map。

## Module Lessons

- L01: 高風險工具防線應放在 MCP server 入口附近，避免底層 handler 被不同入口重用時混入互動式授權邏輯。
- L02: 父子卡是導覽拓樸，不等於 staleness propagation dependency；dispatcher 子卡不應只因位於 `mcp-tools/` 下而依賴父卡。
- L03: dispatcher 可以同時依賴 handler 函式與 response 契約，但型別應從契約檔取得，避免把 handler 實作當作共用型別來源。
- L04: Gateway 驗證比 stdio E2E 更接近實際 AI 使用情境；若 Gateway 工具入口未暴露，報告必須標示無法驗證，不可寫成通過。

## Relations

- mcp-tools（父卡：MCP server routing 與工具介面）
- mcp-tools.handlers（依賴：底層 memory_* handler）
- mcp-tools.tool-registry（依賴：工具 metadata、風險等級與授權需求）
- mcp-tools.workspace-brief（依賴：workspace_brief handler）
- mcp-tools.commit-preflight（依賴：commit_preflight handler）

## Applicable Skills

- memory-ops
- security-sre
- test-patterns
