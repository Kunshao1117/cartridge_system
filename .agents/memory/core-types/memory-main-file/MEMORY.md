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
verification_status: pending_review
last_verified: '2026-06-15T00:47:16+08:00'
valid_scope:
  - src/memory-main-file.ts
  - src/tests/memory-main-file.test.ts
  - src/card-metadata.ts
  - src/memory-card-path.ts
---
# core types / memory main file — Module Memory

## Current Truth


- Owns exact-case MEMORY.md / legacy SKILL.md main-file resolution, conflict/missing detection, content quality, normalized card metadata and the allowed card-write path boundary.
- Two active candidates produce conflict; neither archive volumes nor archive directories become an active main file. A healthy legacy card is not automatically renamed or standardized.
- `assertMemoryCardPath` derives filesystem authority from trusted configured roots, rejects true Skills/archive targets and dual main files, and checks final project containment.
- Quality-complete checks required fields/sections and actionable evidence syntax, not the external truth of the claims. Invalid metadata, future timestamps and quality conflicts remain diagnostics.
- Context inventory, index ingestion and read-only audit share this identity matrix, including parent directories with child cards but no main file.

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


- source:https://github.com/Kunshao1117/cartridge_system/blob/3f346804c8c72944a2c61a46544421c9f9009ef2/.agents/memory/core-types/memory-main-file/MEMORY.md — reviewed original card revision.
- source:https://github.com/Kunshao1117/cartridge_system/tree/3f346804c8c72944a2c61a46544421c9f9009ef2 — source tree for this static claim/ownership review; use Tracked Files for the exact source slice.

## Read Contract

- Read this card before editing core-types.memory-main-file tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession


- Static comparison target: 5.5.8 source 3f346804c8c72944a2c61a46544421c9f9009ef2. Historical cycle/archive records remain unchanged; old validation IDs do not establish current runtime acceptance.

## 中文摘要

- 記憶主檔解析與品質閘門已拆成獨立卡。
- 此卡是 MEMORY.md 相容層的主要治理記憶。

## Tracked Files


- src/memory-main-file.ts
- src/tests/memory-main-file.test.ts
- src/card-metadata.ts
- src/memory-card-path.ts

## Relations

- core-types（parent overview）
- index-manager（consumer: scan main-file metadata）
- mcp-tools.handlers（consumer: read and commit resolution）
- mcp-tools.memory-audit（consumer: audit dry-run inventory）
