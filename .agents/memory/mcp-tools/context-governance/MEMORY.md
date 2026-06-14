---
name: context-governance
description: >
  專案記憶：v5 規則檔檢查工具。Use when: 處理 context_inventory、context_audit、
  context_diff、context_plan、AI 規則來源掃描或跨代理規則衝突偵測時載入。
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
    - 'filesystem:write'
memory_quality_version: 1
memory_kind: implementation
verification_status: verified
last_verified: '2026-06-15T00:47:16+08:00'
valid_scope:
  - src/context-types.ts
  - src/context-contract.ts
  - src/context-registry.ts
  - src/context-audit.ts
  - src/context-tools.ts
  - src/tests/context-governance.test.ts
scopePath: null
---
# context-governance — Module Memory

## Current Truth

- This card is the schema v2 memory owner for mcp-tools.context-governance.
- Its implementation boundary is the tracked file list below.
- Legacy decisions, lessons, and repair notes were preserved in archive-001.md.
- Frontmatter dependencies are retained as staleness propagation dependencies and must not be used for navigation-only links.
- Directory nesting is navigation; parent-child placement is not a dependency by itself.
- Current behavior must still be verified against source before edits.

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

- source:src/context-types.ts
- source:src/context-contract.ts
- source:src/context-registry.ts
- source:src/context-audit.ts
- source:src/context-tools.ts
- source:src/tests/context-governance.test.ts

## Read Contract

- Read this card before editing context-governance tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession

- None recorded.

## 中文摘要

- mcp-tools.context-governance 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- src/context-types.ts
- src/context-contract.ts
- src/context-registry.ts
- src/context-audit.ts
- src/context-tools.ts
- src/tests/context-governance.test.ts

## Relations

- mcp-tools（父卡：MCP 工具介面總覽）
- mcp-tools.tool-registry（依賴：工具 metadata 與 envelope 契約）
- mcp-tools.dispatcher（消費：context tool handlers）
- mcp-tools.workspace-brief（消費：context readiness）
- core-types（依賴：路徑驗證與 MCP response envelope）
- index-manager（依賴：Tracked Files parser）
