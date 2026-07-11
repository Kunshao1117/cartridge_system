---
name: index-manager
scopePath: null
dependencies:
  - core-types
description: |
  專案記憶：卡匣索引、歸屬反向映射與跨程序持久化交易。Use when: 修改索引載入、未歸屬收斂、交易鎖或持久化安全行為時載入。
last_updated: '2026-07-11T14:51:55+08:00'
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
cycle_id: 2026-06-04-001
cycle_event_count: 7
cycle_event_limit: 30
size_limit_bytes: 16384
line_limit: 120
archive_policy: volume
compaction_status: ready
metadata:
  author: antigravity
  version: '3.2'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:write'
---
# index manager — Module Memory

## Current Truth

- `.cartridge/index.json` is the canonical persisted project state shared by Desktop, VS Code, and MCP.
- Index transactions combine an in-process reentrant FIFO mutex with a cross-process lease lock, heartbeat, and fencing checks.
- Every mutation reloads persisted state before applying changes, then uses atomic replacement so separate runtimes converge on one committed state.
- Failed persistence restores the prior in-memory state and fails closed; stale or lost lease holders cannot replace a newer commit.
- Only a full authoritative reindex may repair an invalid persisted index; normal event mutations retain the last committed state and warning.
- Untracked reconciliation removes ignored, missing, now-owned, and managed-memory artifacts while preserving metadata for still-valid entries.
- Visible untracked projection is owned by `core-types.visible-index` and re-exported here only for compatibility.

## Active Constraints

- Preserve the persisted index schema and ownership, ghost, and staleness semantics.
- Route all read-modify-write index changes through the shared project index transaction.
- Do not follow symlinks or admit managed memory artifacts into the untracked pool.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Excluded managed memory internals from the untracked file pool.
- 03: Added canonical visible filtering and persisted residue cleanup.
- 04: Shared missing-parent main-file resolution with audit dry runs.
- 05: Standardized the active memory main file and evidence sections.
- 06: Standardized ownership for the 5.5.1 governance repair.
- 07: Recorded authoritative reconciliation and fenced cross-process index transactions for 5.5.3.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## Evidence Base

- source:src/index-manager.ts
- source:src/memory-reindex.ts
- source:src/project-index-transaction.ts
- source:src/tests/index-manager.test.ts
- source:src/tests/project-index-transaction.test.ts
- validation:VD-03 — 5.5.3 source and runtime parity validation provenance.
- review:RD-03 — independent 5.5.3 review provenance.

## Read Contract

- Read this card before changing index persistence, project transactions, untracked reconciliation, or smart ownership boundaries.
- Do not use this card for UI policy, release history, temporary logs, or project preferences.

## Conflicts and Supersession

- None.

## 中文摘要

- 三條執行路徑共用 `.cartridge/index.json`，以跨程序鎖與原子替換維持單一狀態。
- 每次變更先重載磁碟狀態；鎖失效、寫入失敗或索引無效時採封閉式保護。
- 完整重建才可修復無效索引，未歸屬收斂會保留仍有效項目的 metadata。

## Tracked Files

- src/index-manager.ts
- src/memory-reindex.ts
- src/project-index-transaction.ts
- src/smart-owner.ts
- src/tests/index-manager.test.ts
- src/tests/project-index-transaction.test.ts
- src/tests/detect-missed-changes.test.ts

## Relations

- core-types.visible-index（shared visible projection and canonical health）
- core-types.memory-main-file（active main-file resolver）
- core-types.memory-compaction（compaction metrics）
- index-manager.dep-engine（child card: dependency graph and staleness propagation）
- gitignore-filter（canonical project candidate discovery）

## Applicable Skills

- memory-ops — Use for governed updates and staleness repair of this card.
