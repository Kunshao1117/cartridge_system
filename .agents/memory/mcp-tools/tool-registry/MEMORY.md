---
name: tool-registry
scopePath: null
dependencies:
  - core-types
description: >
  專案記憶：MCP 工具名冊、風險分級與統一回傳 envelope。Use when: 修改工具清單、確認契約、response metadata 或
  manifest 版本斷言時載入。
last_updated: '2026-07-13T22:59:55+08:00'
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
    - 'filesystem:write'
---

# tool-registry — Module Memory

## Current Truth


- Registry exposes 18 memory/context/project-context tools and drives public schemas, dispatcher safety metadata and the common response envelope.
- memory_reindex remains confirmed-write; confirmation does not provide user authority, M5 cutover or permission for a broader target.
- Shared module IDs permit Unicode and spaces in nonempty dot-separated names while rejecting path separators, controls and foreign-drive syntax. The schema is not filesystem authority.
- Manifest tests assert version 5.5.8 and built MCP bin coverage. Project-context tools remain read-only; registry, dispatcher and handler constraints must agree.
- The response envelope consumes `core-types` result/time contracts; adding a tool requires aligned registry, dispatch, manifest and contract tests.

## Active Constraints

- Tool safety level, confirmation requirement, and handler authorization must remain aligned.
- Adding or removing a tool requires registry, dispatch, manifest, and contract-test updates together.
- Do not weaken `memory_reindex` from confirmed-write to an implicit mutation.

## Key Decisions

- `core-types` is a staleness dependency because it supplies the shared response envelope and contract types consumed by registry results.

## Cycle Events

- 01: Compacted the card around the 18-tool registry, confirmed `memory_reindex`, and 5.5.3 manifest contract.
- 02: 5.5.4 contract-sync updated the manifest-version assertion only; registry behavior remains unchanged.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## Evidence Base


- source:https://github.com/Kunshao1117/cartridge_system/blob/3f346804c8c72944a2c61a46544421c9f9009ef2/.agents/memory/mcp-tools/tool-registry/MEMORY.md — reviewed original card revision.
- source:https://github.com/Kunshao1117/cartridge_system/tree/3f346804c8c72944a2c61a46544421c9f9009ef2 — source tree for this static claim/ownership review; use Tracked Files for the exact source slice.
- validation:5.5.4 source suite — registry manifest/version assertions accepted. Historical only; original receipt not revalidated in this review.
- review:hp-review-source-final-20260713-r3 — source review accepted with P0–P3 clear. Historical only; original receipt not revalidated in this review.

## Read Contract

- Read this card before changing MCP tool metadata, safety classification, common envelopes, or package manifest assertions.
- Do not use this card as the owner of handler implementation or server transport lifecycle.

## Conflicts and Supersession


- Static comparison target: 5.5.8 source 3f346804c8c72944a2c61a46544421c9f9009ef2. Historical cycle/archive records remain unchanged; old validation IDs do not establish current runtime acceptance.

## 中文摘要


- 維持 18 個工具與明確確認邊界，manifest 測試版本為 5.5.8。
- 共用 ID schema 支援中文與空格，禁止路徑／控制字元。
- confirm 不可取代授權、有效根目錄與執行環境切換證據。

## Tracked Files


- src/tool-registry.ts
- src/mcp-response.ts
- src/tests/tool-registry.test.ts
- src/tests/mcp-response.test.ts
- src/module-id.ts

## Relations

- mcp-tools（parent overview）
- core-types（shared response envelope and contract types）
- mcp-tools.dispatcher（metadata and confirmation consumer）
- mcp-tools.server（list-tools and call-tool transport consumer）
- mcp-tools.context-governance（read-only context tools）
- mcp-tools.memory-graph（governed envelope consumer）
- mcp-tools.project-context（read-only project-context tools）

## Applicable Skills

- memory-ops — Use for governed updates and staleness repair of this card.
