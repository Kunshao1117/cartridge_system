---
name: mcp-tools.handlers
description: >
  專案記憶：底層 memory_* MCP handlers 與共用驗證工具。Use when: 處理 mcp-handlers.ts、
  path-guard、timestamp 或底層 memory_list/read/status/commit/deps 行為時載入。
last_updated: '2026-05-14T16:01:16+08:00'
status: stable
staleness: 0
dependencies:
  - index-manager
  - core-types
  - index-manager.dep-engine
metadata:
  author: antigravity
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
    - 'filesystem:write'
---

# MCP Handlers — 底層工具邏輯記憶

> 本模組承接底層 `memory_*` 工具的商業邏輯、路徑驗證與時間戳工具，避免父卡 `mcp-tools` 同時承擔總覽與實作檔案持有者角色。

## Tracked Files

- src/mcp-handlers.ts
- src/path-guard.ts
- src/timestamp.ts
- src/tests/mcp-handlers.test.ts
- src/tests/path-guard.test.ts
- src/tests/timestamp.test.ts

## Key Decisions

- D01: `mcp-handlers.ts` 保持 MCP SDK 解耦，輸出純函式 handler 與 `McpToolResult` 型別，供 dispatcher 與高階 envelope 工具重用。
- D02: `path-guard.ts` 與 handler 內 Zod schema 共同提供路徑安全雙層防禦。
- D03: `timestamp.ts` 統一產生台灣時區 ISO timestamp，供記憶卡歸卡與治理 envelope metadata 使用。
- D04: `memory_commit` 的 `confirm: true` 授權檢查不放在 handler，而由 `mcp-tools.dispatcher` 在 server 入口層執行。
- D05: 本卡的 `dependencies` 只保留實際工程依賴 `index-manager` 與 `core-types`；父卡脈絡放在 Relations。
- D06: `memory_commit` 會整合 `index-manager.dep-engine` 所持有的 `dependency-semantics.ts` warning-only 檢查；因此 `index-manager.dep-engine` 過期時本卡也需重新檢查。此檢查回報 dependencies 缺少理由、父子導覽可疑、技能名稱混用與 Relations 鏡像可疑，但不阻斷歸卡。
- D07: `memory_commit` 同步 trackedFiles 後會從 `untrackedFiles` 移除已歸屬路徑，並重算全域 `indirectStaleness`，避免 workspace_brief 顯示舊索引狀態。

## Known Issues

- `mcp-handlers.ts` 同時承接多個底層 memory 工具，若後續單檔複雜度繼續升高，可再依工具族群拆分子卡。

## Module Lessons

- L01: 底層 handler 應保持可直接單元測試，互動式授權與工具風險判斷留在 dispatcher 層。
- L02: dependencies 語義檢查需留在 warning 層，避免工具層取代 `D:\AI_Rules` 的核心規範判斷。
- L03: 歸卡工具不能只更新 fileMap；同一路徑若仍留在 untrackedFiles，workspace_brief 會持續阻擋，必須在同一次同步中清理。

## Relations

- mcp-tools（父卡：MCP 工具介面總覽）
- mcp-tools.dispatcher（消費：底層 handler 與 McpToolResult 型別）
- index-manager（依賴：索引解析與 trackedFiles 解析）
- core-types（依賴：共用型別與設定）
- index-manager.dep-engine（依賴：dependency-semantics warning-only 檢查器）

## Applicable Skills

- memory-ops
- security-sre
- test-patterns
