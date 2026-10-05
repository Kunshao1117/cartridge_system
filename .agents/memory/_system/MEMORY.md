---
name: _system
scopePath: null
description: >
  專案記憶：5.5.8 套件版本、TypeScript 建置、測試、lint 與相依安全設定。Use when: 確認 5.5.8
  系統版本、建置工具鏈或發布前品質命令時載入。
last_updated: '2026-07-13T23:00:10+08:00'
status: stable
staleness: 0
memory_schema_version: 2
memory_quality_version: 1
memory_kind: source_fact
verification_status: pending_review
last_verified: '2026-07-13T22:55:00+08:00'
valid_scope: current-project
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 8
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


- This card owns package/lock identity, TypeScript, bundling, lint, test configuration and cross-module acceptance suites; release workflows and artifacts are owned by `release-packaging`.
- `package.json` and both root package identities in `package-lock.json` are synchronized to 5.5.8; MCP version and manifest assertions must agree.
- The quality route includes targeted and full tests, lint, TypeScript, extension/MCP and Desktop builds, production audit, packaging and stdio checks as wired by package scripts and CI.
- The lock retains the esbuild override and 5.5.5 security dependency updates. 5.5.8 changes package identity without another dependency overhaul.
- Production audit zero in the recorded release evidence does not clear the full build/development tree: the documented baseline remains 29 findings (25 high, 4 moderate). Audit counts require a new query before being treated as current.
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
- 08: 5.5.4 synchronized `package.json` and root `package-lock.json` identity while retaining quality-route constraints.
## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.
- archive-002.md — Legacy card content before schema v2 migration on 2026-06-04.
## Evidence Base


- source:https://github.com/Kunshao1117/cartridge_system/blob/3f346804c8c72944a2c61a46544421c9f9009ef2/.agents/memory/_system/MEMORY.md — reviewed original card revision.
- source:https://github.com/Kunshao1117/cartridge_system/tree/3f346804c8c72944a2c61a46544421c9f9009ef2 — source tree for this static claim/ownership review; use Tracked Files for the exact source slice.
- validation:5.5.4 source suite — typecheck, lint, and full tests accepted. Historical only; original receipt not revalidated in this review.
- validation:validation-artifact-5.5.4-20260713-r1 — packaged version consistency accepted. Historical only; original receipt not revalidated in this review.
- review:hp-review-source-final-20260713-r3 — source review accepted with P0–P3 clear. Historical only; original receipt not revalidated in this review.
## Read Contract

- Read this card before changing package identity, build configuration, test configuration, lint, or dependency security controls.
- Do not use this card for release tags, installer workflow behavior, or documentation wording.
## Conflicts and Supersession


- Static comparison target: 5.5.8 source 3f346804c8c72944a2c61a46544421c9f9009ef2. Historical cycle/archive records remain unchanged; old validation IDs do not establish current runtime acceptance.
## 中文摘要


- package／lock 根身分為 5.5.8，MCP 與測試版本應同步。
- 保留完整品質路徑；歷史 production audit 0 不代表全開發樹零風險。
- 發布工作流程及成品由 release-packaging 管理。
## Tracked Files


- package.json
- package-lock.json
- tsconfig.json
- tsup.config.ts
- tsup.desktop.config.ts
- eslint.config.js
- vitest.config.ts
- src/tests/context-memory-alignment.test.ts
- src/tests/core-diagnostic-regressions.test.ts
- src/tests/core-integrity-regressions.test.ts
- src/tests/dependency-state-alignment.test.ts
- src/tests/desktop-surface-regressions.test.ts
- src/tests/mcp-read-audit-regressions.test.ts
- src/tests/memory-commit-sync.test.ts
- src/tests/memory-review-guidance.test.ts
- src/tests/monitoring-review-state.test.ts
- src/tests/project-monitor-startup-transaction.test.ts
- src/tests/security-boundaries.test.ts
- src/tests/surface-canonical-health.test.ts
## Relations

- release-packaging（release workflows, tags, and installer metadata）
- _assets（README, CHANGELOG, and static assets）
## Applicable Skills

- memory-ops — Use for governed updates and staleness repair of this card.
