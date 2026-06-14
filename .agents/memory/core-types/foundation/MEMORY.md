---
name: core-types.foundation
description: '專案記憶：core types / shared contracts。Use when: 修改跨 MCP、extension、desktop 共用型別時載入。'
scopePath: null
last_updated: '2026-06-15T00:55:00+08:00'
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
last_verified: '2026-06-15T00:55:00+08:00'
valid_scope:
  - src/types.ts
---
# core types / shared contracts — Module Memory

## Current Truth

- This card owns shared TypeScript contracts used across extension, MCP, desktop, and memory governance helpers.
- Moving contracts out of runtime prevents visible-index and staleness ownership from forming a memory dependency cycle.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in description and Chinese summary.
- Use dependencies only for true staleness propagation; use Relations for navigation.
- Do not rewrite archive volumes during active-card standardization.
- Treat missing evidence as pending review, not as complete quality.

## Cycle Events

- 01: Split shared contracts from runtime helpers during the 5.5.1 governance repair.

## Archive Index

- None yet.

## Evidence Base

- source:src/types.ts

## Read Contract

- Read this card before editing src/types.ts or changing shared contract ownership.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession

- None recorded.

## 中文摘要

- 共用型別已拆出 foundation 卡。
- 此拆分清除 visible-index 與 runtime helper 的記憶依賴循環。

## Tracked Files

- src/types.ts

## Relations

- core-types（parent overview）
- core-types.runtime（consumer）
- core-types.visible-index（consumer）
- index-manager（consumer）
