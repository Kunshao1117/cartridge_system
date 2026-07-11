---
name: desktop-console.monitoring
scopePath: null
dependencies:
  - index-manager
  - core-types.visible-index
description: |
  專案記憶：桌面版純 Node 多專案監控、共享重掃交易與狀態快照。Use when: 修改桌面監控、事件處理、外部索引同步或健康快照時載入。
last_updated: '2026-07-11T14:52:13+08:00'
status: stable
staleness: 0
memory_schema_version: 2
memory_quality_version: 1
memory_kind: source_fact
verification_status: verified
last_verified: '2026-07-11T14:40:20+08:00'
valid_scope: current-project
content_language: en
human_language: zh-TW
cycle_id: 2026-07-11-001
cycle_event_count: 1
cycle_event_limit: 30
size_limit_bytes: 16384
line_limit: 120
archive_policy: volume
compaction_status: ready
metadata:
  author: antigravity
  version: '1.1'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
---
# desktop console / monitoring — Module Memory

## Current Truth

- This card owns the pure Node multi-project monitor, shared event handling, rescans, and Desktop snapshot generation.
- Startup, manual rescan, scheduled rescan, and Git-control events use the shared project refresh and index transaction path.
- The Desktop monitor watches external `.cartridge/index.json` changes and reloads committed state rather than maintaining an independent project truth.
- Desktop snapshots use `projectCanonicalHealth`, including the same visible untracked projection and synchronization warning as VS Code.
- Synchronization warnings are nonfatal and preserve the last committed project state.
- Memory artifacts remain prioritized or excluded by shared event rules and never enter product untracked counts.

## Active Constraints

- Desktop and VS Code must derive status from the same committed project index and canonical health calculation.
- External index reloads must not become self-trigger loops or replace the last committed state on invalid input.
- `extension.watcher` is related event behavior, not a staleness dependency of this Node runtime.

## Cycle Events

- 01: Compacted the card around shared transactions, external index reload, and canonical Desktop health for 5.5.3.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## Evidence Base

- source:src/monitoring/file-list.ts
- source:src/monitoring/project-event-handler.ts
- source:src/monitoring/node-project-watcher.ts
- source:src/monitoring/project-snapshot.ts
- source:src/monitoring/project-monitor.ts
- source:src/monitoring/multi-project-monitor.ts
- source:src/tests/monitoring-event-handler.test.ts
- source:src/tests/desktop-snapshot.test.ts
- validation:VD-03 — 5.5.3 Desktop and shared-state validation provenance.
- review:RD-03 — independent 5.5.3 review provenance.

## Read Contract

- Read this card before changing Node monitoring, Desktop rescans, snapshots, or external index synchronization.
- Do not use this card for Electron UI layout, VS Code APIs, or release packaging.

## Conflicts and Supersession

- None.

## 中文摘要

- 桌面版的啟動、重掃與事件處理都走共用索引交易，不另建一套狀態。
- 外部索引變更會安全重載，無效內容只顯示非致命同步警示並保留最後提交狀態。
- 桌面健康狀態與外掛共用同一計算與未歸屬投影。

## Tracked Files

- src/monitoring/file-list.ts
- src/monitoring/project-event-handler.ts
- src/monitoring/node-project-watcher.ts
- src/monitoring/project-snapshot.ts
- src/monitoring/project-monitor.ts
- src/monitoring/multi-project-monitor.ts
- src/tests/monitoring-event-handler.test.ts
- src/tests/desktop-snapshot.test.ts

## Relations

- desktop-console（parent card）
- extension.watcher（related event semantics; no staleness propagation）
- gitignore-filter（canonical Git exclusion service）

## Applicable Skills

- memory-ops — Use for governed updates and staleness repair of this card.
