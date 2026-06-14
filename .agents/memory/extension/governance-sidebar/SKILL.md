---
name: extension.governance-sidebar
description: >
  專案記憶：v5 獨立 Activity Bar 治理側邊欄。Use when: 修改 Cartridge Activity Bar
  container、治理總覽、上下文治理 findings、待處理項目或 VS Code TreeView provider 時載入。
last_updated: '2026-06-04T08:01:01+08:00'
status: stale
staleness: 20
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 2
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
---
<!-- CARTRIDGE_SYSTEM_WARNING_START -->

> [!CAUTION]
> 🟠 **系統強制攔截**：此記憶已過期失真！
> 追蹤檔案異動：`src/action-items-model.ts`、`src/tests/governance-sidebar.test.ts`（2026-06-14T23:07:24+08:00）
> AI 嚴禁基於此記憶施工，必須優先閱讀最新原始碼並更新此記憶卡。
> staleness: 20 | threshold: 🟠 顯著過期

<!-- CARTRIDGE_SYSTEM_WARNING_END -->

# extension / governance sidebar — Module Memory

## Current Truth

- This card is the schema v2 memory owner for extension.governance-sidebar.
- Its implementation boundary is the tracked file list below.
- Legacy decisions, lessons, and repair notes were preserved in archive-001.md.
- No staleness propagation dependency is recorded in frontmatter.
- Directory nesting is navigation; parent-child placement is not a dependency by itself.
- Current behavior must still be verified against source before edits.
- Governance summary and action item providers use the visible index view before computing untracked blockers.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in the description and Chinese summary.
- Add at most one Cycle Events item per update and compact before event 31.
- Do not restore legacy Key Decisions or Module Lessons into the main card body.
- Keep Tracked Files focused on files this card can actually explain.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Filtered memory archive-volume residues from governance overview and action item untracked counts.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## 中文摘要

- extension.governance-sidebar 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
- 治理總覽與待處理項目不會把 `.agents/memory/**/archive-###.md` 列成產品未歸屬。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- src/governance-summary.ts
- src/governance-tree-provider.ts
- src/context-tree-provider.ts
- src/action-items-model.ts
- src/action-items-provider.ts
- src/tests/governance-sidebar.test.ts

## Relations

- mcp-tools.context-governance（共用規則檔檢查概念）
- extension.cabinet-workbench（編輯區卡匣機櫃工作台）

## Applicable Skills

- code-quality
