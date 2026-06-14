---
name: core-types.visible-index
description: '專案記憶：core types / visible index helpers。Use when: 修改此模組追蹤檔案時載入。'
scopePath: null
last_updated: '2026-06-15T00:47:16+08:00'
status: stable
staleness: 0
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-15-001
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
  tool_scope: []
memory_quality_version: 1
memory_kind: implementation
verification_status: verified
last_verified: '2026-06-15T00:47:16+08:00'
valid_scope:
  - src/visible-index.ts
  - src/project-file-list.ts
  - src/tests/visible-index.test.ts
  - src/tests/project-file-list.test.ts
---
# core types / visible index helpers — Module Memory

## Current Truth

- This card owns visible-index filtering and repository file-list helpers shared by index, MCP, extension, and desktop surfaces.
- Memory governance artifacts under .agents/memory and .agents/skills/mem-* are filtered out of product untracked views.
- Project file listing lives outside desktop monitoring so memory reindex no longer imports the desktop monitor module.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in description and Chinese summary.
- Use dependencies only for true staleness propagation; use Relations for navigation.
- Do not rewrite archive volumes during active-card standardization.
- Treat missing evidence as pending review, not as complete quality.

## Cycle Events

- 01: Standardized memory ownership and YAML valid_scope for the 5.5.1 governance repair.

## Archive Index

- None yet.

## Evidence Base

- source:src/visible-index.ts
- source:src/project-file-list.ts
- source:src/tests/visible-index.test.ts
- source:src/tests/project-file-list.test.ts

## Read Contract

- Read this card before editing core-types.visible-index tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession

- None recorded.

## 中文摘要

- 可見索引與專案檔案列舉已成為共用 helper。
- 重建索引與桌面監控不再因檔案列舉互相依賴。

## Tracked Files

- src/visible-index.ts
- src/project-file-list.ts
- src/tests/visible-index.test.ts
- src/tests/project-file-list.test.ts

## Relations

- core-types（parent overview）
- core-types.foundation（shared contracts）
- index-manager（consumer and compatibility re-export）
- desktop-console.monitoring（consumer through monitoring/file-list re-export）
- mcp-tools.handlers（consumer through memory_reindex）
