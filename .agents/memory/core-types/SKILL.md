---
name: core-types
scopePath: src/
description: |
  專案記憶：共用型別、設定與跨層小工具模組。 Use when: 處理系統共用型別定義、設定工廠函式、路徑驗證、時間戳或 staleness 等級轉換時載入。
last_updated: '2026-06-14T19:15:58+08:00'
status: stable
staleness: 0
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 2
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
---

# core types — Module Memory

## Current Truth

- This card is the schema v2 memory owner for core-types.
- Its implementation boundary is the tracked file list below.
- Legacy decisions, lessons, and repair notes were preserved in archive-001.md.
- No staleness propagation dependency is recorded in frontmatter.
- This is a root-level memory card unless Relations says otherwise.
- Current behavior must still be verified against source before edits.
- Memory warning classification counts only visible product untracked files.
- Memory main-file resolution is centralized in the shared memory-main-file helper and enforces exact MEMORY.md / SKILL.md casing.
- Content quality analysis now treats verified cards without actionable Evidence Base entries as pending review.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in the description and Chinese summary.
- Add at most one Cycle Events item per update and compact before event 31.
- Do not restore legacy Key Decisions or Module Lessons into the main card body.
- The tracked file count is a split advisory only; split when hard limits, mixed ownership, or maintenance difficulty appear.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Updated memory warning classification to ignore managed memory archive residues in untracked counts.
- 03: Added exact memory main-file casing and Evidence Base quality gates.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## 中文摘要

- core-types 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 追蹤檔案數偏高屬拆分建議，不單獨阻擋提交。
- 未歸屬 blocker 只針對產品檔案，記憶歸檔卷不計入。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- src/types.ts
- src/config.ts
- src/memory-compaction.ts
- src/path-guard.ts
- src/staleness.ts
- src/timestamp.ts
- src/memory-main-file.ts
- src/tests/memory-compaction.test.ts
- src/tests/memory-main-file.test.ts
- src/tests/path-guard.test.ts
- src/tests/staleness.test.ts
- src/tests/timestamp.test.ts

## Relations

- analyzer（引用 CartridgeConfig、StalenessLevel、FileEventType）
- index-manager（引用 CartridgeConfig、CartridgeEntry、CartridgeIndex、getSkillsAbsPath）
- watcher（引用 CartridgeConfig、FileEventType）
- writer（引用 CartridgeConfig、StalenessLevel）
- injector（引用 CartridgeConfig、InjectionReportItem、InjectionStatus）
- extension（引用 createConfig）

## Applicable Skills

- code-quality
