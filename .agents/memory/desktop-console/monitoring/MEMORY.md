---
name: desktop-console.monitoring
scopePath: null
dependencies:
  - index-manager
  - core-types.visible-index
description: |
  專案記憶：桌面版純 Node 多專案監控、共享重掃交易與狀態快照。Use when: 修改桌面監控、事件處理、外部索引同步或健康快照時載入。
last_updated: '2026-07-13T22:59:16+08:00'
status: stable
staleness: 0
memory_schema_version: 2
memory_quality_version: 1
memory_kind: source_fact
verification_status: pending_review
last_verified: '2026-07-13T22:55:00+08:00'
valid_scope: current-project
content_language: en
human_language: zh-TW
cycle_id: 2026-07-11-001
cycle_event_count: 2
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


- Owns the pure Node multi-project monitor, project identity, shared source events, rescan lifecycle and Desktop snapshots.
- Startup/manual/scheduled/Git-control refresh uses the shared canonical project transaction; the scheduled full rescan interval is 15 minutes.
- Lifecycle generations and a single-flight queue prevent old results from entering a new generation. Startup warning injection reacquires current canonical state under the same transaction.
- `stop()` stops callbacks and drains accepted source events, external reloads and rescans before the final dirty-index flush. A waiting obsolete generation cannot inject warnings after stop.
- External index events reload committed state. `projectCanonicalHealth` gives Desktop the same visible projection and nonfatal synchronization warning as VS Code.
- Managed warning self-writes and duplicate process events use persisted fingerprints; they must not clear unresolved pending/ghost evidence or add duplicate severity.
- Watcher startup/runtime errors remain visible and support retry. The unused file-list re-export is retained while its separately scoped two-file cleanup is unresolved.
## Active Constraints

- A rescan must not apply results across lifecycle generations.
- `stop()` is a persistence barrier: active rescan completion precedes the final dirty-index flush and return.
- Desktop and VS Code must derive status from the same committed project index and canonical health calculation.
- External index reloads must not become self-trigger loops or replace the last committed state on invalid input.
- `extension.watcher` is related event behavior, not a staleness dependency of this Node runtime.
## Key Decisions

- `index-manager` is a staleness dependency because its persisted refresh and final flush behavior must be reviewed with this monitor.
- `core-types.visible-index` is a staleness dependency because its visible-index contract feeds this monitor's canonical health projection.
## Cycle Events

- 01: Compacted the card around shared transactions, external index reload, and canonical Desktop health for 5.5.3.
- 02: 5.5.4 synchronized lifecycle generation guarding, 15-minute single-flight rescans, stop persistence, and listener isolation.
## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.
## Evidence Base


- source:https://github.com/Kunshao1117/cartridge_system/blob/3f346804c8c72944a2c61a46544421c9f9009ef2/.agents/memory/desktop-console/monitoring/MEMORY.md — reviewed original card revision.
- source:https://github.com/Kunshao1117/cartridge_system/tree/3f346804c8c72944a2c61a46544421c9f9009ef2 — source tree for this static claim/ownership review; use Tracked Files for the exact source slice.
- validation:validation-runtime-soak-20260713-r1 — 15-minute monitor lifecycle soak accepted within its stated duration and load limits. Historical only; original receipt not revalidated in this review.
- validation:validation-artifact-5.5.4-20260713-r1 — packaged monitor structure accepted. Historical only; original receipt not revalidated in this review.
- review:hp-review-source-final-20260713-r3 — source review accepted with P0–P3 clear. Historical only; original receipt not revalidated in this review.
## Read Contract

- Read this card before changing Node monitoring, Desktop rescans, snapshots, or external index synchronization.
- Do not use this card for Electron UI layout, VS Code APIs, or release packaging.
## Conflicts and Supersession


- Static comparison target: 5.5.8 source 3f346804c8c72944a2c61a46544421c9f9009ef2. Historical cycle/archive records remain unchanged; old validation IDs do not establish current runtime acceptance.
## 中文摘要

- 背景完整重掃固定每 15 分鐘執行；每個成功生命週期 generation 的啟動警示只注入一次。
- generation guard 與 single-flight 讓同 generation 最多保留一個 trailing 重掃，較新 generation 仍可在舊 trailing 後排入必要啟動掃描。
- stop 會等待作用中的重掃完成，再 flush 髒索引後返回；監聽者錯誤互相隔離且可移除。
- 桌面健康狀態仍使用持久化索引與 canonical health projection。
## Tracked Files


- src/monitoring/file-list.ts
- src/monitoring/project-event-handler.ts
- src/monitoring/node-project-watcher.ts
- src/monitoring/project-snapshot.ts
- src/monitoring/project-monitor.ts
- src/monitoring/multi-project-monitor.ts
- src/tests/monitoring-event-handler.test.ts
- src/tests/desktop-snapshot.test.ts
- src/tests/project-monitor.test.ts
- src/monitoring/project-identity.ts
- src/tests/fixtures/monitor-process-entry.ts
- src/tests/node-project-watcher-recovery.test.ts
- src/tests/project-monitor-lock-drain.test.ts
## Relations

- desktop-console（parent card）
- index-manager（persisted refresh and final flush owner）
- core-types.visible-index（canonical health projection input）
- extension.watcher（related event semantics; no staleness propagation）
- gitignore-filter（canonical Git exclusion service）
## Applicable Skills

- memory-ops — Use for governed updates and staleness repair of this card.
