---
name: desktop-console.renderer.styles
description: '專案記憶：desktop console / renderer styles。Use when: 修改此模組追蹤檔案時載入。'
scopePath: null
last_updated: '2026-06-15T00:47:16+08:00'
status: stable
staleness: 0
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-15-001
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
  tool_scope: []
memory_quality_version: 1
memory_kind: implementation
verification_status: verified
last_verified: '2026-06-15T00:47:16+08:00'
valid_scope:
  - src/desktop/renderer/desktopStyles.ts
  - src/desktop/renderer/detailStyles.ts
  - src/desktop/renderer/styles.css
---
# desktop console / renderer styles — Module Memory

## Current Truth

- This card owns renderer style modules and global CSS for dense desktop monitoring layouts.
- Style changes must preserve readable panels, stable scroll regions, and no incoherent text overlap.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in description and Chinese summary.
- Use dependencies only for true staleness propagation; use Relations for navigation.
- Do not rewrite archive volumes during active-card standardization.
- Treat missing evidence as pending review, not as complete quality.

## Cycle Events

- 01: Standardized memory ownership and YAML valid_scope for the 5.5.1 governance repair.

## Archive Index

- None yet.

## Evidence Base

- source:src/desktop/renderer/desktopStyles.ts
- source:src/desktop/renderer/detailStyles.ts
- source:src/desktop/renderer/styles.css

## Read Contract

- Read this card before editing desktop-console.renderer.styles tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession

- None recorded.

## 中文摘要

- 桌面 renderer 樣式已拆成子卡。
- 此卡承接桌面控制台的密度、捲動與樣式約束。

## Tracked Files

- src/desktop/renderer/desktopStyles.ts
- src/desktop/renderer/detailStyles.ts
- src/desktop/renderer/styles.css

## Relations

- desktop-console.renderer（parent overview）
- desktop-console.renderer.panels（style consumer）
