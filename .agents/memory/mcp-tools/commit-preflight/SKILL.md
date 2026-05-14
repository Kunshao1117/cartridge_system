---
name: commit-preflight
description: >
  專案記憶：commit_preflight 提交前治理檢查工具。Use when: 處理 git dirty state、記憶卡健康阻塞、
  提交前建議動作與收尾治理決策時載入。
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
# Commit Preflight — 提交前治理檢查記憶

> 本模組提供 `commit_preflight` MCP 工具的提交前決策邏輯，作為 `workspace_brief` 之後的收尾治理入口。

## Tracked Files

- src/commit-preflight.ts
- src/commit-preflight-summary.ts

## Key Decisions

- D01: `commit_preflight` 採用低副作用設計，只讀 `.cartridge/index.json` 並執行 `git status --porcelain=v1`，不自動測試、不自動 commit、不自動修改記憶卡。
- D02: Handler 與摘要 builder 分離：`commit-preflight.ts` 負責參數驗證、路徑安全、讀取索引與 git status；`commit-preflight-summary.ts` 負責 memory blockers、git dirty summary、recommendedActions 與 suggestedCommands。
- D03: readiness 使用保守阻擋模型；只要存在記憶卡 stale/ghost/untracked/indirect stale 或 git dirty state，即回傳 `blocked`。
- D04: git 狀態解析使用 `git status --porcelain=v1`，避免依賴人類可讀輸出格式；handler 使用 `execFile` 固定參數呼叫，避免 shell 字串組合。
- D05: Handler 回傳改用 `mcp-response.ts` envelope，外層 status 與 preflight status 同步，原本 preflight 內容保留在 `summary` 欄位。
- D06: blockers 會轉成 error findings，讓 AI 或未來 UI 可直接顯示提交前阻擋原因。

## Known Issues

- 第一版不執行 vitest、tsc、eslint、build 或 GitNexus detect_changes；這些只列為 suggestedCommands，避免 MCP 查詢型工具隱性變慢。

## Module Lessons

- L01: 提交前治理工具應先回答「是否可提交與被什麼擋住」，驗證命令可以列為下一步，不應在第一版查詢工具中隱性執行。

## Relations

- mcp-tools（父卡：MCP 工具註冊、路由與工具契約）
- mcp-tools.workspace-brief（前置入口：專案健康摘要）
- mcp-tools.tool-registry（共用：MCP 統一回傳 envelope）

## Applicable Skills

- memory-ops
- security-sre
- test-patterns
