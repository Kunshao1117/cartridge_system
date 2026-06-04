---
name: index-manager
description: >
  專案記憶：記憶索引管理器模組。管理卡匣索引、檔案反向映射、離線偵測、未歸屬檔案池、Cache-First 持久化。Use when:
  處理卡匣索引、檔案反向映射、持久化讀寫時載入。
last_updated: '2026-06-04T08:01:01+08:00'
status: stable
staleness: 0
dependencies:
  - core-types
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
  version: '3.1'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:write'
---

# index manager — Module Memory

## Current Truth

- This card is the schema v2 memory owner for index-manager.
- Its implementation boundary is the tracked file list below.
- Legacy decisions, lessons, and repair notes were preserved in archive-001.md.
- Frontmatter dependencies are retained as staleness propagation dependencies and must not be used for navigation-only links.
- This is a root-level memory card unless Relations says otherwise.
- Current behavior must still be verified against source before edits.
- Managed memory internals under `.agents/memory/**` and `.agents/skills/mem-*` are excluded from untracked file detection and refiltering.
- `getVisibleIndex()` and shared visible-untracked helpers are the canonical read path for UI, MCP summaries, and desktop snapshots.

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
- 02: Excluded managed memory internals from the untracked file pool so schema v2 archive volumes are not treated as orphan product files.
- 03: Added a canonical visible index view and persisted cleanup so stale archive-volume residues cannot leak into product untracked displays.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## 中文摘要

- index-manager 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
- 記憶系統內部檔案不會進入未歸屬產品檔案池。
- UI、MCP 與桌面快照都應透過乾淨索引視圖讀取未歸屬數。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- src/index-manager.ts
- src/smart-owner.ts
- src/tests/index-manager.test.ts
- src/tests/detect-missed-changes.test.ts

## Relations

- watcher（extension 子卡：提供監聯檔案清單）
- analyzer（extension 子卡：接收過期指數更新）
- mcp-tools（根層模組：第二階段對外暴露查詢能力）
- gitignore-filter（根層模組：detectUntrackedFiles 需要 GitignoreFilter 實例）

## Applicable Skills

- test-patterns
_此模組的子節點：index-manager.dep-engine_
