---
name: desktop-console.renderer
description: >
  專案記憶：桌面監控台 React + Fluent UI 渲染端。Use when: 修改多專案 UI、狀態卡、 專案詳情、桌面版樣式或 renderer
  build 設定時載入。
last_updated: '2026-06-04T07:15:03+08:00'
status: stable
staleness: 0
dependencies:
  - desktop-console.app
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
# desktop console / renderer — Module Memory

## Current Truth

- This card is the schema v2 memory owner for desktop-console.renderer.
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
- The tracked file count is a split advisory only; split when hard limits, mixed ownership, or maintenance difficulty appear.

## Known Issues

- None active. Dependency rationale: desktop-console.app are upstream dependencies; upstream staleness must trigger review for this card.


## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## 中文摘要

- desktop-console.renderer 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 追蹤檔案數偏高屬拆分建議，不單獨阻擋提交。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- src/desktop/renderer/App.tsx
- src/desktop/renderer/common.tsx
- src/desktop/renderer/main.tsx
- src/desktop/renderer/desktop-api.ts
- src/desktop/renderer/desktopStyles.ts
- src/desktop/renderer/detailStyles.ts
- src/desktop/renderer/issue-drawer.tsx
- src/desktop/renderer/overview.tsx
- src/desktop/renderer/project-detail.tsx
- src/desktop/renderer/settings-panel.tsx
- src/desktop/renderer/sidebar.tsx
- src/desktop/renderer/status.ts
- src/desktop/renderer/styles.css
- src/desktop/renderer/index.html
- src/tests/desktop-renderer-layout.test.ts
- desktop.vite.config.ts

## Relations

- desktop-console（parent card）
- desktop-console.app（上游：IPC 與桌面狀態來源）

## Applicable Skills

- ai-dev-quality-gate
- ui-ux-standards
