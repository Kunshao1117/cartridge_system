---
name: release-packaging
scopePath: scripts/
dependencies:
  - _system
description: >
  專案記憶：VSIX、npm runtime 與 Desktop 三線打包發布契約。Use when: 修改本機 VSIX 打包、GitHub
  workflows、桌面安裝檔或發布標籤時載入。
last_updated: '2026-07-11T14:53:24+08:00'
status: stable
staleness: 0
memory_schema_version: 2
memory_quality_version: 1
memory_kind: source_fact
verification_status: verified
last_verified: '2026-07-11T14:40:20+08:00'
valid_scope: current-project
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 6
cycle_event_limit: 30
size_limit_bytes: 16384
line_limit: 120
archive_policy: volume
compaction_status: ready
metadata:
  author: antigravity
  version: '1.1'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
    - 'filesystem:write'
    - 'terminal:test'
---
# release packaging — Module Memory

## Current Truth

- This card owns VSIX packaging, GitHub release workflows, npm publication workflow, Desktop release workflow, and installer metadata.
- Release 5.5.3 uses three tags: `v5.5.3`, `npm-v5.5.3`, and `desktop-v5.5.3`.
- Desktop and VSIX artifacts must be built from the same source revision so both runtimes contain identical canonical-state and Git-exclusion behavior.
- The npm tag publishes the standalone MCP runtime from that same release source.
- Generated VSIX, EXE, blockmap, and `latest.yml` files remain ignored build outputs and become release assets instead of Git-tracked files.
- Package version and build/test configuration are consumed from `_system` and must be current before tags are created.

## Active Constraints

- Do not create any of the three release tags from different source revisions.
- Build and validate source before packaging; packaging alone does not substitute for the release quality route.
- Never commit generated installers, VSIX files, blockmaps, or update metadata.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Recorded the 5.5.0 split-release targets.
- 03: Standardized the active memory main file and evidence sections.
- 04: Standardized ownership for the 5.5.1 governance repair.
- 05: Recorded the 5.5.2 split-release targets after the build security patch.
- 06: Recorded the 5.5.3 same-revision three-tag release and ignored artifact policy.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## Evidence Base

- source:scripts/package-vsix.mjs
- source:.github/workflows/release.yml
- source:.github/workflows/npm-publish.yml
- source:.github/workflows/desktop-release.yml
- source:electron-builder.desktop.yml
- source:package.json
- docs:README.md
- docs:CHANGELOG.md
- validation:VD-03 — 5.5.3 packaging and same-source validation provenance.
- review:RD-03 — independent 5.5.3 release review provenance.

## Read Contract

- Read this card before changing packaging scripts, release workflows, installer metadata, tags, or generated artifact handling.
- Do not use this card for runtime state behavior or package dependency decisions.

## Conflicts and Supersession

- None.

## 中文摘要

- 5.5.3 以 `v5.5.3`、`npm-v5.5.3`、`desktop-v5.5.3` 三條標籤發布。
- Desktop 與 VSIX 必須來自同一份原始碼 revision，確保功能與狀態行為一致。
- VSIX、EXE、blockmap 與 `latest.yml` 只作為發布資產，不納入 Git。

## Tracked Files

- scripts/package-vsix.mjs
- .github/workflows/release.yml
- .github/workflows/npm-publish.yml
- .github/workflows/desktop-release.yml
- electron-builder.desktop.yml

## Relations

- _assets（README, CHANGELOG, and public release notes）
- mcp-tools.server（npm runtime release version）

## Applicable Skills

- plugin-release-governance — Use for VSIX and multi-channel release preparation.
- memory-ops — Use for governed updates and staleness repair of this card.
