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
# mcp-tools.handlers — Module Memory

## Current Truth

- This card owns the low-level memory MCP handler contracts and their tests.
- `memory_reindex` uses the same Git-standard discovery, memory processing, authoritative untracked reconciliation, and project index transaction as Desktop and VS Code.
- Exclusion mode and fallback diagnostics are additive response fields; degraded exclusion becomes a warning finding without changing authorization or confirmation contracts.
- Only a full persisted reindex may repair an invalid canonical index; ordinary handler mutations fail closed and retain the last committed state.
- `memory_list` and commit cleanup use the shared visible projection so managed memory artifacts cannot leak into product untracked output.
- Read, status, and commit operations re-check the active memory main file on disk before trusting a stale missing or conflict entry.
- Dependency semantics remain warning-only and are provided by `index-manager.dep-engine`.

## Active Constraints

- Preserve existing MCP confirmation and authorization boundaries for write-capable tools.
- Keep exclusion diagnostics additive and nonfatal; do not return an empty scan solely because Git degraded.
- Handler state changes must use the shared project transaction and persisted-index validation.

## Cycle Events

- 01: Compacted the card around shared Git discovery, authoritative reconciliation, and transactional `memory_reindex` for 5.5.3.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## Evidence Base

- source:src/mcp-handlers.ts
- source:src/memory-reindex.ts
- source:src/tests/mcp-handlers.test.ts
- source:src/tests/memory-deps-output.test.ts
- validation:VD-03 — 5.5.3 MCP and cross-runtime parity validation provenance.
- review:RD-03 — independent 5.5.3 review provenance.

## Read Contract

- Read this card before changing low-level memory MCP behavior, response warnings, or reindex authorization semantics.
- Do not use this card as the owner of the tool registry, server transport, or dependency engine internals.

## Conflicts and Supersession

- None.

## 中文摘要

- MCP 重建索引與桌面、外掛共用 Git 候選、未歸屬收斂及索引交易。
- 排除降級只增加 warning finding，不改寫授權與確認契約，也不會讓掃描失敗。
- 只有完整持久化重建可修復無效索引；一般操作採封閉式保護。

## Tracked Files

- src/mcp-handlers.ts
- src/tests/mcp-handlers.test.ts
- src/tests/memory-deps-output.test.ts

## Relations

- mcp-tools（parent overview）
- mcp-tools.dispatcher（handler and response consumer）
- mcp-tools.tool-registry（public tool metadata）

## Applicable Skills

- memory-ops — Use for governed updates and staleness repair of this card.
