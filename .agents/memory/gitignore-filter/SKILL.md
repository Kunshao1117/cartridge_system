---
name: gitignore-filter
description: >
  專案記憶：Gitignore 排除引擎模組。讀取 .gitignore 規則進行路徑排除過濾。Use when:
  涉及檔案掃描、監聽排除、未歸屬檔案偵測時載入。
last_updated: '2026-06-04T07:17:51+08:00'
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
---
# gitignore filter — Module Memory

## Current Truth

- This card is the schema v2 memory owner for gitignore-filter.
- Its implementation boundary is the tracked file list below.
- Legacy decisions, lessons, and repair notes were preserved in archive-001.md.
- No staleness propagation dependency is recorded in frontmatter.
- This is a root-level memory card unless Relations says otherwise.
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

- gitignore-filter 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- src/gitignore-filter.ts
- .gitignore

## Relations

- index-manager（根層模組：detectUntrackedFiles 傳入 GitignoreFilter 實例）
- watcher（extension 子卡：chokidar ignored 回呼使用 GitignoreFilter）
- extension（extension 子卡：啟動時初始化 GitignoreFilter 實例）

## Applicable Skills

- test-patterns
