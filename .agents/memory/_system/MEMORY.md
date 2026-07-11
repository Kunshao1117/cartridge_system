---
name: _system
scopePath: null
description: >
  專案記憶：套件版本、TypeScript 建置、測試、lint 與相依安全設定。Use when: 確認 5.5.3
  系統版本、建置工具鏈或發布前品質命令時載入。
last_updated: '2026-07-11T14:51:35+08:00'
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
cycle_event_count: 7
cycle_event_limit: 30
size_limit_bytes: 16384
line_limit: 120
archive_policy: volume
compaction_status: ready
metadata:
  author: antigravity
  version: '4.2'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
---
# _system — Module Memory

## Current Truth

- This card owns the package and lockfile version, TypeScript configuration, bundling, lint, test, and dependency-audit constraints.
- `package.json` and the root package identity in `package-lock.json` are synchronized to 5.5.3.
- The release quality route includes targeted tests, full tests, lint, `tsc --noEmit`, extension build, and desktop build before packaging or publication.
- Dependency audit and manifest assertions remain part of release readiness.
- The package manifest retains the security override for `esbuild` and the supported MCP runtime dependency resolution.
- Release workflows, installer metadata, tags, and generated artifacts are owned by `release-packaging`.

## Active Constraints

- Keep package and lockfile root versions synchronized with MCP server metadata and tests.
- Do not add dependencies or relax build, lint, typecheck, test, or audit gates without an explicit source change plan.
- Generated installers and VSIX files are release outputs, not tracked system files.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Synchronized package and split release targets to 5.5.0.
- 03: Standardized the active memory main file and evidence sections.
- 04: Standardized ownership for the 5.5.1 governance repair.
- 05: Updated package and lockfile to 5.5.1 with dependency security verification.
- 06: Updated package and lockfile to 5.5.2 with the `esbuild` security override.
- 07: Synchronized package and lockfile identity to 5.5.3 and retained the full release quality route.

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
- validation:VD-03 — 5.5.3 build, lint, test, typecheck, and audit validation provenance.
- review:RD-03 — independent 5.5.3 review provenance.

## Read Contract

- Read this card before changing package identity, build configuration, test configuration, lint, or dependency security controls.
- Do not use this card for release tags, installer workflow behavior, or documentation wording.

## Conflicts and Supersession

- None.

## 中文摘要

- 套件與 lockfile 的根版本已同步為 5.5.3。
- 發布前保留測試、lint、型別檢查、兩條建置與相依稽核門檻。
- 發布標籤與產物規則由 release-packaging 卡管理。

## Tracked Files

- package.json
- package-lock.json
- tsconfig.json
- tsup.config.ts
- tsup.desktop.config.ts
- eslint.config.js
- vitest.config.ts

## Relations

- release-packaging（release workflows, tags, and installer metadata）
- _assets（README, CHANGELOG, and static assets）

## Applicable Skills

- memory-ops — Use for governed updates and staleness repair of this card.
