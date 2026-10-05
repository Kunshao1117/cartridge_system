---
name: _map
scopePath: null
description: |
  專案記憶：全局導航卡與模組總覽。 Use when: 查詢架構全貌、模組依賴關係、各子模組層級分配時載入。
last_updated: '2026-06-15T00:47:16+08:00'
status: stable
staleness: 0
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 3
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
memory_quality_version: 1
memory_kind: navigation
verification_status: pending_review
last_verified: '2026-06-15T00:47:16+08:00'
valid_scope:
  - .agents/memory/_map
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

- This root-index card has an 8 KB source-defined limit and no line-count limit; ordinary main-card limits are 16 KB and 120 lines.
- Keep the technical body in English; use Traditional Chinese only in description and Chinese summary.
- Use dependencies only for true staleness propagation; use Relations for navigation.
- Do not rewrite archive volumes during active-card standardization.
- Treat missing evidence as pending review, not as complete quality.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Standardized active memory main file to MEMORY.md with quality metadata and evidence sections.
- 03: Standardized memory ownership and YAML valid_scope for the 5.5.1 governance repair.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.
- archive-002.md — MEMORY.md main-file migration report for 2026-06-15.

## Evidence Base


- source:https://github.com/Kunshao1117/cartridge_system/blob/3f346804c8c72944a2c61a46544421c9f9009ef2/.agents/memory/_map/MEMORY.md — reviewed original card revision.
- source:https://github.com/Kunshao1117/cartridge_system/tree/3f346804c8c72944a2c61a46544421c9f9009ef2 — source tree for this static claim/ownership review; use Tracked Files for the exact source slice.

## Read Contract

- Read this card before editing _map tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession


- Static comparison target: 5.5.8 source 3f346804c8c72944a2c61a46544421c9f9009ef2. Historical cycle/archive records remain unchanged; old validation IDs do not establish current runtime acceptance.

## 中文摘要

- _map 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- （導航卡，不直接追蹤實作檔案）

## Relations

- \_system
- core-types
- extension
- desktop-console
- gitignore-filter
- index-manager
- mcp-tools
