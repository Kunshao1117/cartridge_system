---
name: extension
description: >
  專案記憶：VS Code 外掛入口與 UI 模組。 Use when:
  處理外掛啟動生命週期、指令註冊、狀態列/TreeView/CodeLens/智慧歸屬等 UI 更新時載入。
last_updated: '2026-06-15T00:55:00+08:00'
status: stable
staleness: 0
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 5
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
memory_quality_version: 1
memory_kind: implementation
verification_status: verified
last_verified: '2026-06-15T00:55:00+08:00'
valid_scope:
  - src/extension.ts
  - src/update-checker.ts
  - src/tests/update-checker.test.ts
  - src/governance-views.ts
  - src/status-bar.ts
  - src/tests/status-bar.test.ts
  - src/treeview-provider.ts
  - src/codelens-provider.ts
scopePath: null
---
# extension — Module Memory

## Current Truth

- This card owns the VS Code extension entrypoint, status bar, TreeView, CodeLens, update checks, and governance views.
- Legacy decisions, lessons, and repair notes are preserved in archive-001.md.
- Extension status, health report, TreeView, and scan refreshes use the visible index view for untracked counts.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in description and Chinese summary.
- Use dependencies only for true staleness propagation; use Relations for navigation.
- Do not rewrite archive volumes during active-card standardization.
- Treat missing evidence as pending review, not as complete quality.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Routed status bar, health report, scan refresh, and TreeView untracked displays through the visible index view.
- 03: Standardized active memory main file to MEMORY.md with quality metadata and evidence sections.
- 04: Standardized memory ownership and YAML valid_scope for the 5.5.1 governance repair.
- 05: Synced status-bar ownership after visible-index helper extraction for 5.5.1.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## Evidence Base

- source:src/extension.ts
- source:src/update-checker.ts
- source:src/tests/update-checker.test.ts
- source:src/governance-views.ts
- source:src/status-bar.ts
- source:src/tests/status-bar.test.ts
- source:src/treeview-provider.ts
- source:src/codelens-provider.ts

## Read Contract

- Read this card before editing extension tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession

- None recorded.

## 中文摘要

- extension 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 舊版決策與課題保存在 archive-001.md。
- 外掛狀態列與健康報告不會再把記憶歸檔卷顯示成未歸屬檔案。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- src/extension.ts
- src/update-checker.ts
- src/tests/update-checker.test.ts
- src/governance-views.ts
- src/status-bar.ts
- src/tests/status-bar.test.ts
- src/treeview-provider.ts
- src/codelens-provider.ts

## Relations

- core-types / index-manager / mcp-tools（shared services）
- injector / watcher / analyzer / writer（extension lifecycle helpers）
- cabinet-workbench / treeview-provider / codelens-provider（使用 extension UI lifecycle）
