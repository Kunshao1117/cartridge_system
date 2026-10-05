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
verification_status: pending_review
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


- Owns VSIX, npm and Desktop release workflows, source/readback gates, prepublication packaging checks, stdio smoke and installer metadata.
- Release 5.5.8 uses v5.5.8, npm-v5.5.8 and desktop-v5.5.8 at one revision. At the 2026-10-04 readback all three GitHub releases are published from 3f346804c8c72944a2c61a46544421c9f9009ef2.
- The source gate checks exact checkout/event SHA, package version and freshly resolved peer tags, including annotated tags, and rechecks source before publication.
- GitHub publishing preserves existing assets and recovers source-bound drafts; precise space-to-dot filename normalization, stable asset identity, labels and downloaded digests are verified without claiming rebuild byte identity.
- npm readback requires exact version/gitHead, tarball hashes and supported provenance metadata; it is not independent signature/transparency-log verification.
- Read-only PR CI runs both OS suites, lint/types/builds, packaged stdio and full prepublishOnly; Linux VSIX and Windows --publish never packaging retain source/digest CI artifacts, not published releases.
- Generated packages remain ignored. Source/build inputs depend on `_system`; stopped/drained same-version clients and unsigned-Windows/GUI/UNC acceptance limits remain explicit.
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


- source:https://github.com/Kunshao1117/cartridge_system/blob/3f346804c8c72944a2c61a46544421c9f9009ef2/.agents/memory/release-packaging/MEMORY.md — reviewed original card revision.
- source:https://github.com/Kunshao1117/cartridge_system/tree/3f346804c8c72944a2c61a46544421c9f9009ef2 — source tree for this static claim/ownership review; use Tracked Files for the exact source slice.
- validation:VD-03 — 5.5.3 packaging and same-source validation provenance. Historical only; original receipt not revalidated in this review.
- review:RD-03 — independent 5.5.3 release review provenance. Historical only; original receipt not revalidated in this review.
- source:https://api.github.com/repos/Kunshao1117/cartridge_system/releases/403109595 — v5.5.8 release metadata readback 2026-10-04T18:45:00Z; published_at 2026-10-04T16:42:04Z; target 3f346804c8c72944a2c61a46544421c9f9009ef2.
- source:https://api.github.com/repos/Kunshao1117/cartridge_system/releases/403105996 — npm-v5.5.8 release metadata readback 2026-10-04T18:45:00Z; published_at 2026-10-04T16:29:26Z; target 3f346804c8c72944a2c61a46544421c9f9009ef2.
- source:https://api.github.com/repos/Kunshao1117/cartridge_system/releases/403133963 — desktop-v5.5.8 release metadata readback 2026-10-04T18:45:00Z; published_at 2026-10-04T17:52:09Z; target 3f346804c8c72944a2c61a46544421c9f9009ef2.
## Read Contract

- Read this card before changing packaging scripts, release workflows, installer metadata, tags, or generated artifact handling.
- Do not use this card for runtime state behavior or package dependency decisions.
## Conflicts and Supersession


- Static comparison target: 5.5.8 source 3f346804c8c72944a2c61a46544421c9f9009ef2. Historical cycle/archive records remain unchanged; old validation IDs do not establish current runtime acceptance.
## 中文摘要


- 5.5.8 三條 tag／三份 GitHub Release 已於固定來源讀回。
- 預發布包裝成品與正式發布成品分開核驗，保留同來源草稿復原與既有資產。
- 不把成品讀回或 metadata 檢查說成已安裝 Windows GUI／密碼學簽章驗證。
## Tracked Files


- scripts/package-vsix.mjs
- .github/workflows/release.yml
- .github/workflows/npm-publish.yml
- .github/workflows/desktop-release.yml
- electron-builder.desktop.yml
- .github/workflows/security-regression.yml
- scripts/npm-release-source.mjs
- scripts/publish-github-release.mjs
- scripts/release-readiness-check.mjs
- scripts/release-source.mjs
- scripts/security-mcp-smoke.mjs
- scripts/verify-npm-publication.mjs
- scripts/verify-prepublication-artifact.mjs
- src/tests/release-source.test.mjs
## Relations

- _assets（README, CHANGELOG, and public release notes）
- mcp-tools.server（npm runtime release version）
## Applicable Skills

- plugin-release-governance — Use for VSIX and multi-channel release preparation.
- memory-ops — Use for governed updates and staleness repair of this card.
