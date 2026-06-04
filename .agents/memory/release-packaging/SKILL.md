---
name: release-packaging
scopePath: scripts/
description: >
  專案記憶：VSIX 發行打包輔助腳本。Use when: 修改本機 VSIX 打包流程、處理 VSCE 與 npm files
  白名單衝突、重打包安裝檔或調整發布腳本時載入。
last_updated: '2026-06-04T08:20:00+08:00'
status: stable
staleness: 0
dependencies:
  - _system
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
    - 'terminal:test'
---
# release packaging — Module Memory

## Current Truth

- This card is the schema v2 memory owner for release-packaging.
- Its implementation boundary is the tracked file list below.
- Legacy decisions, lessons, and repair notes were preserved in archive-001.md.
- Frontmatter dependencies are retained as staleness propagation dependencies and must not be used for navigation-only links.
- This is a root-level memory card unless Relations says otherwise.
- Current behavior must still be verified against source before edits.
- The 5.4.3 release uses split tags: VSIX via v5.4.3, npm runtime via npm-v5.4.3, and Desktop Console via desktop-v5.4.3.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in the description and Chinese summary.
- Add at most one Cycle Events item per update and compact before event 31.
- Do not restore legacy Key Decisions or Module Lessons into the main card body.
- Keep Tracked Files focused on files this card can actually explain.

## Known Issues

- None active. Dependency rationale: _system are upstream dependencies; upstream staleness must trigger review for this card.


## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Recorded 5.4.3 split-release packaging targets after the archive-untracked repair.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## 中文摘要

- release-packaging 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
- 5.4.3 發布沿用 VSIX、npm runtime、Desktop Console 三線 tag 分流。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- scripts/package-vsix.mjs

## Relations

- _system（系統設定、package manifest 與 GitHub Actions）
- _assets（README / CHANGELOG 發布文件）

## Applicable Skills

- memory-ops
- memory-arch
