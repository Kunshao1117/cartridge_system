---
name: gitignore-filter
scopePath: null
description: |
  專案記憶：Git 標準排除與專案候選檔案探索服務。Use when: 修改檔案掃描、ignore 判定、fallback 或未歸屬候選語義時載入。
last_updated: '2026-07-11T14:51:47+08:00'
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
cycle_event_count: 4
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
---
# gitignore-filter — Module Memory

## Current Truth

- Git CLI is the canonical source for project candidates and ignore decisions in a Git repository.
- Discovery uses cached and untracked files with standard exclusions, preserving tracked files even when an ignore pattern matches them.
- Root and nested `.gitignore`, `.git/info/exclude`, and `core.excludesFile` are honored through Git-standard semantics.
- NUL-delimited output and literal path arguments preserve spaces, Unicode, and newline-containing filenames without shell interpolation.
- Candidate paths are normalized, deduplicated, sorted, contained inside the project root, and checked with `lstat` without symlink traversal expansion.
- Git absence, non-repository state, timeout, or abnormal command failure degrades to root `.gitignore` filtering with diagnostics instead of a fatal scan.
- `check-ignore` exit code 1 is a normal not-ignored decision and does not trigger fallback or warnings.

## Active Constraints

- Do not use `--no-index`; tracked files must remain eligible candidates.
- Keep Git execution shell-free with literal pathspecs, explicit timeout, and bounded buffers.
- The root `.gitignore` parser is fallback-only and cannot claim nested, info, or global exclude parity.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Standardized the active memory main file and evidence sections.
- 03: Standardized ownership for the 5.5.1 governance repair.
- 04: Adopted Git-standard exclusion discovery with tracked preservation and diagnostic fallback for 5.5.3.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## Evidence Base

- source:src/gitignore-filter.ts
- source:src/tests/gitignore-filter.test.ts
- source:.gitignore
- docs:README.md
- docs:CHANGELOG.md
- validation:VD-03 — 5.5.3 Git exclusion validation provenance.
- review:RD-03 — independent 5.5.3 review provenance.

## Read Contract

- Read this card before changing canonical file discovery, ignore checks, or degraded exclusion behavior.
- Do not use fallback behavior as evidence of complete Git-standard exclusion support.

## Conflicts and Supersession

- None.

## 中文摘要

- Git repository 以 Git CLI 作為唯一標準排除語義，支援巢狀、info 與全域排除來源。
- 已追蹤檔案即使命中 ignore 仍保留，特殊字元路徑以 NUL 與 literal 參數安全處理。
- Git 異常時降級到根 `.gitignore` 並回傳診斷，不中止掃描。

## Tracked Files

- src/gitignore-filter.ts
- src/tests/gitignore-filter.test.ts
- .gitignore

## Relations

- index-manager（authoritative reconciliation consumer）
- extension.watcher（event-time ignore consumer）
- desktop-console.monitoring（batch and event discovery consumer）
- mcp-tools.handlers（memory reindex consumer）

## Applicable Skills

- memory-ops — Use for governed updates and staleness repair of this card.
