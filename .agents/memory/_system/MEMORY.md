---
name: _system
description: |
  專案記憶：系統技術堆疊與部署設定。 Use when: 確認技術選型、環境設定、部署組態時載入。
last_updated: '2026-06-15T00:57:00+08:00'
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
  version: '4.1'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
memory_quality_version: 1
memory_kind: system
verification_status: verified
last_verified: '2026-06-15T00:57:00+08:00'
valid_scope:
  - package.json
  - package-lock.json
  - tsconfig.json
  - tsup.config.ts
  - tsup.desktop.config.ts
  - eslint.config.js
  - vitest.config.ts
scopePath: null
---
# _system — Module Memory

## Current Truth

- This card owns package version, lockfile security posture, TypeScript, bundling, lint, and test configuration.
- Package and MCP runtime version are synchronized to 5.5.1 for the Hono security and memory governance repair release.
- Hono is resolved through the MCP SDK dependency tree at a non-vulnerable 4.12.21+ version.
- GitHub release workflows and desktop installer metadata are owned by release-packaging.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in description and Chinese summary.
- Use dependencies only for true staleness propagation; use Relations for navigation.
- Do not rewrite archive volumes during active-card standardization.
- Treat missing evidence as pending review, not as complete quality.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Synchronized package, lockfile, MCP runtime version, and split release target to 5.5.0.
- 03: Standardized active memory main file to MEMORY.md with quality metadata and evidence sections.
- 04: Standardized memory ownership and YAML valid_scope for the 5.5.1 governance repair.
- 05: Updated package and lockfile to 5.5.1 and verified Hono 4.12.25 for the security repair.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.
- archive-002.md — Legacy card content before schema v2 migration on 2026-06-04.

## Evidence Base

- source:package.json
- source:package-lock.json
- source:tsconfig.json
- source:tsup.config.ts
- source:tsup.desktop.config.ts
- source:eslint.config.js
- source:vitest.config.ts

## Read Contract

- Read this card before editing _system tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession

- None recorded.

## 中文摘要

- 系統卡已同步 5.5.1。
- 發布工作流與桌面安裝設定改由 release-packaging 卡承接，避免系統卡過大。

## Tracked Files

- package.json
- package-lock.json
- tsconfig.json
- tsup.config.ts
- tsup.desktop.config.ts
- eslint.config.js
- vitest.config.ts

## Relations

- release-packaging（release workflows, VSIX packaging, desktop installer metadata）
- _assets（README, CHANGELOG, static assets）
