---
name: tool-registry
description: >
  專案記憶：MCP 工具名冊與統一回傳契約。Use when: 處理工具風險分級、MCP tools 清單生成、治理 envelope
  或高階工具回傳格式時載入。
last_updated: '2026-06-15T00:55:00+08:00'
status: stable
staleness: 0
memory_schema_version: 2
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
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
    - 'filesystem:write'
memory_quality_version: 1
memory_kind: implementation
verification_status: verified
last_verified: '2026-06-15T00:55:00+08:00'
valid_scope:
  - src/tool-registry.ts
  - src/mcp-response.ts
  - src/tests/tool-registry.test.ts
  - src/tests/mcp-response.test.ts
scopePath: null
---
# tool-registry — Module Memory

## Current Truth

- This card is the schema v2 memory owner for mcp-tools.tool-registry.
- Its implementation boundary is the tracked file list below.
- Legacy decisions, lessons, and repair notes were preserved in archive-001.md.
- Frontmatter dependencies are retained as staleness propagation dependencies and must not be used for navigation-only links.
- Directory nesting is navigation; parent-child placement is not a dependency by itself.
- Current behavior must still be verified against source before edits.
- The registry currently exposes 17 MCP tools across memory, context, and project context groups.
- The package manifest contract is pinned to version 5.5.1 with MCP bin entries limited to built dist files.
- Project context tools remain read-only and separate from memory commit workflows.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in description and Chinese summary.
- Use dependencies only for true staleness propagation; use Relations for navigation.
- Do not rewrite archive volumes during active-card standardization.
- Treat missing evidence as pending review, not as complete quality.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Synced the 5.5.0 registry contract and package manifest coverage after release.
- 03: Standardized active memory main file to MEMORY.md with quality metadata and evidence sections.
- 04: Standardized memory ownership and YAML valid_scope for the 5.5.1 governance repair.
- 05: Synced package manifest version assertions to 5.5.1 after the security patch release.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## Evidence Base

- source:src/tool-registry.ts
- source:src/mcp-response.ts
- source:src/tests/tool-registry.test.ts
- source:src/tests/mcp-response.test.ts

## Read Contract

- Read this card before editing tool-registry tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession

- None recorded.

## 中文摘要

- mcp-tools.tool-registry 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
- MCP 工具名冊目前公開 17 個工具，並維持 project context 工具只讀。
- npm manifest 版本、MCP bin 與打包範圍已對齊 5.5.1 發布契約。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- src/tool-registry.ts
- src/mcp-response.ts
- src/tests/tool-registry.test.ts
- src/tests/mcp-response.test.ts

## Relations

- mcp-tools（父卡：MCP 工具註冊、路由與工具契約）
- core-types（依賴：MCP response envelope metadata 時間戳）
- mcp-tools.workspace-brief（消費 envelope 的高階治理工具）
- mcp-tools.commit-preflight（消費 envelope 的高階治理工具）
- mcp-tools.memory-audit（消費 envelope 的完整健檢工具）
- mcp-tools.dispatcher（消費工具 metadata 並執行明確確認防線）
- mcp-tools.context-governance（消費工具 metadata 並提供 v5 context tools）
- mcp-tools.memory-graph（消費 envelope 契約並提供 memory_graph 工具）
- mcp-tools.project-context（消費 envelope 契約並提供 project_context 工具）
