---
name: mcp-tools.server
description: >
  專案記憶：MCP SDK server 入口與工具公開清單。Use when: 處理 mcp-server.ts、
  ListToolsRequestSchema、CallToolRequestSchema 或 stdio server 啟動時載入。
last_updated: '2026-05-14T15:44:54+08:00'
status: stable
staleness: 0
dependencies:
  - mcp-tools.dispatcher
  - mcp-tools.tool-registry
metadata:
  author: antigravity
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
    - 'filesystem:write'
---

# MCP Server — SDK 入口記憶

> 本模組承接 MCP SDK server 入口，父卡 `mcp-tools` 只保留工具介面總覽與跨子卡決策。

## Tracked Files

- src/mcp-server.ts

## Key Decisions

- D01: `mcp-server.ts` 只負責 MCP SDK `Server` 建立、`ListToolsRequestSchema` 公開工具清單、`CallToolRequestSchema` 接收請求與 stdio transport 啟動。
- D02: 工具公開清單由 `CARTRIDGE_TOOLS` 生成，避免 server 入口手寫工具 metadata。
- D03: 工具呼叫路由交由 `dispatchToolCall()`，server 不再維護 if/else handler routing。
- D04: 本卡的 `dependencies` 只保留實際 import 的 `mcp-tools.dispatcher` 與 `mcp-tools.tool-registry`；父卡關係寫在 Relations。

## Known Issues

- `mcp-server.ts` 的 SDK metadata 版本不會自動讀取 package.json，版本升級時仍需同步檢查。

## Module Lessons

- L01: MCP server 入口應維持薄層，讓工具治理與 routing 分別由 registry 與 dispatcher 承接。

## Relations

- mcp-tools（父卡：MCP 工具介面總覽）
- mcp-tools.dispatcher（依賴：工具呼叫分派）
- mcp-tools.tool-registry（依賴：工具公開清單）

## Applicable Skills

- memory-ops
- security-sre
- test-patterns
