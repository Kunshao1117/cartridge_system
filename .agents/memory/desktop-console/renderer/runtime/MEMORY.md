---
name: desktop-console.renderer.runtime
description: '專案記憶：desktop console / renderer runtime。Use when: 修改此模組追蹤檔案時載入。'
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
  - src/desktop/renderer/main.tsx
  - src/desktop/renderer/index.html
  - desktop.vite.config.ts
---
# desktop console / renderer runtime — Module Memory

## Current Truth

- This card owns renderer bootstrapping, HTML entrypoint, and Vite renderer configuration.
- Preload API typing and status projection are owned by desktop-console.renderer.bridge.
- Renderer runtime must stay compatible with packaged Electron file loading.

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

- source:src/desktop/renderer/main.tsx
- source:src/desktop/renderer/index.html
- source:desktop.vite.config.ts

## Read Contract

- Read this card before editing desktop-console.renderer.runtime tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession

- None recorded.

## 中文摘要

- 桌面 renderer runtime 已拆成子卡。
- 此卡承接入口、API 型別、狀態轉換與 Vite 設定。

## Tracked Files

- src/desktop/renderer/main.tsx
- src/desktop/renderer/index.html
- desktop.vite.config.ts

## Relations

- desktop-console.renderer（parent overview）
- desktop-console.renderer.bridge（preload and status bridge）
- desktop-console.renderer.panels（boot target）
