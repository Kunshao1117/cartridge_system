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
verification_status: verified
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

- The registry exposes 18 MCP tools across memory, context, and project-context groups.
- `memory_reindex` is a confirmed-write tool and keeps the existing explicit confirmation boundary.
- Registry metadata drives list-tools output, dispatch safety, and the common governed response envelope.
- Tools accept optional `projectRoot` where supported so callers can target an explicit workspace without creating a second state store.
- Project-context tools remain read-only and separate from memory write and commit workflows.
- Manifest-version tests assert release version 5.5.4 and built MCP bin coverage; this is a contract assertion, not a registry behavior change.
- Response envelope time and shared result contracts depend on `core-types`.

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

- source:src/tool-registry.ts
- source:src/mcp-response.ts
- source:src/tests/tool-registry.test.ts
- source:src/tests/mcp-response.test.ts
- source:package.json
- validation:5.5.4 source suite — registry manifest/version assertions accepted.
- review:hp-review-source-final-20260713-r3 — source review accepted with P0–P3 clear.

## Read Contract

- Read this card before changing MCP tool metadata, safety classification, common envelopes, or package manifest assertions.
- Do not use this card as the owner of handler implementation or server transport lifecycle.

## Conflicts and Supersession

- None.

## 中文摘要

- MCP 名冊仍維持 18 個工具，`memory_reindex` 仍需明確確認才可寫入。
- 5.5.4 只同步 manifest 版本斷言，並未宣稱 registry 行為變更。
- 共用 response envelope 與契約型別仍由 `core-types` 支援。

## Tracked Files

- src/tool-registry.ts
- src/mcp-response.ts
- src/tests/tool-registry.test.ts
- src/tests/mcp-response.test.ts

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
