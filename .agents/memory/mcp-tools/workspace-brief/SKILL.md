---
name: workspace-brief
description: >
  專案記憶：workspace_brief 高階治理摘要工具。Use when: 處理 AI 開工摘要、記憶卡健康彙整、readiness
  判斷與建議行動排序時載入。
last_updated: '2026-05-14T14:38:41+08:00'
status: stable
staleness: 0
dependencies:
  - mcp-tools
  - mcp-tools.tool-registry
metadata:
  author: antigravity
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
    - 'filesystem:write'
---
# Workspace Brief — 高階治理摘要記憶

> 本模組提供 `workspace_brief` MCP 工具的摘要彙整邏輯，作為 AI 進入專案時的高階開工入口。

## Tracked Files

- src/workspace-brief.ts
- src/workspace-brief-summary.ts

## Key Decisions

- D01: `workspace_brief` 採用純檔案讀取設計，只讀 `package.json` 與 `.cartridge/index.json`，不隱性執行 git、npm audit、GitNexus 或索引重建，確保 MCP 呼叫快速且副作用為零。
- D02: Handler 與摘要 builder 分離：`workspace-brief.ts` 負責參數驗證、路徑安全與 I/O；`workspace-brief-summary.ts` 負責記憶卡統計、readiness 判斷與 recommendedActions 排序。
- D03: readiness 使用保守阻擋模型；只要存在 stale、ghost、untracked 或 indirect stale，即回傳 `blocked` 並列出具體 reasons。
- D04: recommendedActions 以 P1/P2 排序，優先處理 significant stale、ghost files 與 untracked files，讓 AI 能直接判斷下一步。
- D05: Handler 回傳改用 `mcp-response.ts` envelope，外層提供 status、summary、findings、recommendedActions 與 metadata；原本的 brief 內容保留在 `summary` 欄位。
- D06: readiness reasons 會轉成 warning findings，讓 AI 或未來 UI 可直接顯示具體阻擋原因。

## Known Issues

- 第一版不讀取 git dirty state、npm audit 或 GitNexus 狀態；這些能力預留給後續 `commit_preflight` 或 `project_health_summary` 工具。

## Module Lessons

- L01: 高階 MCP 工具應避免在查詢型摘要中執行隱性掃描或外部命令，否則會讓 AI 開工入口變慢且難以預測。
- L02: 超過 8 檔粒度上限時，應優先建立子卡承接新功能，而不是把父卡繼續擴大。

## Relations

- mcp-tools（父卡：MCP 工具註冊、路由與工具契約）
- mcp-tools.tool-registry（共用：MCP 統一回傳 envelope）

## Applicable Skills

- memory-ops
- memory-arch
- security-sre
- test-patterns
