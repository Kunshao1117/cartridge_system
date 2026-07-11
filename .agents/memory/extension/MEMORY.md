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
    - 'filesystem:write'
---
# extension — Module Memory

## Current Truth

- This card owns the VS Code extension entrypoint, scan lifecycle, status bar, TreeView, CodeLens, update checks, and governance views.
- Activation, manual scan, and background scan all call the shared project refresh path used by Desktop and MCP.
- UI status and health reports consume `projectCanonicalHealth` from the committed index rather than deriving a separate extension state.
- External index changes arrive through `extension.watcher` and refresh the UI from the newest valid committed snapshot.
- Synchronization warnings are visible but nonfatal; they do not replace the last committed health or untracked result.
- Visible untracked counts use the shared projection and never include managed memory artifacts.

## Active Constraints

- The extension must not retain `workspace.findFiles` or another independent candidate source.
- Status surfaces must derive from the same canonical project health as Desktop.
- External reload failures preserve the last committed state and warning until a valid refresh succeeds.

## Cycle Events

- 01: Compacted the card around shared refresh, canonical health, and external-state convergence for 5.5.3.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## Evidence Base

- source:src/extension.ts
- source:src/status-bar.ts
- source:src/tests/status-bar.test.ts
- source:src/treeview-provider.ts
- source:src/codelens-provider.ts
- source:src/governance-views.ts
- source:src/update-checker.ts
- source:src/tests/update-checker.test.ts
- validation:VD-03 — 5.5.3 VS Code and cross-runtime parity validation provenance.
- review:RD-03 — independent 5.5.3 review provenance.

## Read Contract

- Read this card before changing extension activation, scans, or user-facing project health.
- Do not use this card as the owner of watcher internals, shared index transactions, or Desktop UI.

## Conflicts and Supersession

- None.

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

## Relations

- injector（extension lifecycle helper）
- analyzer（event analysis helper）
- writer（memory write helper）
- cabinet-workbench（extension UI consumer）

## Applicable Skills

- memory-ops — Use for governed updates and staleness repair of this card.
