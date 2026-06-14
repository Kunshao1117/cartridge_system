---
name: _system
description: |
  專案記憶：系統技術堆疊與部署設定。 Use when: 確認技術選型、環境設定、部署組態時載入。
last_updated: '2026-06-04T08:20:00+08:00'
status: stale
staleness: 20
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 2
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
---
<!-- CARTRIDGE_SYSTEM_WARNING_START -->

> [!CAUTION]
> 🟠 **系統強制攔截**：此記憶已過期失真！
> 追蹤檔案異動：`package.json`、`package-lock.json`（2026-06-14T23:07:24+08:00）
> AI 嚴禁基於此記憶施工，必須優先閱讀最新原始碼並更新此記憶卡。
> staleness: 20 | threshold: 🟠 顯著過期

<!-- CARTRIDGE_SYSTEM_WARNING_END -->

# _system — Module Memory

## Current Truth

- This card is the schema v2 memory owner for _system.
- Its implementation boundary is the tracked file list below.
- Legacy decisions, lessons, and repair notes were preserved in archive-001.md, archive-002.md.
- No staleness propagation dependency is recorded in frontmatter.
- This is a root-level memory card unless Relations says otherwise.
- Current behavior must still be verified against source before edits.
- Package and MCP runtime version are synchronized to 5.4.3 for the archive-untracked repair release.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in the description and Chinese summary.
- Add at most one Cycle Events item per update and compact before event 31.
- Do not restore legacy Key Decisions or Module Lessons into the main card body.
- The tracked file count is a split advisory only; split when hard limits, mixed ownership, or maintenance difficulty appear.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Synchronized package, lockfile, MCP runtime version, and split release target to 5.4.3.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.
- archive-002.md — Legacy card content before schema v2 migration on 2026-06-04.

## 中文摘要

- _system 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md、archive-002.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 追蹤檔案數偏高屬拆分建議，不單獨阻擋提交。
- 套件、鎖定檔與 MCP runtime 對外版本已同步至 5.4.3。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- package.json
- tsconfig.json
- tsup.config.ts
- tsup.desktop.config.ts
- desktop.vite.config.ts
- electron-builder.desktop.yml
- eslint.config.js
- vitest.config.ts
- package-lock.json
- .github/workflows/release.yml
- .github/workflows/npm-publish.yml
- .github/workflows/desktop-release.yml

## Relations

None.

## Applicable Skills

- tech-stack-protocol
