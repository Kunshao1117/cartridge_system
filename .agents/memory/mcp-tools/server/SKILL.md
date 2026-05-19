---
name: mcp-tools.server
description: >
  專案記憶：MCP SDK server 入口與工具公開清單。Use when: 處理 mcp-server.ts、
  ListToolsRequestSchema、CallToolRequestSchema 或 stdio server 啟動時載入。
last_updated: '2026-05-19T08:01:03+08:00'
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
- src/tests/mcp-server.test.ts

## Key Decisions

- D01: `mcp-server.ts` 只負責 MCP SDK `Server` 建立、`ListToolsRequestSchema` 公開工具清單、`CallToolRequestSchema` 接收請求與 stdio transport 啟動。
- D02: 工具公開清單由 `CARTRIDGE_TOOLS` 生成，避免 server 入口手寫工具 metadata。
- D03: 工具呼叫路由交由 `dispatchToolCall()`，server 不再維護 if/else handler routing。
- D04: 本卡的 `dependencies` 只保留實際 import 的 `mcp-tools.dispatcher` 與 `mcp-tools.tool-registry`；父卡關係寫在 Relations。
- D05: v5.2 MCP server metadata 版本同步為 5.2.0；版本升級時仍需同時檢查 package.json 與此硬編碼 SDK metadata。
- D06: v5.1 tools/list description 由 `tool.description` 加上 `安全性：tool.safetySummary` 組成，讓外部 AI 只看公開工具清單也能理解工具安全邊界。
- D07: v5.2 `mcp-server.ts` 新增 `--workspace`、`--help`、`--version` CLI 入口；MCP 模式不使用 `process.cwd()` fallback，避免 Gateway 或 npm runtime 從錯誤目錄啟動時掃錯專案。
- D08: v5.2 server 只把 `defaultProjectRoot` 交給 dispatcher；實際 projectRoot 注入、衝突防線與舊客戶端相容由 `mcp-tools.dispatcher` 承接，server 仍保持薄層。
- D09: v5.3.3 tools/list 由 registry 自動公開十三個工具，包含 `memory_graph`；server 薄層不需要新增手寫路由。

## Known Issues

- `mcp-server.ts` 的 SDK metadata 版本不會自動讀取 package.json，版本升級時仍需同步檢查。
- 無

## Module Lessons

- L01: MCP server 入口應維持薄層，讓工具治理與 routing 分別由 registry 與 dispatcher 承接。
- L02: npm bin 入口必須避免在 MCP stdio 模式向 stdout 輸出 banner；help/version 可以用 stdout，server runtime 診斷只走 stderr。
- L03: tools/list 工具數變動時，server 記憶卡只需確認 registry-driven list tools 仍成立，不應回到 server 手寫工具清單。

## Relations

- mcp-tools（父卡：MCP 工具介面總覽）
- mcp-tools.dispatcher（依賴：工具呼叫分派）
- mcp-tools.tool-registry（依賴：工具公開清單）

## Applicable Skills

- memory-ops
- security-sre
- test-patterns
