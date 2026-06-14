---
name: index-manager
description: >
  專案記憶：記憶索引管理器模組。管理卡匣索引、檔案反向映射、離線偵測、未歸屬檔案池、Cache-First 持久化。Use when:
  處理卡匣索引、檔案反向映射、持久化讀寫時載入。
last_updated: '2026-06-15T00:47:16+08:00'
status: stale
staleness: 0
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 6
cycle_event_limit: 30
size_limit_bytes: 16384
line_limit: 120
archive_policy: volume
compaction_status: ready
metadata:
  author: antigravity
  version: '3.1'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:write'
memory_quality_version: 1
memory_kind: implementation
verification_status: verified
last_verified: '2026-06-15T00:47:16+08:00'
valid_scope:
  - src/index-manager.ts
  - src/memory-reindex.ts
  - src/smart-owner.ts
  - src/tests/index-manager.test.ts
  - src/tests/detect-missed-changes.test.ts
scopePath: null
---
# index manager — Module Memory

## Current Truth

- This card owns memory index scanning, persistence, fileMap ownership, reindex orchestration, and smart owner suggestions.
- Visible untracked filtering is implemented in core-types.visible-index and re-exported here for compatibility.
- Memory reindex now imports project file listing from the shared helper instead of desktop monitoring.
- Index scanning uses the shared main-file resolver and records parent directories as missing when they only contain child cards.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in description and Chinese summary.
- Use dependencies only for true staleness propagation; use Relations for navigation.
- Do not rewrite archive volumes during active-card standardization.
- Treat missing evidence as pending review, not as complete quality.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Excluded managed memory internals from the untracked file pool so schema v2 archive volumes are not treated as orphan product files.
- 03: Added a canonical visible index view and persisted cleanup so stale archive-volume residues cannot leak into product untracked displays.
- 04: Shared the missing-parent main-file rule between index scanning and audit dry runs.
- 05: Standardized active memory main file to MEMORY.md with quality metadata and evidence sections.
- 06: Standardized memory ownership and YAML valid_scope for the 5.5.1 governance repair.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## Evidence Base

- source:src/index-manager.ts
- source:src/memory-reindex.ts
- source:src/smart-owner.ts
- source:src/tests/index-manager.test.ts
- source:src/tests/detect-missed-changes.test.ts

## Read Contract

- Read this card before editing index-manager tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession

- None recorded.

## 中文摘要

- 索引管理器保留掃描、持久化與 fileMap 職責。
- 可見未歸屬過濾已抽出共用 helper 並保留相容出口。

## Tracked Files

- src/index-manager.ts
- src/memory-reindex.ts
- src/smart-owner.ts
- src/tests/index-manager.test.ts
- src/tests/detect-missed-changes.test.ts

## Relations

- core-types.visible-index（shared visible index helper）
- core-types.memory-main-file（main-file resolver）
- core-types.memory-compaction（compaction metrics）
- index-manager.dep-engine（child card: dependency graph and staleness propagation）
- gitignore-filter（ignore filtering）
