---
name: core-types.visible-index
scopePath: null
dependencies:
  - core-types.runtime
description: >
  專案記憶：跨桌面、VS Code 與 MCP 共用的可見索引、檔案列舉與專案健康投影。Use when: 修改未歸屬顯示、fallback
  列舉或共用健康狀態時載入。
last_updated: '2026-07-11T14:52:05+08:00'
status: stable
staleness: 0
memory_schema_version: 2
memory_quality_version: 1
memory_kind: source_fact
verification_status: verified
last_verified: '2026-07-11T14:40:20+08:00'
valid_scope: current-project
content_language: en
human_language: zh-TW
cycle_id: 2026-06-15-001
cycle_event_count: 2
cycle_event_limit: 30
size_limit_bytes: 16384
line_limit: 120
archive_policy: volume
compaction_status: ready
metadata:
  author: antigravity
  version: '1.1'
  origin: project
  memory_awareness: full
  tool_scope: []
---
# core types / visible index helpers — Module Memory

## Current Truth

- This card owns the shared visible-index projection, fallback project-file listing, and canonical project health calculation.
- `listProjectFiles` is a fallback-only recursive enumerator used when Git discovery is unavailable or fails.
- Managed memory artifacts are excluded from product-facing untracked views.
- `projectCanonicalHealth` derives the same health and untracked counts for Desktop and VS Code from committed index state.
- Canonical health carries a nonfatal synchronization warning when external state cannot be safely reloaded.
- Shared placement prevents memory reindex, desktop monitoring, and extension UI from maintaining separate candidate or health semantics.

## Active Constraints

- Keep fallback enumeration separate from Git-standard discovery and expose its degraded mode honestly.
- Product surfaces must consume the same visible projection and canonical health result.
- Runtime contracts from `core-types.runtime` are a real staleness dependency.

## Cycle Events

- 01: Standardized memory ownership and YAML scope for the 5.5.1 governance repair.
- 02: Added shared canonical project health and constrained recursive file listing to fallback use for 5.5.3.

## Archive Index

- None yet.

## Evidence Base

- source:src/visible-index.ts
- source:src/project-file-list.ts
- source:src/project-health.ts
- source:src/tests/visible-index.test.ts
- source:src/tests/project-file-list.test.ts
- source:src/tests/project-health.test.ts
- validation:VD-03 — 5.5.3 cross-runtime state validation provenance.
- review:RD-03 — independent 5.5.3 review provenance.

## Read Contract

- Read this card before changing visible untracked filtering, degraded file discovery, or shared project health.
- Do not use this card as the canonical Git exclusion contract or for runtime-specific UI layout.

## Conflicts and Supersession

- None.

## 中文摘要

- 桌面版與外掛共用同一份可見索引及專案健康計算。
- 遞迴列舉只在 Git 不可用或失敗時降級使用，並保留同步警示。
- 新增的專案健康來源與測試已歸屬此卡。

## Tracked Files

- src/visible-index.ts
- src/project-file-list.ts
- src/project-health.ts
- src/tests/visible-index.test.ts
- src/tests/project-file-list.test.ts
- src/tests/project-health.test.ts

## Relations

- core-types（parent overview）
- core-types.foundation（shared contracts）
- index-manager（canonical persisted state producer）
- desktop-console.monitoring（canonical health consumer）
- extension（canonical health consumer）
- mcp-tools.handlers（visible-index consumer through shared reindex）

## Applicable Skills

- memory-ops — Use for governed updates and staleness repair of this card.
