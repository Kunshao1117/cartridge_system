---
name: mcp-tools.dispatcher
description: >
  專案記憶：MCP 工具分派與工具層防線。Use when: 處理 MCP tool routing、unknown tool 錯誤、 high-risk
  tool 明確確認與 dispatcher 測試時載入。
last_updated: '2026-06-04T07:18:28+08:00'
status: stale
staleness: 20
dependencies:
  - core-types
  - mcp-tools.handlers
  - mcp-tools.tool-registry
  - mcp-tools.workspace-brief
  - mcp-tools.commit-preflight
  - mcp-tools.memory-audit
  - mcp-tools.context-governance
  - mcp-tools.memory-graph
  - mcp-tools.project-context
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
> 追蹤檔案異動：`src/tool-dispatcher.ts`、`src/tests/tool-dispatcher.test.ts`（2026-06-14T23:07:24+08:00）
> AI 嚴禁基於此記憶施工，必須優先閱讀最新原始碼並更新此記憶卡。
> staleness: 20 | threshold: 🟠 顯著過期

<!-- CARTRIDGE_SYSTEM_WARNING_END -->

# mcp tools / dispatcher — Module Memory

## Current Truth

- This card is the schema v2 memory owner for mcp-tools.dispatcher.
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

- None active. Dependency rationale: core-types, mcp-tools.handlers, mcp-tools.tool-registry, mcp-tools.workspace-brief, mcp-tools.commit-preflight, mcp-tools.memory-audit, mcp-tools.context-governance, mcp-tools.memory-graph, mcp-tools.project-context are upstream dependencies; upstream staleness must trigger review for this card.


## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## 中文摘要

- mcp-tools.dispatcher 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- src/tool-dispatcher.ts
- src/tool-workspace.ts
- src/tests/tool-dispatcher.test.ts

## Relations

- mcp-tools（父卡：MCP server routing 與工具介面）
- mcp-tools.handlers（依賴：底層 memory_* handler）
- mcp-tools.tool-registry（依賴：工具 metadata、風險等級與授權需求）
- mcp-tools.workspace-brief（依賴：workspace_brief handler）
- mcp-tools.commit-preflight（依賴：commit_preflight handler）
- mcp-tools.memory-audit（依賴：memory_audit handler）
- mcp-tools.context-governance（依賴：context governance handlers）
- mcp-tools.memory-graph（依賴：memory_graph handler）
- mcp-tools.project-context（依賴：project_context handlers）
- core-types（依賴：projectRoot 路徑驗證與工作區身分比較）

## Applicable Skills

- memory-ops
- security-sre
- test-patterns
