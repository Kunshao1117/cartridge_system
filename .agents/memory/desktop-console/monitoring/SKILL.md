---
name: desktop-console.monitoring
description: >
  專案記憶：桌面版純 Node 多專案監控 runtime。Use when: 處理桌面監控核心、Node 檔案監聽、 多專案快照、共享 watcher
  規則或監控測試時載入。
last_updated: '2026-06-04T08:01:01+08:00'
status: stable
staleness: 0
dependencies:
  - index-manager
  - extension.watcher
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 3
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

# desktop console / monitoring — Module Memory

## Current Truth

- This card is the schema v2 memory owner for desktop-console.monitoring.
- Its implementation boundary is the tracked file list below.
- Legacy decisions, lessons, and repair notes were preserved in archive-001.md.
- Frontmatter dependencies are retained as staleness propagation dependencies and must not be used for navigation-only links.
- Directory nesting is navigation; parent-child placement is not a dependency by itself.
- Current behavior must still be verified against source before edits.
- Non-SKILL memory internals are managed artifacts; archive volume file events do not enter the untracked file pool.
- Desktop project snapshots are built from a visible index view before publishing counts to the renderer.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in the description and Chinese summary.
- Add at most one Cycle Events item per update and compact before event 31.
- Do not restore legacy Key Decisions or Module Lessons into the main card body.
- Keep Tracked Files focused on files this card can actually explain.

## Known Issues

- None active. Dependency rationale: index-manager, extension.watcher are upstream dependencies; upstream staleness must trigger review for this card.


## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Ignored schema v2 memory archive volume events in project monitoring to keep untracked product files clean.
- 03: Routed monitor snapshots through visible index filtering so desktop counts match VS Code and MCP untracked counts.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## 中文摘要

- desktop-console.monitoring 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
- 監控事件會忽略記憶歸檔卷，不把它們列為未歸屬產品檔案。
- 桌面快照的未歸屬數與 VS Code/MCP 使用同一套乾淨索引視圖。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- src/monitoring/file-list.ts
- src/monitoring/project-event-handler.ts
- src/monitoring/node-project-watcher.ts
- src/monitoring/project-snapshot.ts
- src/monitoring/project-monitor.ts
- src/monitoring/multi-project-monitor.ts
- src/tests/monitoring-event-handler.test.ts
- src/tests/desktop-snapshot.test.ts

## Relations

- desktop-console（parent card）
- desktop-console.app（下游：Electron 主程序消費多專案快照）
- extension.watcher（共享事件規則）
- index-manager（索引與未歸屬/幽靈狀態來源）

## Applicable Skills

- test-patterns
- code-quality
