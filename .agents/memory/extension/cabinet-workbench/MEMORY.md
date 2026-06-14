---
name: extension.cabinet-workbench
description: >
  專案記憶：卡匣機櫃工作台。Use when: 修改編輯區 WebviewPanel、卡匣工作台模型、 V2 記憶卡 metadata
  解析、Cytoscape Webview 前端或卡匣機櫃測試時載入。
last_updated: '2026-06-15T00:47:16+08:00'
status: stale
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
memory_quality_version: 1
memory_kind: implementation
verification_status: verified
last_verified: '2026-06-15T00:47:16+08:00'
valid_scope:
  - src/cabinet-workbench-panel.ts
  - src/cabinet-workbench-model.ts
  - src/cabinet-workbench-derive.ts
  - src/cabinet-memory-metadata.ts
  - src/cabinet-workbench-html.ts
  - src/cabinet-webview.ts
  - src/tests/cabinet-workbench-model.test.ts
  - src/tests/cabinet-workbench-html.test.ts
scopePath: null
---
# extension.cabinet-workbench — Module Memory

## Current Truth

- This card is the schema v2 memory owner for extension.cabinet-workbench.
- Its implementation boundary is the tracked file list below.
- Legacy decisions, lessons, and repair notes were preserved in archive-001.md.
- Frontmatter dependencies are retained as staleness propagation dependencies and must not be used for navigation-only links.
- Directory nesting is navigation; parent-child placement is not a dependency by itself.
- Current behavior must still be verified against source before edits.
- Cabinet workbench model generation receives or creates a visible index view before counting untracked files.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in description and Chinese summary.
- Use dependencies only for true staleness propagation; use Relations for navigation.
- Do not rewrite archive volumes during active-card standardization.
- Treat missing evidence as pending review, not as complete quality.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Routed cabinet workbench model and panel data through visible untracked filtering.
- 03: Standardized active memory main file to MEMORY.md with quality metadata and evidence sections.
- 04: Standardized memory ownership and YAML valid_scope for the 5.5.1 governance repair.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## Evidence Base

- source:src/cabinet-workbench-panel.ts
- source:src/cabinet-workbench-model.ts
- source:src/cabinet-workbench-derive.ts
- source:src/cabinet-memory-metadata.ts
- source:src/cabinet-workbench-html.ts
- source:src/cabinet-webview.ts
- source:src/tests/cabinet-workbench-model.test.ts
- source:src/tests/cabinet-workbench-html.test.ts

## Read Contract

- Read this card before editing extension.cabinet-workbench tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession

- None recorded.

## 中文摘要

- extension.cabinet-workbench 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
- 卡匣機櫃工作台不會把記憶歸檔卷顯示為未歸屬產品檔案。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- src/cabinet-workbench-panel.ts
- src/cabinet-workbench-model.ts
- src/cabinet-workbench-derive.ts
- src/cabinet-memory-metadata.ts
- src/cabinet-workbench-html.ts
- src/cabinet-webview.ts
- src/tests/cabinet-workbench-model.test.ts
- src/tests/cabinet-workbench-html.test.ts

## Relations

- extension（parent card: VS Code commands 與治理側邊欄註冊）
- extension.governance-sidebar（卡匣機櫃入口由側邊欄標題列與 command manifest 暴露）
- extension.cabinet-workbench.graph-viewport（圖譜視角保存、layout reason 與可讀 zoom helper）
