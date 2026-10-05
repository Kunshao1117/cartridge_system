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
verification_status: pending_review
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


- This card owns README, CHANGELOG, license, visual assets, and the README validation contract; it owns no runtime business logic.
- The current documented package is 5.5.8. The release model uses `v5.5.8`, `npm-v5.5.8`, and `desktop-v5.5.8` from one source revision.
- CHANGELOG is chronological evidence: the 5.5.8 correction supersedes earlier planned 5.5.7 delivery language; 5.5.6 completed npm only and 5.5.7 did not complete three-surface delivery.
- README requires review before authorized commit and distinguishes card write from index, tracking and derived synchronization. Editing prose alone does not clear stale, pending or ghost state.
- Generated VSIX, installer, blockmap and update metadata are release outputs, not tracked assets. Source docs and release notes do not by themselves prove installed GUI acceptance.

## Active Constraints

- Public version, tag examples, and runtime behavior claims must match validated source and release workflows.
- Track only source documentation, static assets and their owned documentation contract tests; do not add ignored generated binaries or update metadata.
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


- source:https://github.com/Kunshao1117/cartridge_system/blob/3f346804c8c72944a2c61a46544421c9f9009ef2/.agents/memory/_assets/MEMORY.md — reviewed original card revision.
- source:https://github.com/Kunshao1117/cartridge_system/tree/3f346804c8c72944a2c61a46544421c9f9009ef2 — source tree for this static claim/ownership review; use Tracked Files for the exact source slice.
- validation:validation-artifact-5.5.4-20260713-r1 — final artifact validation passed. Historical only; original receipt not revalidated in this review.
- review:hp-review-source-final-20260713-r3 — source review accepted with P0–P3 clear. Historical only; original receipt not revalidated in this review.

## Read Contract

- Read this card before changing public release documentation, license text, or static visual assets.
- Do not use this card for runtime implementation, release workflow mechanics, or ignored binary ownership.

## Conflicts and Supersession


- Static comparison target: 5.5.8 source 3f346804c8c72944a2c61a46544421c9f9009ef2. Historical cycle/archive records remain unchanged; old validation IDs do not establish current runtime acceptance.

## 中文摘要


- README／CHANGELOG 現況以 5.5.8 為準，舊版發布敘述只作歷史。
- 卡片寫入、索引／追蹤／衍生同步及已安裝 GUI 驗收必須分開證明。
- 產生的安裝包與更新資料不納入來源追蹤。

## Tracked Files


- README.md
- CHANGELOG.md
- LICENSE
- assets/logo.png
- assets/cartridge-activity.svg
- desktop-assets/cartridge-desktop.ico
- src/tests/readme-validation-contract.test.ts

## Relations

- _system（package version and build constraints）
- release-packaging（release workflows, tags, and artifact rules）

## Applicable Skills

- memory-ops — Use for governed updates and staleness repair of this card.
