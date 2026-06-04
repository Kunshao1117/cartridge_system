---
name: mcp-tools.project-context
description: >
  專案記憶：專案脈絡層 MCP 工具。Use when: 處理 project_context_list/read/validate/status、
  .agents/context/ CONTEXT.md 解析、專案脈絡狀態摘要或相關測試時載入。
last_updated: '2026-06-04T07:18:53+08:00'
status: stable
staleness: 0
dependencies:
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
    - 'terminal:test'
---
# mcp tools / project context — Module Memory

## Current Truth

- This card is the schema v2 memory owner for mcp-tools.project-context.
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

- None active. Dependency rationale: core-types, mcp-tools.tool-registry are upstream dependencies; upstream staleness must trigger review for this card.


## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## 中文摘要

- mcp-tools.project-context 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- src/project-context-types.ts
- src/project-context-registry.ts
- src/project-context-validation.ts
- src/project-context-tool-shared.ts
- src/project-context-tools.ts
- src/tests/project-context.test.ts

## Relations

- mcp-tools（父卡：MCP 工具介面總覽）
- mcp-tools.tool-registry（工具名冊公開 project_context schema 與安全 metadata）
- mcp-tools.dispatcher（工具呼叫路由到 project_context handlers）
- mcp-tools.workspace-brief（消費專案脈絡摘要並轉為非阻塞開工提醒）
- core-types（依賴：projectRoot 路徑驗證與 MCP response envelope）

## Applicable Skills

- project-context-protocol
- memory-ops
- security-sre
- test-patterns
