---
name: _assets
scopePath: null
description: |
  專案記憶：靜態檔案與一般文檔收納。 Use when: 處理不需要業務邏輯追蹤的靜態圖檔、授權文件或更新日誌等。
last_updated: '2026-06-15T02:02:03+08:00'
status: stable
staleness: 0
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 7
cycle_event_limit: 30
size_limit_bytes: 16384
line_limit: 120
archive_policy: volume
compaction_status: ready
metadata:
  author: antigravity
  version: '1.2'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
memory_quality_version: 1
memory_kind: static
verification_status: verified
last_verified: '2026-06-15T02:02:00+08:00'
valid_scope:
  - README.md
  - CHANGELOG.md
  - LICENSE
  - assets/logo.png
  - assets/cartridge-activity.svg
  - desktop-assets/cartridge-desktop.ico
---

# _assets — Module Memory

## Current Truth

- This card owns static documentation and visual assets that do not carry runtime business logic.
- README and CHANGELOG must describe the current public release version and split release model.
- 5.5.2 documentation records the esbuild security override, GitNexus CLI rebuild, split release examples, and desktop-v5.5.2 release notes.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in description and Chinese summary.
- Use dependencies only for true staleness propagation; use Relations for navigation.
- Do not rewrite archive volumes during active-card standardization.
- Treat missing evidence as pending review, not as complete quality.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Updated release documentation for 5.5.0, including VSIX, npm, Desktop tags, and test totals.
- 03: Standardized active memory main file to MEMORY.md with quality metadata and evidence sections.
- 04: Standardized memory ownership and YAML valid_scope for the 5.5.1 governance repair.
- 05: Updated README and CHANGELOG for 5.5.1 security, memory governance, and three-line release artifacts.
- 06: Updated README and CHANGELOG for the 5.5.2 build security patch and CLI graph rebuild.
- 07: Added desktop-v5.5.2 release notes for the desktop workflow.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## Evidence Base

- source:README.md
- source:CHANGELOG.md
- source:LICENSE
- source:assets/logo.png
- source:assets/cartridge-activity.svg
- source:desktop-assets/cartridge-desktop.ico

## Read Contract

- Read this card before editing _assets tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession

- None recorded.

## 中文摘要

- 文件與靜態資產由 _assets 收容。
- README 與 CHANGELOG 需同步 5.5.2 修復內容。

## Tracked Files

- README.md
- CHANGELOG.md
- LICENSE
- assets/logo.png
- assets/cartridge-activity.svg
- desktop-assets/cartridge-desktop.ico

## Relations

- _system（package version source）
- release-packaging（release workflows and artifact rules）
