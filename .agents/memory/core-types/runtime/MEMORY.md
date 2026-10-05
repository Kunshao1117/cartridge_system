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
verification_status: pending_review
last_verified: '2026-06-15T00:47:16+08:00'
valid_scope:
  - src/config.ts
  - src/path-guard.ts
  - src/staleness.ts
  - src/timestamp.ts
  - src/tests/path-guard.test.ts
  - src/tests/staleness.test.ts
  - src/tests/timestamp.test.ts
  - docs/security-boundaries.md
  - src/file-containment.ts
  - src/safe-frontmatter.ts
  - src/tracked-path.ts
  - src/tests/file-containment-race.test.ts
---
# core types / runtime helpers — Module Memory

## Current Truth


- Owns shared configuration, path safety, tracked-path identity, data-only frontmatter, staleness classification and Taiwan timestamp helpers; shared TypeScript contracts remain in `core-types.foundation`.
- All production gray-matter access passes through `safe-frontmatter`: YAML/YML/JSON data only, no executable engine, with bounded acyclic data graphs and preservation of supported dates and unknown keys.
- Final read/write/open boundaries require both lexical and physical project containment. Configured roots and internal links are allowed only inside the trusted project root.
- In 5.5.8, a realpath ENOENT restarts resolution from the original candidate at most three total attempts. Other errors, persistent churn, dangling or escaping links fail closed.
- `canonicalTrackedPath` unifies ordinary path spellings while retaining suspicious traversal/foreign-root syntax for downstream rejection; normalization does not authorize I/O.
- These checks are not an OS sandbox or a guarantee against arbitrary hostile concurrent ancestor replacement. The security-boundaries document describes an earlier batch; current CI packaging behavior is owned by `release-packaging`.

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


- source:https://github.com/Kunshao1117/cartridge_system/blob/3f346804c8c72944a2c61a46544421c9f9009ef2/.agents/memory/core-types/runtime/MEMORY.md — reviewed original card revision.
- source:https://github.com/Kunshao1117/cartridge_system/tree/3f346804c8c72944a2c61a46544421c9f9009ef2 — source tree for this static claim/ownership review; use Tracked Files for the exact source slice.

## Read Contract

- Read this card before editing core-types.runtime tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession


- Static comparison target: 5.5.8 source 3f346804c8c72944a2c61a46544421c9f9009ef2. Historical cycle/archive records remain unchanged; old validation IDs do not establish current runtime acceptance.

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
- docs/security-boundaries.md
- src/file-containment.ts
- src/safe-frontmatter.ts
- src/tracked-path.ts
- src/tests/file-containment-race.test.ts

## Relations

- core-types（parent overview）
- core-types.foundation（shared contracts）
- core-types.visible-index（shared visible filtering helper）
- core-types.memory-main-file（main-file quality types）
