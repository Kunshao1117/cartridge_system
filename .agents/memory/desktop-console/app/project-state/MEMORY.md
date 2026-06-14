---
name: desktop-console.app.project-state
description: '專案記憶：desktop console / app project state。Use when: 修改此模組追蹤檔案時載入。'
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
  - src/desktop/path-guard.ts
  - src/desktop/window-behavior.ts
  - src/desktop/project-store.ts
  - src/desktop/desktop-notifier.ts
  - src/tests/desktop-store.test.ts
  - src/tests/desktop-path-guard.test.ts
  - src/tests/desktop-window-behavior.test.ts
  - src/tests/desktop-notifier.test.ts
---
# desktop console / app project state — Module Memory

## Current Truth

- This card owns desktop project path validation, window behavior policy, project store persistence, desktop notifications, and their tests.
- These files are runtime support for the Electron shell but change independently from IPC channel definitions.

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

- source:src/desktop/path-guard.ts
- source:src/desktop/window-behavior.ts
- source:src/desktop/project-store.ts
- source:src/desktop/desktop-notifier.ts
- source:src/tests/desktop-store.test.ts
- source:src/tests/desktop-path-guard.test.ts
- source:src/tests/desktop-window-behavior.test.ts
- source:src/tests/desktop-notifier.test.ts

## Read Contract

- Read this card before editing desktop-console.app.project-state tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession

- None recorded.

## 中文摘要

- 桌面專案設定、路徑防護、視窗策略與通知已拆成子卡。
- 此卡降低 desktop-console.app 的追蹤檔案數。

## Tracked Files

- src/desktop/path-guard.ts
- src/desktop/window-behavior.ts
- src/desktop/project-store.ts
- src/desktop/desktop-notifier.ts
- src/tests/desktop-store.test.ts
- src/tests/desktop-path-guard.test.ts
- src/tests/desktop-window-behavior.test.ts
- src/tests/desktop-notifier.test.ts

## Relations

- desktop-console.app（parent card）
- desktop-console.monitoring（project snapshot producer）
- desktop-console.renderer（operator-visible consumer）
