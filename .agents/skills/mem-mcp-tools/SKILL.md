---
name: mem-mcp-tools
description: >
  專案記憶：MCP 工具介面模組（第二階段）。
  Use when: 處理MCP伺服器註冊、工具路由、AI工具呼叫介面時載入。
last_updated: "2026-03-28T07:29:00+08:00"
status: active
staleness: 0
---

# MCP Tool Interface — 工具介面記憶（第二階段）

> 本模組目前進入第二階段實作規劃，提供標準化 AI 呼叫工具。

## Tracked Files
- `src/mcp-server.ts`
- `package.json` (MCP dependencies)

## Key Decisions
- D01: 獨立出 `mcp-server.ts` 作為標準 stdio Server 入口，與 VS Code Extension 解耦，雙核心透過實體檔案系統互動。
- D02: 首發提供 3 個核心工具：`memory_list`, `memory_read`, `memory_update`，取代直接檔案寫入。

## Known Issues
- 無

## Module Lessons
- 無

## Relations
- mem-index-manager（查詢卡匣資料）
- mem-analyzer（查詢過期狀態）
- mem-watcher（控制監聽生命週期）
