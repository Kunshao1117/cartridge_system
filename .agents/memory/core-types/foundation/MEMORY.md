---
name: core-types.foundation
description: '專案記憶：core types / shared contracts。Use when: 修改跨 MCP、extension、desktop 共用型別時載入。'
scopePath: null
last_updated: '2026-06-15T00:55:00+08:00'
status: stable
staleness: 0
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-15-001
cycle_event_count: 1
cycle_event_limit: 30
size_limit_bytes: 16384
line_limit: 120
archive_policy: volume
compaction_status: ready
metadata:
  author: antigravity
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope: []
memory_quality_version: 1
memory_kind: implementation
verification_status: pending_review
last_verified: '2026-06-15T00:55:00+08:00'
valid_scope:
  - src/types.ts
  - src/tests/surface-regression-fixtures.ts
---
# core types / shared contracts — Module Memory

## Current Truth


- Owns shared TypeScript contracts consumed by extension, MCP, Desktop and Memory helpers, plus their synthetic CartridgeEntry/CartridgeIndex fixture constructors.
- Shared fixture data and deferred promises are test utilities, not user Memory, a runtime index or product validation receipts.
- Type-only imports are still visible to the current engineering scanner; a card-level cycle is a review diagnostic, not proof of a JavaScript runtime import cycle.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in description and Chinese summary.
- Use dependencies only for true staleness propagation; use Relations for navigation.
- Do not rewrite archive volumes during active-card standardization.
- Treat missing evidence as pending review, not as complete quality.

## Cycle Events

- 01: Split shared contracts from runtime helpers during the 5.5.1 governance repair.

## Archive Index

- None yet.

## Evidence Base


- source:https://github.com/Kunshao1117/cartridge_system/blob/3f346804c8c72944a2c61a46544421c9f9009ef2/.agents/memory/core-types/foundation/MEMORY.md — reviewed original card revision.
- source:https://github.com/Kunshao1117/cartridge_system/tree/3f346804c8c72944a2c61a46544421c9f9009ef2 — source tree for this static claim/ownership review; use Tracked Files for the exact source slice.

## Read Contract

- Read this card before editing src/types.ts or changing shared contract ownership.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession


- Static comparison target: 5.5.8 source 3f346804c8c72944a2c61a46544421c9f9009ef2. Historical cycle/archive records remain unchanged; old validation IDs do not establish current runtime acceptance.

## 中文摘要


- 共用型別在 5.5.1 治理修復時拆出 foundation，目的是降低卡片歸屬耦合。
- 5.5.8 的實際工程圖仍有 runtime／visible-index 與 foundation 相關循環診斷；不宣稱拆分已消除循環。
- 其中包含 type-only import／helper 分組關係，須保留診斷，不等同 JavaScript 執行期循環。

## Tracked Files


- src/types.ts
- src/tests/surface-regression-fixtures.ts

## Relations

- core-types（parent overview）
- core-types.runtime（consumer）
- core-types.visible-index（consumer）
- index-manager（consumer）
