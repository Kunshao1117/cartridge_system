---
name: mcp-tools.memory-graph
description: >
  專案記憶：AI 可讀記憶卡匣圖譜工具。Use when: 修改 memory_graph MCP 工具、整體卡匣圖譜摘要、 focusModule
  一跳關聯或相關測試時載入。
last_updated: '2026-05-19T07:59:08+08:00'
status: stable
staleness: 0
dependencies:
  - extension.cabinet-workbench
  - index-manager
  - core-types
  - mcp-tools.tool-registry
metadata:
  author: antigravity
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
    - 'filesystem:write'
    - 'terminal:test'
---

# Memory Graph Tool — AI 可讀記憶圖譜工具

> 本子卡追蹤 `memory_graph` MCP 工具。它把卡匣機櫃工作台模型轉成 AI 可讀的整體圖譜摘要，讓 AI 先掌握卡匣、連線、熱點與下一步工具，再決定是否深入讀單張 SKILL.md。

## Tracked Files

- src/memory-graph.ts
- src/tests/memory-graph.test.ts

## Key Decisions

- D01: `memory_graph` 是只讀 analyze 工具，輸出整體卡匣 overview、cards、lines 與 `aiReadingGuide`，不修改記憶卡也不呼叫寫入型工具。
- D02: 工具重用 `buildCabinetWorkbenchModelForProject()`，避免 MCP 端另寫一套卡匣、卡槽、訊號線與 note 線推導邏輯。
- D03: `lens` 支援 `maintenance`、`memory`、`structure`、`all`；前三者沿用 Webview 三艙位線條口徑，`all` 讓 AI 讀完整圖。
- D04: `focusModule` 固定回傳指定卡匣與一跳關聯：父卡、子卡、dependencies、dependents；若卡匣不存在回傳 `module_not_found`。
- D05: `maxCards` 預設 80、上限 200；截斷時回傳 warning finding，避免大型專案一次輸出過重。
- D06: dependency reason — `extension.cabinet-workbench` 持有卡匣工作台模型、三艙位線條口徑與 metadata 解析；若其模型或視角語義過期，`memory_graph` 的 AI 輸出必須重新檢查。
- D07: dependency reason — `index-manager` 持有記憶卡索引掃描與依賴推導；若索引輸出過期，`memory_graph` 的 cards/lines 來源必須重新檢查。
- D08: dependency reason — `core-types` 持有 projectRoot/path guard 與共用索引型別；若路徑或索引型別語義變更，`memory_graph` 輸入防線與資料映射必須重新檢查。
- D09: dependency reason — `mcp-tools.tool-registry` 持有 MCP envelope 與公開工具契約；若工具契約過期，`memory_graph` schema 與回傳格式必須重新檢查。

## Known Issues

- 無

## Module Lessons

- L01: AI 讀整體記憶關係時，單卡 `memory_deps` 不夠；需要一個先看全局的輕量圖譜工具，再用 `memory_read` 讀原文。
- L02: `memory_graph` 不應回傳完整 SKILL.md 內文，否則會把摘要工具變成大型上下文傾倒工具。

## Relations

- mcp-tools（父卡：MCP 工具介面總覽）
- mcp-tools.tool-registry（工具名冊公開 `memory_graph` schema 與安全 metadata）
- mcp-tools.dispatcher（工具呼叫路由到 `handleMemoryGraph`）
- extension.cabinet-workbench（資料模型來源）

## Applicable Skills

- memory-ops
- security-sre
- test-patterns
