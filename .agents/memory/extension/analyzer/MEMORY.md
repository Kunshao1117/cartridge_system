---
name: extension.analyzer
description: |
  專案記憶：過期分析器模組。 Use when: 處理過期指數計算、衰退演算法、異動事件處理時載入。
last_updated: '2026-06-15T00:47:16+08:00'
status: stable
staleness: 0
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
  version: '2.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
memory_quality_version: 1
memory_kind: implementation
verification_status: verified
last_verified: '2026-06-15T00:47:16+08:00'
valid_scope:
  - src/analyzer.ts
  - src/tests/analyzer.test.ts
scopePath: null
---
# extension / analyzer — Module Memory

## Current Truth

- This card owns staleness analysis and warning-trigger orchestration for tracked file events.
- Analyzer consumes index-manager state through its public manager interface and does not own index persistence.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
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

## Evidence Base

- source:src/analyzer.ts
- source:src/tests/analyzer.test.ts

## Read Contract

- Read this card before editing extension.analyzer tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession

- None recorded.

## 中文摘要

- extension.analyzer 的半截路徑已修正。
- 此卡有效範圍改為明確 YAML 清單。

## Tracked Files

- src/analyzer.ts
- src/tests/analyzer.test.ts

## Relations

- extension（parent card）
- extension.watcher（event source）
- extension.writer（warning writer）
- index-manager（index state source）
- core-types.runtime（staleness and config types）
