---
name: tool-registry
description: >
  專案記憶：MCP 工具名冊與統一回傳契約。Use when: 處理工具風險分級、MCP tools 清單生成、治理 envelope
  或高階工具回傳格式時載入。
last_updated: '2026-06-04T07:18:23+08:00'
status: stale
staleness: 10
dependencies:
  - core-types
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
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
  tool_scope:
    - 'filesystem:read'
    - 'filesystem:write'
---
<!-- CARTRIDGE_SYSTEM_WARNING_START -->

> [!CAUTION]
> 🟠 **系統強制攔截**：此記憶已過期失真！
> 追蹤檔案異動：`src/tests/tool-registry.test.ts`（2026-06-04T08:15:47+08:00）
> AI 嚴禁基於此記憶施工，必須優先閱讀最新原始碼並更新此記憶卡。
> staleness: 10 | threshold: 🟠 顯著過期

<!-- CARTRIDGE_SYSTEM_WARNING_END -->
# mcp tools / tool registry — Module Memory

## Current Truth

- This card is the schema v2 memory owner for mcp-tools.tool-registry.
- Its implementation boundary is the tracked file list below.
- Legacy decisions, lessons, and repair notes were preserved in archive-001.md.
- Frontmatter dependencies are retained as staleness propagation dependencies and must not be used for navigation-only links.
- Directory nesting is navigation; parent-child placement is not a dependency by itself.
- Current behavior must still be verified against source before edits.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in the description and Chinese summary.
- Add at most one Cycle Events item per update and compact before event 31.
- Do not restore legacy Key Decisions or Module Lessons into the main card body.
- Keep Tracked Files focused on files this card can actually explain.

## Known Issues

- None active. Dependency rationale: core-types are upstream dependencies; upstream staleness must trigger review for this card.


## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## 中文摘要

- mcp-tools.tool-registry 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
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

## Applicable Skills

- memory-ops
- security-sre
- test-patterns
