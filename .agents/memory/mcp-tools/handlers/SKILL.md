---
name: mcp-tools.handlers
description: >
  專案記憶：底層 memory_* MCP handlers。Use when: 處理 mcp-handlers.ts、 底層
  memory_list/read/status/commit/deps 行為或 handler 測試時載入。
last_updated: '2026-06-04T08:01:01+08:00'
status: stable
staleness: 0
dependencies:
  - index-manager
  - core-types
  - index-manager.dep-engine
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 3
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
---

# mcp tools / handlers — Module Memory

## Current Truth

- This card is the schema v2 memory owner for mcp-tools.handlers.
- Its implementation boundary is the tracked file list below.
- Legacy decisions, lessons, and repair notes were preserved in archive-001.md.
- Frontmatter dependencies are retained as staleness propagation dependencies and must not be used for navigation-only links.
- Directory nesting is navigation; parent-child placement is not a dependency by itself.
- Current behavior must still be verified against source before edits.
- `memory_commit` and `memory_list` exclude managed memory internals from untracked file output.
- `memory_list` now consumes the shared visible index view rather than duplicating archive path filtering.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in the description and Chinese summary.
- Add at most one Cycle Events item per update and compact before event 31.
- Do not restore legacy Key Decisions or Module Lessons into the main card body.
- Keep Tracked Files focused on files this card can actually explain.

## Known Issues

- None active. Dependency rationale: index-manager, core-types, index-manager.dep-engine are upstream dependencies; upstream staleness must trigger review for this card.


## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Applied the managed memory artifact guard to memory_commit cleanup and memory_list output so archive volumes cannot remain as untracked product files.
- 03: Consolidated memory_list and memory_commit archive filtering through shared visible-untracked helpers.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## 中文摘要

- mcp-tools.handlers 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
- memory_commit 與 memory_list 都會排除記憶歸檔卷殘留的未歸屬項目。
- MCP handler 不再維護自己的 archive 排除條件，改用 index-manager 共用 helper。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- src/mcp-handlers.ts
- src/tests/mcp-handlers.test.ts
- src/tests/memory-deps-output.test.ts

## Relations

- mcp-tools（父卡：MCP 工具介面總覽）
- mcp-tools.dispatcher（消費：底層 handler 與 MCP 回傳型別）
- index-manager（依賴：索引解析與 trackedFiles 解析）
- core-types（依賴：共用型別與設定）
- index-manager.dep-engine（依賴：dependency-semantics warning-only 檢查器）

## Applicable Skills

- memory-ops
- security-sre
- test-patterns
