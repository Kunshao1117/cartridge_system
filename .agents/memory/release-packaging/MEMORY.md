---
name: release-packaging
scopePath: scripts/
description: >
  專案記憶：VSIX 發行打包輔助腳本。Use when: 修改本機 VSIX 打包流程、處理 VSCE 與 npm files
  白名單衝突、重打包安裝檔或調整發布腳本時載入。
last_updated: '2026-06-15T01:57:06+08:00'
status: stable
staleness: 0
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 5
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
    - 'terminal:test'
memory_quality_version: 1
memory_kind: release
verification_status: verified
last_verified: '2026-06-15T01:55:53+08:00'
valid_scope:
  - scripts/package-vsix.mjs
  - .github/workflows/release.yml
  - .github/workflows/npm-publish.yml
  - .github/workflows/desktop-release.yml
  - electron-builder.desktop.yml
---
# release packaging — Module Memory

## Current Truth

- This card owns VSIX packaging script, GitHub release workflows, npm publish workflow, desktop release workflow, and installer metadata.
- The 5.5.2 release uses split tags: VSIX via v5.5.2, npm runtime via npm-v5.5.2, and Desktop Console via desktop-v5.5.2.
- Generated VSIX and desktop installer artifacts remain ignored release outputs and must not be committed.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in description and Chinese summary.
- Use dependencies only for true staleness propagation; use Relations for navigation.
- Do not rewrite archive volumes during active-card standardization.
- Treat missing evidence as pending review, not as complete quality.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Recorded 5.5.0 split-release packaging targets after the archive-untracked repair.
- 03: Standardized active memory main file to MEMORY.md with quality metadata and evidence sections.
- 04: Standardized memory ownership and YAML valid_scope for the 5.5.1 governance repair.
- 05: Recorded 5.5.2 split-release packaging targets after the build security patch.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## Evidence Base

- source:scripts/package-vsix.mjs
- source:.github/workflows/release.yml
- source:.github/workflows/npm-publish.yml
- source:.github/workflows/desktop-release.yml
- source:electron-builder.desktop.yml

## Read Contract

- Read this card before editing release-packaging tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession

- None recorded.

## 中文摘要

- release-packaging 已承接三線發布流程。
- 5.5.2 需重新打包 VSIX、npm runtime 與桌面安裝檔。

## Tracked Files

- scripts/package-vsix.mjs
- .github/workflows/release.yml
- .github/workflows/npm-publish.yml
- .github/workflows/desktop-release.yml
- electron-builder.desktop.yml

## Relations

- _system（package version and build/test config）
- _assets（README and CHANGELOG release notes）
