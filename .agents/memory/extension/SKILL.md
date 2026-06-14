---
name: extension
description: >
  專案記憶：VS Code 外掛入口與 UI 模組。 Use when:
  處理外掛啟動生命週期、指令註冊、狀態列/TreeView/CodeLens/智慧歸屬等 UI 更新時載入。
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
    - 'filesystem:write'
---
<!-- CARTRIDGE_SYSTEM_WARNING_START -->

> [!CAUTION]
> 🟠 **系統強制攔截**：此記憶已過期失真！
> 追蹤檔案異動：`src/extension.ts`、`src/treeview-provider.ts`（2026-06-14T23:07:24+08:00）
> AI 嚴禁基於此記憶施工，必須優先閱讀最新原始碼並更新此記憶卡。
> staleness: 20 | threshold: 🟠 顯著過期

<!-- CARTRIDGE_SYSTEM_WARNING_END -->

# extension — Module Memory

## Current Truth

- This card is the schema v2 memory owner for extension.
- Its implementation boundary is the tracked file list below.
- Legacy decisions, lessons, and repair notes were preserved in archive-001.md.
- No staleness propagation dependency is recorded in frontmatter.
- This is a root-level memory card unless Relations says otherwise.
- Current behavior must still be verified against source before edits.
- Extension status, health report, TreeView, and scan refreshes use the visible index view for untracked counts.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in the description and Chinese summary.
- Add at most one Cycle Events item per update and compact before event 31.
- Do not restore legacy Key Decisions or Module Lessons into the main card body.
- Keep Tracked Files focused on files this card can actually explain.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Routed status bar, health report, scan refresh, and TreeView untracked displays through the visible index view.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## 中文摘要

- extension 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
- 外掛狀態列與健康報告不會再把記憶歸檔卷顯示成未歸屬檔案。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- src/extension.ts
- src/update-checker.ts
- src/tests/update-checker.test.ts
- src/governance-views.ts
- src/status-bar.ts
- src/tests/status-bar.test.ts
- src/treeview-provider.ts
- src/codelens-provider.ts

## Relations

- core-types（引用共用型別與設定工廠函式）
- index-manager（呼叫掃描以建立初始索引）
- mcp-tools（雙入口架構，共用檔案系統互動）
### 子模組
- injector（啟動時呼叫注入器確保記憶卡匣存在）
- watcher（啟動後委託監聽引擎管理檔案監聽）
- analyzer（過期分析器，接收監聽事件計算衰退指數）
- writer（記憶卡寫入器，植入/移除過期警報）
- gitignore-filter（提供 .gitignore 排除過濾）
- treeview-provider（v2.0 新增，v5.0 移入 Cartridge Activity Bar：記憶卡 TreeView 面板）
- cabinet-workbench（編輯區卡匣機櫃工作台）
- codelens-provider（v2.0 新增：CodeLens 行內標記）
- index-manager（含 smart-owner：智慧歸屬推薦引擎）

## Applicable Skills

- code-quality
