---
name: commit-preflight
description: >
  專案記憶：commit_preflight 提交前治理檢查工具。Use when: 處理 git dirty state、記憶卡健康阻塞、
  提交前建議動作與收尾治理決策時載入。
last_updated: '2026-06-15T00:47:16+08:00'
status: stale
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
memory_quality_version: 1
memory_kind: implementation
verification_status: verified
last_verified: '2026-06-15T00:47:16+08:00'
valid_scope:
  - src/commit-preflight.ts
  - src/commit-preflight-summary.ts
  - src/tests/commit-preflight.test.ts
scopePath: null
---
# commit-preflight — Module Memory

## Current Truth

- This card is the schema v2 memory owner for mcp-tools.commit-preflight.
- Its implementation boundary is the tracked file list below.
- Legacy decisions, lessons, and repair notes were preserved in archive-001.md.
- Frontmatter dependencies are retained as staleness propagation dependencies and must not be used for navigation-only links.
- Directory nesting is navigation; parent-child placement is not a dependency by itself.
- Current behavior must still be verified against source before edits.
- `commit_preflight` ignores managed memory internals when computing memory_untracked_files blockers.
- Git dirty/untracked is still reported separately; only memory health untracked counts use visible filtering.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in description and Chinese summary.
- Use dependencies only for true staleness propagation; use Relations for navigation.
- Do not rewrite archive volumes during active-card standardization.
- Treat missing evidence as pending review, not as complete quality.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Kept schema v2 archive volumes out of memory_untracked_files so commit preflight only reports git_dirty for intended archive additions.
- 03: Consolidated memory untracked filtering through the shared visible-untracked helper.
- 04: Standardized active memory main file to MEMORY.md with quality metadata and evidence sections.
- 05: Standardized memory ownership and YAML valid_scope for the 5.5.1 governance repair.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## Evidence Base

- source:src/commit-preflight.ts
- source:src/commit-preflight-summary.ts
- source:src/tests/commit-preflight.test.ts

## Read Contract

- Read this card before editing commit-preflight tracked files or changing their ownership boundaries.
- Do not use this card for temporary task notes, design DNA, or unrelated platform rules.

## Conflicts and Supersession

- None recorded.

## 中文摘要

- mcp-tools.commit-preflight 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
- commit_preflight 不會把記憶歸檔卷當成記憶健康 blocker。
- Git dirty 仍照常回報；只是不再把 archive 卷誤判成 memory_untracked_files。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- src/commit-preflight.ts
- src/commit-preflight-summary.ts
- src/tests/commit-preflight.test.ts

## Relations

- mcp-tools（父卡：MCP 工具註冊、路由與工具契約）
- core-types（依賴：projectRoot 路徑驗證）
- mcp-tools.workspace-brief（前置入口：專案健康摘要）
- mcp-tools.tool-registry（共用：MCP 統一回傳 envelope）
- mcp-tools.memory-audit（依賴：compatibility warning 規則）
