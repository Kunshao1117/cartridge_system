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
verification_status: pending_review
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


- Memory-file events precede ordinary Git ignore handling; Git-control changes trigger shared authoritative refresh.
- External canonical index events are debounced for 150 ms and compared by committed fingerprint to suppress self-notifications without hiding another process commit.
- Invalid external state preserves the last committed snapshot with a nonfatal synchronization warning.
- `stop()` cancels debounces and invalidates callbacks; separate `drain()` waits for accepted source/reload operations, and extension deactivation awaits it together with outstanding work. V2 lock/candidate artifacts are never source changes.
- The watcher consumes `index-manager` for canonical state and `desktop-console.monitoring` shared event handling; their relation is implementation-backed, not navigation-only.

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


- source:https://github.com/Kunshao1117/cartridge_system/blob/3f346804c8c72944a2c61a46544421c9f9009ef2/.agents/memory/extension/watcher/MEMORY.md — reviewed original card revision.
- source:https://github.com/Kunshao1117/cartridge_system/tree/3f346804c8c72944a2c61a46544421c9f9009ef2 — source tree for this static claim/ownership review; use Tracked Files for the exact source slice.
- validation:VD-03 — 5.5.3 watcher and state-convergence validation provenance. Historical only; original receipt not revalidated in this review.
- review:RD-03 — independent 5.5.3 review provenance. Historical only; original receipt not revalidated in this review.

## Read Contract

- Read this card before changing extension watcher lifecycle, event ordering, external index reload, or self-write suppression.
- Do not use this card as the owner of shared index transactions or Desktop snapshots.

## Conflicts and Supersession


- Static comparison target: 5.5.8 source 3f346804c8c72944a2c61a46544421c9f9009ef2. Historical cycle/archive records remain unchanged; old validation IDs do not establish current runtime acceptance.

## 中文摘要

- 記憶檔事件維持最高優先，Git 控制檔變動會觸發完整收斂。
- 外部索引提交以 150 毫秒去抖後重載，指紋只抑制自身通知，不會遮蔽其他程序的寫入。
- 無效外部狀態不覆蓋既有結果，只留下非致命同步警示。

## Tracked Files


- src/watcher.ts
- src/tests/watcher.test.ts
- src/tests/watcher-lifecycle.test.ts

## Relations

- extension（parent card and lifecycle owner）
- analyzer（downstream event consumer）
- gitignore-filter（event-time exclusion decision）

## Applicable Skills

- memory-ops — Use for governed updates and staleness repair of this card.
