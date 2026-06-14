---
name: core-types
scopePath: null
description: |
  專案記憶：共用型別、設定與跨層小工具模組。 Use when: 處理系統共用型別定義、設定工廠函式、路徑驗證、時間戳或 staleness 等級轉換時載入。
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
    - 'filesystem:write'
memory_quality_version: 1
memory_kind: overview
verification_status: verified
last_verified: '2026-06-15T00:47:16+08:00'
valid_scope:
  - .agents/memory/core-types
---
# core types — Module Memory

## Current Truth

- This card is the parent overview for core runtime helpers, main-file parsing, compaction, and visible-index utilities.
- Direct source ownership is delegated to child cards so dependency cycles and granularity warnings stay visible.
- The parent card stores navigation and shared constraints only.
- Archive volumes preserve the pre-split core-types history.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in description and Chinese summary.
- Use dependencies only for true staleness propagation; use Relations for navigation.
- Do not rewrite archive volumes during active-card standardization.
- Treat missing evidence as pending review, not as complete quality.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Updated memory warning classification to ignore managed memory archive residues in untracked counts.
- 03: Added exact memory main-file casing and Evidence Base quality gates.
- 04: Standardized active memory main file to MEMORY.md with quality metadata and evidence sections.
- 05: Standardized memory ownership and YAML valid_scope for the 5.5.1 governance repair.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## Evidence Base

- source:.agents/memory/core-types

## Read Contract

- Read this card before editing core-types tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession

- None recorded.

## 中文摘要

- core-types 已改為父層總覽卡。
- 實作檔案改由四張子卡承接，避免單卡過大與依賴循環。

## Tracked Files

- （父層總覽，不直接追蹤實作檔案）

## Relations

- core-types.foundation（child card: shared TypeScript contracts）
- core-types.runtime（child card: config, path, timestamp, staleness helpers）
- core-types.visible-index（child card: visible index and project file listing helpers）
- core-types.memory-main-file（child card: memory main-file resolution and quality analysis）
- core-types.memory-compaction（child card: compaction and archive metrics）
- index-manager（consumer: index scanning and visible index persistence）
