---
name: dep-engine
description: |
  專案記憶：依賴推導引擎模組。 Use when: 處理模組間 import 掃描、依賴圖建構、間接過期傳播與循環偵測時載入。
last_updated: '2026-06-04T07:18:04+08:00'
status: stable
staleness: 0
dependencies:
  - core-types
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
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
  tool_scope:
    - 'filesystem:read'
---
# index manager / dep engine — Module Memory

## Current Truth

- This card is the schema v2 memory owner for index-manager.dep-engine.
- Its implementation boundary is the tracked file list below.
- Legacy decisions, lessons, and repair notes were preserved in archive-001.md.
- Frontmatter dependencies are retained as staleness propagation dependencies and must not be used for navigation-only links.
- Directory nesting is navigation; parent-child placement is not a dependency by itself.
- Current behavior must still be verified against source before edits.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in the description and Chinese summary.
- Add at most one Cycle Events item per update and compact before event 31.
- Do not restore legacy Key Decisions or Module Lessons into the main card body.
- Keep Tracked Files focused on files this card can actually explain.

## Known Issues

- None active. Dependency rationale: core-types are upstream dependencies; upstream staleness must trigger review for this card.


## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## 中文摘要

- index-manager.dep-engine 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- src/import-resolver.ts
- src/dependency-propagator.ts
- src/dependency-semantics.ts
- src/tests/import-resolver.test.ts
- src/tests/dependency-propagator.test.ts
- src/tests/dependency-semantics.test.ts

## Relations

- index-manager（父卡與資料來源：提供 CartridgeEntry / trackedFiles / fileMap 的執行期索引資料）
- core-types（根層型別：CartridgeEntry, CartridgeConfig 定義所在）
- mcp-tools（根層模組：memory_deps 工具呼叫本引擎）
- mcp-tools.handlers（消費：memory_commit 整合 dependencies 語義警告）

## Applicable Skills

- test-patterns
