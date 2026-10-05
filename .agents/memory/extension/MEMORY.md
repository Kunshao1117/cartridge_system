---
name: extension
scopePath: null
dependencies:
  - index-manager
  - core-types.visible-index
  - extension.watcher
description: >
  專案記憶：VS Code 外掛入口、掃描生命週期與共用健康狀態 UI。Use when: 修改外掛啟動、掃描指令、狀態列、TreeView、CodeLens
  或同步警示時載入。
last_updated: '2026-07-11T14:52:31+08:00'
status: stable
staleness: 0
memory_schema_version: 2
memory_quality_version: 1
memory_kind: source_fact
verification_status: pending_review
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
    - 'filesystem:write'
---
# extension — Module Memory

## Current Truth


- Owns VS Code activation/scan lifecycle, status/TreeView/CodeLens, updates, governance views, attribution guidance and final host-open command.
- Activation, manual and background scans use shared refresh; UI health/untracked state comes from the committed canonical index and shared visible projection.
- Startup warning injection runs inside the project transaction, rereads current pending evidence and checks activation generation before writing.
- Attribution selection returns a reviewable, explicitly unapplied suggestion. It does not mutate Tracked Files or declare synchronization complete.
- Host-open validation happens at command execution immediately before I/O, not only while constructing a TreeItem.
- The extension consumes `index-manager`, `core-types.visible-index` and `extension.watcher`; external reload failures preserve committed state and show a nonfatal warning.

## Active Constraints

- The extension must not retain `workspace.findFiles` or another independent candidate source.
- Status surfaces must derive from the same canonical project health as Desktop.
- External reload failures preserve the last committed state and warning until a valid refresh succeeds.

## Cycle Events

- 01: Compacted the card around shared refresh, canonical health, and external-state convergence for 5.5.3.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## Evidence Base


- source:https://github.com/Kunshao1117/cartridge_system/blob/3f346804c8c72944a2c61a46544421c9f9009ef2/.agents/memory/extension/MEMORY.md — reviewed original card revision.
- source:https://github.com/Kunshao1117/cartridge_system/tree/3f346804c8c72944a2c61a46544421c9f9009ef2 — source tree for this static claim/ownership review; use Tracked Files for the exact source slice.
- validation:VD-03 — 5.5.3 VS Code and cross-runtime parity validation provenance. Historical only; original receipt not revalidated in this review.
- review:RD-03 — independent 5.5.3 review provenance. Historical only; original receipt not revalidated in this review.

## Read Contract

- Read this card before changing extension activation, scans, or user-facing project health.
- Do not use this card as the owner of watcher internals, shared index transactions, or Desktop UI.

## Conflicts and Supersession


- Static comparison target: 5.5.8 source 3f346804c8c72944a2c61a46544421c9f9009ef2. Historical cycle/archive records remain unchanged; old validation IDs do not establish current runtime acceptance.

## 中文摘要

- 外掛啟動、手動掃描與背景掃描均使用桌面版及 MCP 共用的更新路徑。
- 狀態列與健康畫面從同一份已提交索引計算，不會維護另一套外掛狀態。
- 外部同步失敗只顯示警示並保留最後有效結果。

## Tracked Files


- src/extension.ts
- src/update-checker.ts
- src/tests/update-checker.test.ts
- src/governance-views.ts
- src/status-bar.ts
- src/tests/status-bar.test.ts
- src/treeview-provider.ts
- src/codelens-provider.ts
- src/attribution-guidance.ts
- src/extension-startup-warnings.ts
- src/project-file-command.ts
- src/tests/attribution-guidance.test.ts
- src/tests/extension-startup-warnings.test.ts

## Relations

- injector（extension lifecycle helper）
- analyzer（event analysis helper）
- writer（memory write helper）
- cabinet-workbench（extension UI consumer）

## Applicable Skills

- memory-ops — Use for governed updates and staleness repair of this card.
