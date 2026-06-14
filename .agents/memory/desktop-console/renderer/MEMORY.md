---
name: desktop-console.renderer
description: >
  專案記憶：桌面監控台 React + Fluent UI 渲染端。Use when: 修改多專案 UI、狀態卡、 專案詳情、桌面版樣式或 renderer
  build 設定時載入。
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
memory_kind: implementation
verification_status: verified
last_verified: '2026-06-15T00:47:16+08:00'
valid_scope:
  - .agents/memory/desktop-console/renderer
scopePath: null
---
# desktop console / renderer — Module Memory

## Current Truth

- This card is the parent overview for the Desktop Console renderer.
- Direct renderer implementation ownership is delegated to bridge, panels, runtime, and styles child cards.
- The renderer remains a dense operational monitoring surface, not a marketing page.

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

- source:.agents/memory/desktop-console/renderer

## Read Contract

- Read this card before editing desktop-console.renderer tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession

- None recorded.

## 中文摘要

- 桌面 renderer 已改為父層總覽卡。
- UI 元件、bridge、runtime 與樣式改由子卡承接，清除粒度警告。

## Tracked Files

- （父層總覽，不直接追蹤實作檔案）

## Relations

- desktop-console（parent card）
- desktop-console.renderer.bridge（child card: preload API and status projection）
- desktop-console.renderer.panels（child card: operator panels and layout tests）
- desktop-console.renderer.runtime（child card: renderer boot and Vite config）
- desktop-console.renderer.styles（child card: style modules and CSS）
- desktop-console.app（IPC source）
