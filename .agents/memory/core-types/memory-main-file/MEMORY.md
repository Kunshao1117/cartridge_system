---
name: core-types.memory-main-file
description: '專案記憶：core types / memory main file。Use when: 修改此模組追蹤檔案時載入。'
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
  - src/memory-main-file.ts
  - src/tests/memory-main-file.test.ts
---
# core types / memory main file — Module Memory

## Current Truth

- This card owns active memory main-file resolution, exact MEMORY.md / SKILL.md casing, conflict detection, and content quality analysis.
- Archive volumes and legacy archive directories are never treated as active main files.
- Verified quality requires required fields, required sections, verified status, and actionable Evidence Base entries.

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

- source:src/memory-main-file.ts
- source:src/tests/memory-main-file.test.ts

## Read Contract

- Read this card before editing core-types.memory-main-file tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession

- None recorded.

## 中文摘要

- 記憶主檔解析與品質閘門已拆成獨立卡。
- 此卡是 MEMORY.md 相容層的主要治理記憶。

## Tracked Files

- src/memory-main-file.ts
- src/tests/memory-main-file.test.ts

## Relations

- core-types（parent overview）
- index-manager（consumer: scan main-file metadata）
- mcp-tools.handlers（consumer: read and commit resolution）
- mcp-tools.memory-audit（consumer: audit dry-run inventory）
