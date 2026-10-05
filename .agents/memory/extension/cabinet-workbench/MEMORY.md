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
verification_status: pending_review
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
  - src/tests/cabinet-panel-lifecycle.test.ts
scopePath: null
---
# extension.cabinet-workbench — Module Memory

## Current Truth


- Owns cabinet panel, model/derive, metadata loader, HTML/webview and their lifecycle contract; graph-viewport behavior is delegated to its child card.
- Model construction first creates a visible index and uses shared warning classification, so managed artifacts and quality/dependency findings are not counted as a separate project truth.
- Panel generation/request checks discard metadata completed after disposal, from an old reopened generation or after a newer refresh.
- Final metadata reads obey project containment; missing/conflicting main files stay visible as diagnostics rather than being silently selected.

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


- source:https://github.com/Kunshao1117/cartridge_system/blob/3f346804c8c72944a2c61a46544421c9f9009ef2/.agents/memory/extension/cabinet-workbench/MEMORY.md — reviewed original card revision.
- source:https://github.com/Kunshao1117/cartridge_system/tree/3f346804c8c72944a2c61a46544421c9f9009ef2 — source tree for this static claim/ownership review; use Tracked Files for the exact source slice.

## Read Contract

- Read this card before editing extension.cabinet-workbench tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession


- Static comparison target: 5.5.8 source 3f346804c8c72944a2c61a46544421c9f9009ef2. Historical cycle/archive records remain unchanged; old validation IDs do not establish current runtime acceptance.

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
- src/tests/cabinet-panel-lifecycle.test.ts

## Relations

- extension（parent card: VS Code commands 與治理側邊欄註冊）
- extension.governance-sidebar（卡匣機櫃入口由側邊欄標題列與 command manifest 暴露）
- extension.cabinet-workbench.graph-viewport（圖譜視角保存、layout reason 與可讀 zoom helper）
