---
name: injector
description: >
  專案記憶：基底卡匣注入器模組（已廢除）。 Use when: 查詢此模組的歷史架構決策紀錄。 此模組已於 v3.0.0
  正式廢除，不再管理任何作業中的原始碼檔案。
last_updated: '2026-06-04T07:17:27+08:00'
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
  version: '3.0'
  origin: project
  memory_awareness: none
  tool_scope: []
---


# extension / injector — Module Memory

## Current Truth

- This card is the schema v2 memory owner for extension.injector.
- This card owns no implementation files and is retained only for historical lookup.
- Legacy decisions, lessons, and repair notes were preserved in archive-001.md.
- No staleness propagation dependency is recorded in frontmatter.
- Directory nesting is navigation; parent-child placement is not a dependency by itself.
- This card records a deprecated or historical scope and should not regain source ownership unless the module is restored.

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

- extension.injector 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
- 此卡偏歷史歸檔用途，除非模組恢復，否則不新增原始碼歸屬。

## Tracked Files

- （歷史歸檔，不追蹤實體檔案）

## Relations

- extension（父卡：由外掛主流程編排）

## Applicable Skills

- security-sre
