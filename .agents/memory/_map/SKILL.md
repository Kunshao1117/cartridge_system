---
name: _map
scopePath: null
description: |
  專案記憶：全局導航卡與模組總覽。 Use when: 查詢架構全貌、模組依賴關係、各子模組層級分配時載入。
last_updated: '2026-06-04T07:17:16+08:00'
status: stable
staleness: 0
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 1
cycle_event_limit: 30
size_limit_bytes: 8192
line_limit: null
archive_policy: volume
compaction_status: ready
metadata:
  author: antigravity
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
---
# _map — Module Memory

## Current Truth

- This card is the schema v2 memory owner for _map.
- This card is a navigation or parent overview card and does not directly own implementation files.
- Legacy decisions, lessons, and repair notes were preserved in archive-001.md.
- No staleness propagation dependency is recorded in frontmatter.
- This is a root-level memory card unless Relations says otherwise.
- Current behavior must still be verified against source before edits.

## Active Constraints

- Keep the main card under 8 KB; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in the description and Chinese summary.
- Add at most one Cycle Events item per update and compact before event 31.
- Do not restore legacy Key Decisions or Module Lessons into the main card body.
- Keep Tracked Files focused on files this card can actually explain.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## 中文摘要

- _map 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- （本卡為導航用途，不追蹤實體檔案）

## Relations

- \_system
- core-types
- extension
- desktop-console
- gitignore-filter
- index-manager
- mcp-tools

## Applicable Skills

- memory-arch
