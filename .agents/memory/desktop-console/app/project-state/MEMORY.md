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
verification_status: pending_review
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


- Owns project-path validation, window behavior, project store persistence and desktop notification policy.
- Store read-modify-write operations are serialized per canonical file across store objects in one process; each operation reads the predecessor result and replaces via a temporary file.
- Failed replacement preserves the last valid file and later operations can retry. This process-local store queue is not the cross-process project-index lock.
- Windows project identities are case-normalized through the shared monitor identity helper; POSIX case remains distinct.

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


- source:https://github.com/Kunshao1117/cartridge_system/blob/3f346804c8c72944a2c61a46544421c9f9009ef2/.agents/memory/desktop-console/app/project-state/MEMORY.md — reviewed original card revision.
- source:https://github.com/Kunshao1117/cartridge_system/tree/3f346804c8c72944a2c61a46544421c9f9009ef2 — source tree for this static claim/ownership review; use Tracked Files for the exact source slice.

## Read Contract

- Read this card before editing desktop-console.app.project-state tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession


- Static comparison target: 5.5.8 source 3f346804c8c72944a2c61a46544421c9f9009ef2. Historical cycle/archive records remain unchanged; old validation IDs do not establish current runtime acceptance.

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
