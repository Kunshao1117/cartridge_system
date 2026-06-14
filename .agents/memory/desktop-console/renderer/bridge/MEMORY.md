---
name: desktop-console.renderer.bridge
description: '專案記憶：desktop console / renderer bridge。Use when: 修改 renderer preload API 包裝或狀態投影時載入。'
scopePath: null
last_updated: '2026-06-15T00:55:00+08:00'
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
last_verified: '2026-06-15T00:55:00+08:00'
valid_scope:
  - src/desktop/renderer/desktop-api.ts
  - src/desktop/renderer/status.ts
---
# desktop console / renderer bridge — Module Memory

## Current Truth

- This card owns the renderer-side preload API wrapper and issue/status projection helpers.
- Panels consume this bridge; renderer boot does not own it, preventing a memory dependency cycle.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in description and Chinese summary.
- Use dependencies only for true staleness propagation; use Relations for navigation.
- Do not rewrite archive volumes during active-card standardization.
- Treat missing evidence as pending review, not as complete quality.

## Cycle Events

- 01: Split renderer bridge ownership from runtime during the 5.5.1 governance repair.

## Archive Index

- None yet.

## Evidence Base

- source:src/desktop/renderer/desktop-api.ts
- source:src/desktop/renderer/status.ts

## Read Contract

- Read this card before editing renderer preload API wrappers or status projection helpers.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession

- None recorded.

## 中文摘要

- Renderer bridge 已拆出獨立卡。
- Panel 依賴 bridge，runtime 只負責啟動與建構設定，清除 renderer 記憶依賴循環。

## Tracked Files

- src/desktop/renderer/desktop-api.ts
- src/desktop/renderer/status.ts

## Relations

- desktop-console.renderer（parent overview）
- desktop-console.app（preload and IPC source）
- desktop-console.renderer.panels（consumer）
