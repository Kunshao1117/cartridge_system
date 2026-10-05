---
name: dep-engine
description: |
  專案記憶：依賴推導引擎模組。 Use when: 處理模組間 import 掃描、依賴圖建構、間接過期傳播與循環偵測時載入。
last_updated: '2026-06-15T00:47:16+08:00'
status: stable
staleness: 0
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 3
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
  tool_scope:
    - 'filesystem:read'
memory_quality_version: 1
memory_kind: implementation
verification_status: pending_review
last_verified: '2026-06-15T00:47:16+08:00'
valid_scope:
  - src/import-resolver.ts
  - src/dependency-propagator.ts
  - src/dependency-semantics.ts
  - src/tests/import-resolver.test.ts
  - src/tests/dependency-propagator.test.ts
  - src/tests/dependency-semantics.test.ts
scopePath: null
---
# dep-engine — Module Memory

## Current Truth


- Owns import scanning, declared/engineering dependency graph construction, bounded indirect staleness propagation and semantic diagnostics.
- Engineering imports and frontmatter declarations retain separate provenance; propagation uses their union. A missing rationale does not silently delete a declared edge.
- Relations, Applicable Skills and directory parent/child navigation do not create propagation edges by themselves.
- Side-effect imports are included; comment/string lookalikes are excluded. Unknown/self/duplicate/cyclic edges remain bounded diagnostics.
- Derived results are calculated before publication; failure retains the last trusted graph/indirect scores and exposes a warning. Offline reindex reconciles direct state before publishing final indirect state.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in description and Chinese summary.
- Use dependencies only for true staleness propagation; use Relations for navigation.
- Do not rewrite archive volumes during active-card standardization.
- Treat missing evidence as pending review, not as complete quality.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Standardized active memory main file to MEMORY.md with quality metadata and evidence sections.
- 03: Standardized memory ownership and YAML valid_scope for the 5.5.1 governance repair.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## Evidence Base


- source:https://github.com/Kunshao1117/cartridge_system/blob/3f346804c8c72944a2c61a46544421c9f9009ef2/.agents/memory/index-manager/dep-engine/MEMORY.md — reviewed original card revision.
- source:https://github.com/Kunshao1117/cartridge_system/tree/3f346804c8c72944a2c61a46544421c9f9009ef2 — source tree for this static claim/ownership review; use Tracked Files for the exact source slice.

## Read Contract

- Read this card before editing dep-engine tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession


- Static comparison target: 5.5.8 source 3f346804c8c72944a2c61a46544421c9f9009ef2. Historical cycle/archive records remain unchanged; old validation IDs do not establish current runtime acceptance.

## 中文摘要

- index-manager.dep-engine 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- src/import-resolver.ts
- src/dependency-propagator.ts
- src/dependency-semantics.ts
- src/tests/import-resolver.test.ts
- src/tests/dependency-propagator.test.ts
- src/tests/dependency-semantics.test.ts

## Relations

- index-manager（父卡與資料來源：提供 CartridgeEntry / trackedFiles / fileMap 的執行期索引資料）
- core-types（根層型別：CartridgeEntry, CartridgeConfig 定義所在）
- mcp-tools（根層模組：memory_deps 工具呼叫本引擎）
- mcp-tools.handlers（消費：memory_commit 整合 dependencies 語義警告）
