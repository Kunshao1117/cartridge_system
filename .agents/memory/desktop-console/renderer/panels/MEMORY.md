---
name: desktop-console.renderer.panels
description: '專案記憶：desktop console / renderer panels。Use when: 修改此模組追蹤檔案時載入。'
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
verification_status: pending_review
last_verified: '2026-06-15T00:47:16+08:00'
valid_scope:
  - src/desktop/renderer/App.tsx
  - src/desktop/renderer/common.tsx
  - src/desktop/renderer/issue-drawer.tsx
  - src/desktop/renderer/overview.tsx
  - src/desktop/renderer/project-detail.tsx
  - src/desktop/renderer/settings-panel.tsx
  - src/desktop/renderer/sidebar.tsx
  - src/tests/desktop-renderer-layout.test.ts
  - src/desktop/renderer/latest-request.ts
  - src/desktop/renderer/settings-updates.ts
  - src/tests/desktop-rendered-flows.test.tsx
  - src/tests/desktop-settings-updates.test.ts
---
# desktop console / renderer panels — Module Memory

## Current Truth


- Owns App, drawer, overview, detail, settings, sidebar, shared panel UI and request/settings coordination.
- LatestRequest guards independent snapshot/settings/operation domains; newer events and unmount invalidate old replies so reverse completion cannot restore stale UI.
- SettingsUpdateQueue serializes requested patches and reloads persisted settings after success or failure; global settings remain available with zero projects.
- Panels expose scan errors, last successful scan state, partial sync and ghost restore/review guidance. Selecting an attribution suggestion is not a tracking write.
- Dense layout and interaction tests include no nested row buttons and bounded widths; static rendering does not prove installed GUI behavior.

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


- source:https://github.com/Kunshao1117/cartridge_system/blob/3f346804c8c72944a2c61a46544421c9f9009ef2/.agents/memory/desktop-console/renderer/panels/MEMORY.md — reviewed original card revision.
- source:https://github.com/Kunshao1117/cartridge_system/tree/3f346804c8c72944a2c61a46544421c9f9009ef2 — source tree for this static claim/ownership review; use Tracked Files for the exact source slice.

## Read Contract

- Read this card before editing desktop-console.renderer.panels tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession


- Static comparison target: 5.5.8 source 3f346804c8c72944a2c61a46544421c9f9009ef2. Historical cycle/archive records remain unchanged; old validation IDs do not establish current runtime acceptance.

## 中文摘要

- 桌面 renderer 面板與版面測試已拆成子卡。
- 此卡承接操作者可見 UI 的主要元件。

## Tracked Files


- src/desktop/renderer/App.tsx
- src/desktop/renderer/common.tsx
- src/desktop/renderer/issue-drawer.tsx
- src/desktop/renderer/overview.tsx
- src/desktop/renderer/project-detail.tsx
- src/desktop/renderer/settings-panel.tsx
- src/desktop/renderer/sidebar.tsx
- src/tests/desktop-renderer-layout.test.ts
- src/desktop/renderer/latest-request.ts
- src/desktop/renderer/settings-updates.ts
- src/tests/desktop-rendered-flows.test.tsx
- src/tests/desktop-settings-updates.test.ts

## Relations

- desktop-console.renderer（parent overview）
- desktop-console.renderer.bridge（API and status contract）
- desktop-console.renderer.runtime（boot contract）
- desktop-console.renderer.styles（visual style source）
