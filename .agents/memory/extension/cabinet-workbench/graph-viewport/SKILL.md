---
name: extension.cabinet-workbench.graph-viewport
description: >
  專案記憶：卡匣機櫃圖譜視角狀態輔助層。Use when: 修改圖譜 viewport 保存、layout reason 判斷、 可讀 zoom clamp
  或相關回歸測試時載入。
last_updated: '2026-06-04T07:15:30+08:00'
status: stable
staleness: 0
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
    - 'filesystem:write'
    - 'terminal:test'
---
# extension / cabinet workbench / graph viewport — Module Memory

## Current Truth

- This card is the schema v2 memory owner for extension.cabinet-workbench.graph-viewport.
- Its implementation boundary is the tracked file list below.
- Legacy decisions, lessons, and repair notes were preserved in archive-001.md.
- No staleness propagation dependency is recorded in frontmatter.
- Directory nesting is navigation; parent-child placement is not a dependency by itself.
- Current behavior must still be verified against source before edits.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in the description and Chinese summary.
- Add at most one Cycle Events item per update and compact before event 31.
- Do not restore legacy Key Decisions or Module Lessons into the main card body.
- Keep Tracked Files focused on files this card can actually explain.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## 中文摘要

- extension.cabinet-workbench.graph-viewport 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- src/cabinet-graph-viewport.ts
- src/tests/cabinet-graph-viewport.test.ts

## Relations

- extension.cabinet-workbench（父卡：卡匣機櫃 Webview 與模型）

## Applicable Skills

- memory-ops
- ui-ux-standards
