---
name: tool-registry
description: >
  專案記憶：MCP 工具名冊與統一回傳契約。Use when: 處理工具風險分級、MCP tools 清單生成、治理 envelope
  或高階工具回傳格式時載入。
last_updated: '2026-05-14T15:45:06+08:00'
status: stable
staleness: 0
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
- D03: `mcp-response.ts` 定義高階治理工具的 envelope，標準欄位包含 status、summary、findings、recommendedActions 與 metadata。
- D04: 第一階段只讓 `workspace_brief` 與 `commit_preflight` 套用 envelope；既有 `memory_*` 工具暫時維持原格式，避免破壞既有呼叫者。
- D05: `memory_commit` 被標為 high risk、write capability、requiresExplicitApproval=true；AI 不應在未授權情況下自動呼叫寫入型工具。
- D06: `memory_commit` 的公開 inputSchema 新增 `confirm` boolean 並列入 required；dispatcher 會以此執行 server 層硬性確認。
- D07: `findToolDefinition()` 提供 dispatcher 查詢 registry metadata 的穩定入口，避免分派層自行遍歷或複製工具名冊。
- D08: 依新版核心規範，父卡 `mcp-tools` 屬於 Relations 導覽，不寫入 frontmatter `dependencies`，避免父子拓樸被誤判為過期傳播依賴。

## Known Issues

- 尚未讓 README 自動從 registry 生成工具表，文件仍需人工同步。

## Module Lessons

- L01: MCP 工具增加時，應先集中治理工具定義，再重構 handler routing；分階段可降低 API 破壞風險。
- L02: 工具名冊是被 server、dispatcher 與治理工具消費的上游；它本身不因父卡總覽過期而必然需要重檢。

## Relations

- mcp-tools（父卡：MCP 工具註冊、路由與工具契約）
- mcp-tools.workspace-brief（消費 envelope 的高階治理工具）
- mcp-tools.commit-preflight（消費 envelope 的高階治理工具）
- mcp-tools.dispatcher（消費工具 metadata 並執行明確確認防線）

## Applicable Skills

- memory-ops
- security-sre
- test-patterns
