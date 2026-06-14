---
name: core-types.memory-compaction
description: '專案記憶：core types / memory compaction。Use when: 修改此模組追蹤檔案時載入。'
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
  - src/memory-compaction.ts
  - src/tests/memory-compaction.test.ts
---
# core types / memory compaction — Module Memory

## Current Truth

- This card owns schema v2 compaction metrics, archive volume metrics, cycle-event limits, line limits, and language-ratio signals.
- Compaction metrics are advisory or blocking inputs for MCP, extension, desktop, and memory audit summaries.

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

- source:src/memory-compaction.ts
- source:src/tests/memory-compaction.test.ts

## Read Contract

- Read this card before editing core-types.memory-compaction tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession

- None recorded.

## 中文摘要

- 壓縮治理度量已拆成獨立卡。
- 此卡承接主卡大小、行數、週期事件與歸檔卷度量。

## Tracked Files

- src/memory-compaction.ts
- src/tests/memory-compaction.test.ts

## Relations

- core-types（parent overview）
- index-manager（consumer: scan compaction metrics）
- mcp-tools.handlers（consumer: memory_commit warnings）
- mcp-tools.memory-audit（consumer: audit findings）
