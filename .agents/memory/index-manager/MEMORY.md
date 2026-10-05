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
verification_status: pending_review
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


- Owns canonical `.cartridge/index.json`, ingestion/ownership reconciliation, authoritative reindex, smart ownership and project transaction/artifact rules.
- Transactions use an in-process reentrant FIFO mutex plus protocol-v2 cross-process generation locks; each mutation reloads persisted state and atomically replaces only while it still owns the generation.
- V2 acquisition publishes a populated sibling candidate containing owner-UUID.json. Heartbeat never recreates a lost owner; recovery unlinks only the observed UUID then uses nonrecursive rmdir.
- Automatic recovery requires same-host v2 ownership, expired grace and OS evidence that the PID is absent. Unknown, remote, malformed or legacy abandoned locks block instead of being guessed dead.
- Only full authoritative reindex may repair an invalid index. Failed persistence restores trusted in-memory state; path aliases/ID collisions, malformed cards and source diagnostics remain visible.
- Reconciliation preserves unresolved pending/ghost evidence, normalizes tracked identities and excludes managed Memory and index/lock artifacts. Shared visible projection belongs to `core-types.visible-index`.
- All clients must stop/drain before upgrade or rollback; no mixed-version safety, hostile-writer CAS or distributed-filesystem fencing is claimed.

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


- source:https://github.com/Kunshao1117/cartridge_system/blob/3f346804c8c72944a2c61a46544421c9f9009ef2/.agents/memory/index-manager/MEMORY.md — reviewed original card revision.
- source:https://github.com/Kunshao1117/cartridge_system/tree/3f346804c8c72944a2c61a46544421c9f9009ef2 — source tree for this static claim/ownership review; use Tracked Files for the exact source slice.
- validation:VD-03 — 5.5.3 source and runtime parity validation provenance. Historical only; original receipt not revalidated in this review.
- review:RD-03 — independent 5.5.3 review provenance. Historical only; original receipt not revalidated in this review.

## Read Contract

- Read this card before changing index persistence, project transactions, untracked reconciliation, or smart ownership boundaries.
- Do not use this card for UI policy, release history, temporary logs, or project preferences.

## Conflicts and Supersession


- Static comparison target: 5.5.8 source 3f346804c8c72944a2c61a46544421c9f9009ef2. Historical cycle/archive records remain unchanged; old validation IDs do not establish current runtime acceptance.

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
- docs/LOCK_PROTOCOL.md
- src/project-index-artifacts.ts
- src/tests/fixtures/index-lock-race-worker.ts
- src/tests/project-index-lock-v2.test.ts
- src/tests/project-index-recovery-race.test.ts

## Relations

- core-types.visible-index（shared visible projection and canonical health）
- core-types.memory-main-file（active main-file resolver）
- core-types.memory-compaction（compaction metrics）
- index-manager.dep-engine（child card: dependency graph and staleness propagation）
- gitignore-filter（canonical project candidate discovery）

## Applicable Skills

- memory-ops — Use for governed updates and staleness repair of this card.
