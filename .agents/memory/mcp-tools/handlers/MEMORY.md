---
name: mcp-tools.handlers
scopePath: null
dependencies:
  - index-manager
  - core-types
  - index-manager.dep-engine
description: >
  專案記憶：底層 memory_* MCP handlers 與共用重建索引契約。Use when: 修改
  memory_list/read/status/commit/deps/reindex 行為或 handler 測試時載入。
last_updated: '2026-07-11T14:52:53+08:00'
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
# mcp-tools.handlers — Module Memory

## Current Truth


- Owns memory handler contracts, reviewed source/card snapshots and the documented seven-disposition interface boundary; Cartridge supplies evidence, not an M5 cutover or workflow-disposition engine.
- Read/status/commit resolve current main-file identity and trusted configured roots; exact IDs precede ambiguous aliases. Read-only review cannot write a card, commit, reindex or clear stale.
- Commit captures card, source bytes and pending revision, then revalidates under the project transaction and immediately before atomic card replacement. Changed evidence returns MEMORY_REVIEW_CONFLICT.
- Card write is reported separately from index registration, tracking and derived synchronization. synchronizationComplete requires every component; INDEX_SYNC_PARTIAL, TRACKING_SYNC_PARTIAL and DERIVED_SYNC_PARTIAL remain outstanding work.
- Missing tracked sources retain ghost/pending and direct stale until restored or an authorized tracking correction is applied. Unknown declaration diagnostics are preserved.
- Reindex implementation/ownership lives in `index-manager`; handlers expose its Git discovery and transaction result. Only full authoritative reindex repairs an invalid index.
- The handler consumes `index-manager`, shared `core-types` contracts and `index-manager.dep-engine`; semantic warnings do not suppress real declared propagation edges.

## Active Constraints

- Preserve existing MCP confirmation and authorization boundaries for write-capable tools.
- Keep exclusion diagnostics additive and nonfatal; do not return an empty scan solely because Git degraded.
- Handler state changes must use the shared project transaction and persisted-index validation.

## Cycle Events

- 01: Compacted the card around shared Git discovery, authoritative reconciliation, and transactional `memory_reindex` for 5.5.3.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## Evidence Base


- source:https://github.com/Kunshao1117/cartridge_system/blob/3f346804c8c72944a2c61a46544421c9f9009ef2/.agents/memory/mcp-tools/handlers/MEMORY.md — reviewed original card revision.
- source:https://github.com/Kunshao1117/cartridge_system/tree/3f346804c8c72944a2c61a46544421c9f9009ef2 — source tree for this static claim/ownership review; use Tracked Files for the exact source slice.
- validation:VD-03 — 5.5.3 MCP and cross-runtime parity validation provenance. Historical only; original receipt not revalidated in this review.
- review:RD-03 — independent 5.5.3 review provenance. Historical only; original receipt not revalidated in this review.

## Read Contract

- Read this card before changing low-level memory MCP behavior, response warnings, or reindex authorization semantics.
- Do not use this card as the owner of the tool registry, server transport, or dependency engine internals.

## Conflicts and Supersession


- Static comparison target: 5.5.8 source 3f346804c8c72944a2c61a46544421c9f9009ef2. Historical cycle/archive records remain unchanged; old validation IDs do not establish current runtime acceptance.

## 中文摘要

- MCP 重建索引與桌面、外掛共用 Git 候選、未歸屬收斂及索引交易。
- 排除降級只增加 warning finding，不改寫授權與確認契約，也不會讓掃描失敗。
- 只有完整持久化重建可修復無效索引；一般操作採封閉式保護。

## Tracked Files


- src/mcp-handlers.ts
- src/tests/mcp-handlers.test.ts
- src/tests/memory-deps-output.test.ts
- docs/memory-review-contract.md
- src/memory-review-snapshot.ts
- src/tests/mcp-audit-regressions.test.ts
- src/tests/memory-review-contract.test.ts

## Relations

- mcp-tools（parent overview）
- mcp-tools.dispatcher（handler and response consumer）
- mcp-tools.tool-registry（public tool metadata）

## Applicable Skills

- memory-ops — Use for governed updates and staleness repair of this card.
