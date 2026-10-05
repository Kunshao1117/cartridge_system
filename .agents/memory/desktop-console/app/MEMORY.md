---
name: desktop-console.app
description: >
  專案記憶：Electron 桌面外殼、IPC、系統匣、通知與專案清單設定。Use when: 修改桌面主程序、 預載橋接、AppData
  專案設定、桌面通知或桌面打包設定時載入。
last_updated: '2026-06-15T00:47:16+08:00'
status: stable
staleness: 0
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
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
memory_quality_version: 1
memory_kind: implementation
verification_status: pending_review
last_verified: '2026-06-15T00:47:16+08:00'
valid_scope:
  - src/desktop/main.ts
  - src/desktop/preload.ts
  - src/desktop/ipc-channels.ts
  - src/desktop/project-status.ts
scopePath: null
---
# desktop console / app — Module Memory

## Current Truth


- Owns Electron main/preload, IPC channel contract, tray labels and operation-result projection; project store/window/path/notifications remain in `desktop-console.app.project-state`.
- Tray state prioritizes error, blocked and warning before paused/healthy; scan failure retains the last successful snapshots and partial synchronization is not reported as success.
- Project-specific results use the shared canonical project-root identity. No target produces cancelled rather than a successful scan.
- Installer metadata remains owned by `release-packaging`; source and rendered tests are not installed Windows GUI acceptance.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in description and Chinese summary.
- Use dependencies only for true staleness propagation; use Relations for navigation.
- Do not rewrite archive volumes during active-card standardization.
- Treat missing evidence as pending review, not as complete quality.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Standardized active memory main file to MEMORY.md with quality metadata and evidence sections.
- 03: Standardized memory ownership and YAML valid_scope for the 5.5.1 governance repair.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## Evidence Base


- source:https://github.com/Kunshao1117/cartridge_system/blob/3f346804c8c72944a2c61a46544421c9f9009ef2/.agents/memory/desktop-console/app/MEMORY.md — reviewed original card revision.
- source:https://github.com/Kunshao1117/cartridge_system/tree/3f346804c8c72944a2c61a46544421c9f9009ef2 — source tree for this static claim/ownership review; use Tracked Files for the exact source slice.

## Read Contract

- Read this card before editing desktop-console.app tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession


- Static comparison target: 5.5.8 source 3f346804c8c72944a2c61a46544421c9f9009ef2. Historical cycle/archive records remain unchanged; old validation IDs do not establish current runtime acceptance.

## 中文摘要

- 桌面 app 主卡已縮小為 Electron 殼層與 IPC 契約。
- 專案設定與通知邏輯改由子卡承接。

## Tracked Files


- src/desktop/main.ts
- src/desktop/preload.ts
- src/desktop/ipc-channels.ts
- src/desktop/project-status.ts

## Relations

- desktop-console（parent card）
- desktop-console.app.project-state（child card: settings, guard, window behavior, notifications）
- desktop-console.monitoring（snapshot runtime source）
- desktop-console.renderer（IPC consumer）
