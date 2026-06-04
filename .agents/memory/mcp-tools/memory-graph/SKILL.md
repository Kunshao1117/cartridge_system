---
name: mcp-tools.memory-graph
description: >
  專案記憶：AI 可讀記憶卡匣圖譜工具。Use when: 修改 memory_graph MCP 工具、整體卡匣圖譜摘要、 focusModule
  一跳關聯或相關測試時載入。
last_updated: '2026-06-04T07:18:46+08:00'
status: stable
staleness: 0
dependencies:
  - extension.cabinet-workbench
  - index-manager
  - core-types
  - mcp-tools.tool-registry
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 1
cycle_event_limit: 30
size_limit_bytes: 16384
line_limit: 120
archive_policy: volume
compaction_status: ready
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
# mcp tools / memory graph — Module Memory

## Current Truth

- This card is the schema v2 memory owner for mcp-tools.memory-graph.
- Its implementation boundary is the tracked file list below.
- Legacy decisions, lessons, and repair notes were preserved in archive-001.md.
- Frontmatter dependencies are retained as staleness propagation dependencies and must not be used for navigation-only links.
- Directory nesting is navigation; parent-child placement is not a dependency by itself.
- Current behavior must still be verified against source before edits.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in the description and Chinese summary.
- Add at most one Cycle Events item per update and compact before event 31.
- Do not restore legacy Key Decisions or Module Lessons into the main card body.
- Keep Tracked Files focused on files this card can actually explain.

## Known Issues

- None active. Dependency rationale: extension.cabinet-workbench, index-manager, core-types, mcp-tools.tool-registry are upstream dependencies; upstream staleness must trigger review for this card.


## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## 中文摘要

- mcp-tools.memory-graph 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- src/memory-graph.ts
- src/tests/memory-graph.test.ts

## Relations

- mcp-tools（父卡：MCP 工具介面總覽）
- mcp-tools.tool-registry（工具名冊公開 `memory_graph` schema 與安全 metadata）
- mcp-tools.dispatcher（工具呼叫路由到 `handleMemoryGraph`）
- extension.cabinet-workbench（資料模型來源）

## Applicable Skills

- memory-ops
- security-sre
- test-patterns
