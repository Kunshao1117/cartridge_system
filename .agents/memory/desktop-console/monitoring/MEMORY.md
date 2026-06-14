---
name: desktop-console.monitoring
description: >
  專案記憶：桌面版純 Node 多專案監控 runtime。Use when: 處理桌面監控核心、Node 檔案監聽、 多專案快照、共享 watcher
  規則或監控測試時載入。
last_updated: '2026-06-15T00:47:16+08:00'
status: stale
staleness: 0
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 5
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
memory_quality_version: 1
memory_kind: implementation
verification_status: verified
last_verified: '2026-06-15T00:47:16+08:00'
valid_scope:
  - src/monitoring/file-list.ts
  - src/monitoring/project-event-handler.ts
  - src/monitoring/node-project-watcher.ts
  - src/monitoring/project-snapshot.ts
  - src/monitoring/project-monitor.ts
  - src/monitoring/multi-project-monitor.ts
  - src/tests/monitoring-event-handler.test.ts
  - src/tests/desktop-snapshot.test.ts
scopePath: null
---
# desktop console / monitoring — Module Memory

## Current Truth

- This card owns the pure Node multi-project monitoring runtime and desktop snapshot generation.
- Project file listing is re-exported from the shared core-types.visible-index helper to avoid a memory-reindex to desktop-monitoring cycle.
- Memory archive events are managed governance artifacts and do not enter product untracked counts.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in description and Chinese summary.
- Use dependencies only for true staleness propagation; use Relations for navigation.
- Do not rewrite archive volumes during active-card standardization.
- Treat missing evidence as pending review, not as complete quality.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Ignored schema v2 memory archive volume events in project monitoring to keep untracked product files clean.
- 03: Routed monitor snapshots through visible index filtering so desktop counts match VS Code and MCP untracked counts.
- 04: Standardized active memory main file to MEMORY.md with quality metadata and evidence sections.
- 05: Standardized memory ownership and YAML valid_scope for the 5.5.1 governance repair.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## Evidence Base

- source:src/monitoring/file-list.ts
- source:src/monitoring/project-event-handler.ts
- source:src/monitoring/node-project-watcher.ts
- source:src/monitoring/project-snapshot.ts
- source:src/monitoring/project-monitor.ts
- source:src/monitoring/multi-project-monitor.ts
- source:src/tests/monitoring-event-handler.test.ts
- source:src/tests/desktop-snapshot.test.ts

## Read Contract

- Read this card before editing desktop-console.monitoring tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession

- None recorded.

## 中文摘要

- 桌面監控 runtime 保留 8 個追蹤檔案。
- 檔案列舉已改讀共用 helper，避免與重建索引形成循環。

## Tracked Files

- src/monitoring/file-list.ts
- src/monitoring/project-event-handler.ts
- src/monitoring/node-project-watcher.ts
- src/monitoring/project-snapshot.ts
- src/monitoring/project-monitor.ts
- src/monitoring/multi-project-monitor.ts
- src/tests/monitoring-event-handler.test.ts
- src/tests/desktop-snapshot.test.ts

## Relations

- desktop-console（parent card）
- core-types.visible-index（shared file-list and visible filtering helper）
- index-manager（index and ownership state source）
- extension.watcher（shared file event semantics）
