---
name: desktop-console
description: >
  專案記憶：Cartridge Desktop Console 桌面監控台父層總覽。Use when: 處理桌面版產品線、多專案監控台、 Electron
  外殼、桌面監控 runtime 或桌面發布邊界時載入。
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
memory_quality_version: 1
memory_kind: overview
verification_status: verified
last_verified: '2026-06-15T00:47:16+08:00'
valid_scope:
  - .agents/memory/desktop-console
scopePath: null
---
# desktop-console — Module Memory

## Current Truth

- This card is the schema v2 memory owner for desktop-console.
- This card is a navigation or parent overview card and does not directly own implementation files.
- Legacy decisions, lessons, and repair notes were preserved in archive-001.md.
- No staleness propagation dependency is recorded in frontmatter.
- This is a root-level memory card unless Relations says otherwise.
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

- source:.agents/memory/desktop-console

## Read Contract

- Read this card before editing desktop-console tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession

- None recorded.

## 中文摘要

- desktop-console 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- （父層總覽，不直接追蹤實作檔案）

## Relations

- desktop-console.monitoring（子卡：純 Node 多專案監控 runtime）
- desktop-console.app（子卡：Electron 主程序、IPC、設定與通知）
- desktop-console.renderer（子卡：React + Fluent UI 桌面 UI）
- _system（系統技術棧與建構設定）
- _assets（README / CHANGELOG 文件）
