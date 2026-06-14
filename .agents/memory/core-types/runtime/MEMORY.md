---
name: core-types.runtime
description: '專案記憶：core types / runtime helpers。Use when: 修改此模組追蹤檔案時載入。'
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
  - src/config.ts
  - src/path-guard.ts
  - src/staleness.ts
  - src/timestamp.ts
  - src/tests/path-guard.test.ts
  - src/tests/staleness.test.ts
  - src/tests/timestamp.test.ts
---
# core types / runtime helpers — Module Memory

## Current Truth

- This card owns shared configuration, path safety, staleness classification, and Taiwan timestamp helpers.
- Shared TypeScript contracts are owned by core-types.foundation.
- Warning classification imports visible-index helpers directly so it does not depend on index-manager.
- These helpers are consumed by extension, MCP, desktop, and governance summary surfaces.

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

- source:src/config.ts
- source:src/path-guard.ts
- source:src/staleness.ts
- source:src/timestamp.ts
- source:src/tests/path-guard.test.ts
- source:src/tests/staleness.test.ts
- source:src/tests/timestamp.test.ts

## Read Contract

- Read this card before editing core-types.runtime tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession

- None recorded.

## 中文摘要

- 共用 runtime helper 已拆出獨立卡。
- 過期分類不再為了可見未歸屬過濾而反向依賴索引管理器。

## Tracked Files

- src/config.ts
- src/path-guard.ts
- src/staleness.ts
- src/timestamp.ts
- src/tests/path-guard.test.ts
- src/tests/staleness.test.ts
- src/tests/timestamp.test.ts

## Relations

- core-types（parent overview）
- core-types.foundation（shared contracts）
- core-types.visible-index（shared visible filtering helper）
- core-types.memory-main-file（main-file quality types）
