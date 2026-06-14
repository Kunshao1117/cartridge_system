---
name: desktop-console.app
description: >
  專案記憶：Electron 桌面外殼、IPC、系統匣、通知與專案清單設定。Use when: 修改桌面主程序、 預載橋接、AppData
  專案設定、桌面通知或桌面打包設定時載入。
last_updated: '2026-06-04T07:14:50+08:00'
status: stale
staleness: 10
dependencies:
  - desktop-console.monitoring
  - _system
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 1
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
---
<!-- CARTRIDGE_SYSTEM_WARNING_START -->

> [!CAUTION]
> 🟠 **系統強制攔截**：此記憶已過期失真！
> 追蹤檔案異動：`src/tests/desktop-notifier.test.ts`（2026-06-14T23:07:24+08:00）
> AI 嚴禁基於此記憶施工，必須優先閱讀最新原始碼並更新此記憶卡。
> staleness: 10 | threshold: 🟠 顯著過期

<!-- CARTRIDGE_SYSTEM_WARNING_END -->

# desktop console / app — Module Memory

## Current Truth

- This card is the schema v2 memory owner for desktop-console.app.
- Its implementation boundary is the tracked file list below.
- Legacy decisions, lessons, and repair notes were preserved in archive-001.md.
- Frontmatter dependencies are retained as staleness propagation dependencies and must not be used for navigation-only links.
- Directory nesting is navigation; parent-child placement is not a dependency by itself.
- Current behavior must still be verified against source before edits.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in the description and Chinese summary.
- Add at most one Cycle Events item per update and compact before event 31.
- Do not restore legacy Key Decisions or Module Lessons into the main card body.
- The tracked file count is a split advisory only; split when hard limits, mixed ownership, or maintenance difficulty appear.

## Known Issues

- None active. Dependency rationale: desktop-console.monitoring, _system are upstream dependencies; upstream staleness must trigger review for this card.


## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## 中文摘要

- desktop-console.app 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 追蹤檔案數偏高屬拆分建議，不單獨阻擋提交。
- 後續修改此卡時應先讀最新原始碼。

## Tracked Files

- src/desktop/main.ts
- src/desktop/preload.ts
- src/desktop/ipc-channels.ts
- src/desktop/path-guard.ts
- src/desktop/window-behavior.ts
- src/desktop/project-store.ts
- src/desktop/desktop-notifier.ts
- src/tests/desktop-store.test.ts
- src/tests/desktop-path-guard.test.ts
- src/tests/desktop-window-behavior.test.ts
- src/tests/desktop-notifier.test.ts
- tsup.desktop.config.ts
- electron-builder.desktop.yml

## Relations

- desktop-console（parent card）
- desktop-console.monitoring（上游：多專案監控 runtime）
- desktop-console.renderer（下游：IPC 消費者）
- _system（建構與 dependency 設定）

## Applicable Skills

- security-sre
- plugin-release-governance
