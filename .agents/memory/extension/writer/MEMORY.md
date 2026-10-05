---
name: writer
description: |
  專案記憶：記憶卡寫入器模組。 Use when: 處理警報植入、警報移除、記憶卡過期警示注入時載入。
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
    - 'filesystem:write'
memory_quality_version: 1
memory_kind: implementation
verification_status: pending_review
last_verified: '2026-06-15T00:47:16+08:00'
valid_scope:
  - src/writer.ts
  - src/tests/writer.test.ts
  - src/memory-source-patch.ts
scopePath: null
---
# writer — Module Memory

## Current Truth


- Owns managed warning writing and shared minimal source-patch helpers used by writer and MCP commit.
- Derived warning injection is idempotent across writer instances and preserves user-owned body/frontmatter, timestamp and lifecycle status where no managed change is required.
- Minimal managed-field patches preserve ordinary YAML comments, unknown keys, ordering and BOM/CRLF; complex cases use the safe data-only serializer with semantic preservation.
- Allowed targets derive from trusted Memory roots; true Skills, archives and dual active files are rejected. Healthy legacy cards are not automatically standardized.
- Writing warning metadata is not evidence that changed source was reviewed, and cannot by itself clear pending/ghost state.

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


- source:https://github.com/Kunshao1117/cartridge_system/blob/3f346804c8c72944a2c61a46544421c9f9009ef2/.agents/memory/extension/writer/MEMORY.md — reviewed original card revision.
- source:https://github.com/Kunshao1117/cartridge_system/tree/3f346804c8c72944a2c61a46544421c9f9009ef2 — source tree for this static claim/ownership review; use Tracked Files for the exact source slice.

## Read Contract

- Read this card before editing writer tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession


- Static comparison target: 5.5.8 source 3f346804c8c72944a2c61a46544421c9f9009ef2. Historical cycle/archive records remain unchanged; old validation IDs do not establish current runtime acceptance.

## 中文摘要

- extension.writer 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files


- src/writer.ts
- src/tests/writer.test.ts
- src/memory-source-patch.ts

## Relations

- extension（父卡：由外掛主流程編排）
- watcher（兄弟卡：上游事件驅動者，偵測到 staleness 重設時呼叫 checkAndCleanWarning）
- core-types（共用：getStalenessLevel 與 timestamp）
