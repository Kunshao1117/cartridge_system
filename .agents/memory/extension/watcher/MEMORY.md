---
name: watcher
scopePath: null
dependencies:
  - index-manager
  - desktop-console.monitoring
description: |
  專案記憶：VS Code 檔案監聽、Git 控制事件與外部索引同步。Use when: 修改 watcher 設定、事件優先序、去迴圈或狀態重載時載入。
last_updated: '2026-07-11T14:52:21+08:00'
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
cycle_event_count: 4
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
# watcher — Module Memory

## Current Truth

- Memory-file events retain priority over ordinary project-file ignore handling.
- Root or nested `.gitignore` and relevant `.git/index`, `.git/config`, and `.git/info/exclude` changes trigger authoritative refresh semantics.
- External `.cartridge/index.json` changes are debounced for 150 ms and reload committed state into the extension runtime.
- Generated release artifacts and internal transaction files are ignored by the watcher.
- Persisted-index fingerprints suppress self-generated notifications without hiding a different process's commit.
- Invalid external state retains the last committed snapshot and exposes a nonfatal synchronization warning.
- Shared project event handling keeps watcher decisions aligned with Desktop monitoring.

## Active Constraints

- Process memory is a cache; the committed project index remains authoritative across Desktop and VS Code.
- Do not suppress an external commit solely because its timestamp is close to a local write; compare committed fingerprints.
- Preserve memory-first handling before Git ignore checks.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Standardized the active memory main file and evidence sections.
- 03: Standardized ownership for the 5.5.1 governance repair.
- 04: Added Git-control refresh and debounced external-index convergence for 5.5.3.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## Evidence Base

- source:src/watcher.ts
- source:src/tests/watcher.test.ts
- source:src/monitoring/project-event-handler.ts
- validation:VD-03 — 5.5.3 watcher and state-convergence validation provenance.
- review:RD-03 — independent 5.5.3 review provenance.

## Read Contract

- Read this card before changing extension watcher lifecycle, event ordering, external index reload, or self-write suppression.
- Do not use this card as the owner of shared index transactions or Desktop snapshots.

## Conflicts and Supersession

- None.

## 中文摘要

- 記憶檔事件維持最高優先，Git 控制檔變動會觸發完整收斂。
- 外部索引提交以 150 毫秒去抖後重載，指紋只抑制自身通知，不會遮蔽其他程序的寫入。
- 無效外部狀態不覆蓋既有結果，只留下非致命同步警示。

## Tracked Files

- src/watcher.ts
- src/tests/watcher.test.ts

## Relations

- extension（parent card and lifecycle owner）
- analyzer（downstream event consumer）
- gitignore-filter（event-time exclusion decision）

## Applicable Skills

- memory-ops — Use for governed updates and staleness repair of this card.
