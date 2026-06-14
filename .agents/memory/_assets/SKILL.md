---
name: _assets
scopePath: null
description: |
  專案記憶：靜態檔案與一般文檔收納。 Use when: 處理不需要業務邏輯追蹤的靜態圖檔、授權文件或更新日誌等。
last_updated: '2026-06-04T08:20:00+08:00'
status: stale
staleness: 20
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
  version: '1.2'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
---
<!-- CARTRIDGE_SYSTEM_WARNING_START -->

> [!CAUTION]
> 🟠 **系統強制攔截**：此記憶已過期失真！
> 追蹤檔案異動：`README.md`、`CHANGELOG.md`（2026-06-14T23:07:24+08:00）
> AI 嚴禁基於此記憶施工，必須優先閱讀最新原始碼並更新此記憶卡。
> staleness: 20 | threshold: 🟠 顯著過期

<!-- CARTRIDGE_SYSTEM_WARNING_END -->

# _assets — Module Memory

## Current Truth

- This card is the schema v2 memory owner for _assets.
- Its implementation boundary is the tracked file list below.
- Legacy decisions, lessons, and repair notes were preserved in archive-001.md.
- No staleness propagation dependency is recorded in frontmatter.
- This is a root-level memory card unless Relations says otherwise.
- Current behavior must still be verified against source before edits.
- README and CHANGELOG now document 5.4.3, 37 test files, 285 test cases, and the archive-untracked repair.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in the description and Chinese summary.
- Add at most one Cycle Events item per update and compact before event 31.
- Do not restore legacy Key Decisions or Module Lessons into the main card body.
- Keep Tracked Files focused on files this card can actually explain.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Updated release documentation for 5.4.3, including VSIX, npm, Desktop tags, and test totals.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## 中文摘要

- _assets 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
- README 與 CHANGELOG 已同步 5.4.3 發布、三線 tag 與 37 檔 285 案例。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- README.md
- CHANGELOG.md
- LICENSE
- assets/logo.png
- assets/cartridge-activity.svg
- desktop-assets/cartridge-desktop.ico

## Relations

- 無

## Applicable Skills

- memory-ops
