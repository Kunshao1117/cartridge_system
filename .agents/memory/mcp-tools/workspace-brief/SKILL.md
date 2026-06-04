---
name: workspace-brief
description: >
  專案記憶：workspace_brief 高階治理摘要工具。Use when: 處理 AI 開工摘要、記憶卡健康彙整、readiness
  判斷與建議行動排序時載入。
last_updated: '2026-06-04T08:01:01+08:00'
status: stable
staleness: 0
dependencies:
  - core-types
  - mcp-tools.tool-registry
  - mcp-tools.memory-audit
  - mcp-tools.context-governance
  - mcp-tools.project-context
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
---

# mcp tools / workspace brief — Module Memory

## Current Truth

- This card is the schema v2 memory owner for mcp-tools.workspace-brief.
- Its implementation boundary is the tracked file list below.
- Legacy decisions, lessons, and repair notes were preserved in archive-001.md.
- Frontmatter dependencies are retained as staleness propagation dependencies and must not be used for navigation-only links.
- Directory nesting is navigation; parent-child placement is not a dependency by itself.
- Current behavior must still be verified against source before edits.
- `workspace_brief` filters managed memory internals before computing memory readiness and submit readiness.
- Workspace readiness treats memory archive volumes as governance internals, not product files awaiting attribution.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in the description and Chinese summary.
- Add at most one Cycle Events item per update and compact before event 31.
- Do not restore legacy Key Decisions or Module Lessons into the main card body.
- Keep Tracked Files focused on files this card can actually explain.

## Known Issues

- None active. Dependency rationale: core-types, mcp-tools.tool-registry, mcp-tools.memory-audit, mcp-tools.context-governance, mcp-tools.project-context are upstream dependencies; upstream staleness must trigger review for this card.


## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Kept schema v2 archive volumes out of workspace memory readiness untracked counts.
- 03: Consolidated workspace memory untracked filtering through the shared visible-untracked helper.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## 中文摘要

- mcp-tools.workspace-brief 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
- workspace_brief 不會把記憶歸檔卷計入開工 blocker。
- 開工摘要的未歸屬數與 commit_preflight / memory_audit 使用相同排除規則。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- src/workspace-brief.ts
- src/workspace-brief-summary.ts
- src/tests/workspace-brief.test.ts

## Relations

- mcp-tools（父卡：MCP 工具註冊、路由與工具契約）
- core-types（依賴：路徑驗證與 staleness 等級轉換）
- mcp-tools.tool-registry（共用：MCP 統一回傳 envelope）
- mcp-tools.memory-audit（依賴：compatibility warning 規則）
- mcp-tools.context-governance（依賴：規則來源掃描與規則衝突檢查）
- mcp-tools.project-context（依賴：專案脈絡掃描、驗證與狀態摘要）

## Applicable Skills

- memory-ops
- memory-arch
- security-sre
- test-patterns
