---
name: mcp-tools
description: |
  專案記憶：MCP 工具介面模組（第三階段）。 Use when: 處理MCP伺服器註冊、工具路由、AI工具呼叫介面時載入。
last_updated: '2026-06-04T07:17:33+08:00'
status: stable
staleness: 0
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
  version: '4.1'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
    - 'filesystem:write'
---


# mcp tools — Module Memory

## Current Truth

- This card is the schema v2 memory owner for mcp-tools.
- This card is a navigation or parent overview card and does not directly own implementation files.
- Legacy decisions, lessons, and repair notes were preserved in archive-001.md.
- No staleness propagation dependency is recorded in frontmatter.
- This is a root-level memory card unless Relations says otherwise.
- Current behavior must still be verified through child cards and source before edits.

## Active Constraints

- Keep the main card under 16 KB and 120 lines; move history into archive volumes.
- Keep the technical body in English; use Traditional Chinese only in the description and Chinese summary.
- Add at most one Cycle Events item per update and compact before event 31.
- Do not restore legacy Key Decisions or Module Lessons into the main card body.
- Keep Tracked Files focused on files this card can actually explain.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## 中文摘要

- mcp-tools 已升級為 schema v2 主卡。
- 舊版決策與課題已完整保存到 archive-001.md。
- 主卡只保留目前有效真相、限制、週期事件與追蹤檔案。
- 目前沒有硬性拆分阻擋。
- 此卡是父層或導航卡，實作細節請讀子卡。

## Tracked Files

- （父層總覽，不直接追蹤實作檔案）

## Relations

- extension（父卡：啟動外掛編排）
- index-manager（共用服務：索引讀寫）
- mcp-tools.server（子卡：MCP SDK server 入口與工具公開清單）
- mcp-tools.handlers（子卡：底層 memory_* handler 與路徑/時間戳共用邏輯）
- mcp-tools.workspace-brief（子卡：workspace_brief 高階治理摘要）
- mcp-tools.commit-preflight（子卡：commit_preflight 提交前治理檢查）
- mcp-tools.memory-audit（子卡：memory_audit 完整健檢與 compatibility 規則）
- mcp-tools.context-governance（子卡：v5 規則檔檢查工具）
- mcp-tools.memory-graph（子卡：AI 可讀整體記憶圖譜工具）
- mcp-tools.project-context（子卡：專案脈絡層只讀 MCP 工具）
- mcp-tools.tool-registry（子卡：MCP 工具名冊與統一回傳契約）
- mcp-tools.dispatcher（子卡：MCP 工具分派與 high-risk tool guardrail）

## Applicable Skills

- security-sre
- test-patterns
