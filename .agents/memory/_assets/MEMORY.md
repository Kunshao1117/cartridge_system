---
name: _assets
scopePath: null
description: |
  專案記憶：README、CHANGELOG、授權文件與靜態視覺資產。Use when: 修改公開版本說明、發布文件或非業務邏輯靜態資產時載入。
last_updated: '2026-07-13T23:00:23+08:00'
status: stable
staleness: 0
memory_schema_version: 2
memory_quality_version: 1
memory_kind: static_container
verification_status: verified
last_verified: '2026-07-13T22:55:00+08:00'
valid_scope: current-project
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 9
cycle_event_limit: 30
size_limit_bytes: 16384
line_limit: 120
archive_policy: volume
compaction_status: ready
metadata:
  author: antigravity
  version: '1.3'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
---

# _assets — Module Memory

## Current Truth

- This static container owns README, CHANGELOG, license, and visual assets that do not carry runtime business logic.
- README and CHANGELOG describe the 5.5.4 monitor lifecycle and the `desktop-v5.5.4` release tag.
- Public documentation states that Desktop, VS Code, and MCP share canonical project state and refresh semantics.
- Release documentation uses the three-tag model: `v5.5.4`, `npm-v5.5.4`, and `desktop-v5.5.4`.
- Final 5.5.4 artifact validation passed; the final release artifacts are not installed or started by this record.
- Generated VSIX, installer EXE, blockmap, and update metadata remain ignored release artifacts and are not tracked by this card.

## Active Constraints

- Public version, tag examples, and runtime behavior claims must match validated source and release workflows.
- Track only source documentation and static assets; do not add ignored generated binaries or update metadata.
- Keep historical release detail in CHANGELOG rather than expanding this active card.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Documented the 5.5.0 three-line release and validation scope.
- 03: Standardized the active memory main file and evidence sections.
- 04: Standardized ownership for the 5.5.1 governance repair.
- 05: Updated documentation for the 5.5.1 security and memory governance release.
- 06: Updated documentation for the 5.5.2 build security patch.
- 07: Added Desktop 5.5.2 workflow release notes.
- 08: Updated README and CHANGELOG for 5.5.3 Git exclusions, canonical-state parity, and three-tag release.
- 09: 5.5.4 documentation and release-artifact event records monitor lifecycle, `desktop-v5.5.4`, and passed final artifact validation without installation.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## Evidence Base

- docs:README.md
- docs:CHANGELOG.md
- source:LICENSE
- source:assets/logo.png
- source:assets/cartridge-activity.svg
- source:desktop-assets/cartridge-desktop.ico
- validation:validation-artifact-5.5.4-20260713-r1 — final artifact validation passed.
- review:hp-review-source-final-20260713-r3 — source review accepted with P0–P3 clear.

## Read Contract

- Read this card before changing public release documentation, license text, or static visual assets.
- Do not use this card for runtime implementation, release workflow mechanics, or ignored binary ownership.

## Conflicts and Supersession

- None.

## 中文摘要

- README 與 CHANGELOG 已記錄 5.5.4 的 monitor lifecycle 與 `desktop-v5.5.4`。
- 最終 5.5.4 artifact validation 已通過，但本卡不宣稱產物已安裝或啟動。
- 安裝檔、VSIX、blockmap 與更新 metadata 均不納入 Git 追蹤。

## Tracked Files

- README.md
- CHANGELOG.md
- LICENSE
- assets/logo.png
- assets/cartridge-activity.svg
- desktop-assets/cartridge-desktop.ico

## Relations

- _system（package version and build constraints）
- release-packaging（release workflows, tags, and artifact rules）

## Applicable Skills

- memory-ops — Use for governed updates and staleness repair of this card.
