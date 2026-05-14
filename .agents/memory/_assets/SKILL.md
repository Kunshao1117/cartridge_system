---
name: _assets
scopePath: null
description: |
  專案記憶：靜態檔案與一般文檔收納。 Use when: 處理不需要業務邏輯追蹤的靜態圖檔、授權文件或更新日誌等。
last_updated: '2026-05-14T21:14:49+08:00'
status: stable
staleness: 0
metadata:
  author: antigravity
  version: '1.2'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
---

# Assets — 靜態收容

## Tracked Files

- README.md
- CHANGELOG.md
- LICENSE
- assets/logo.png

## Key Decisions

- D01: 集中收容靜態與文檔檔案，賦予底線名稱以享有過期放寬特權。

## Known Issues

- 無

## Module Lessons

- L01: (2026-05-06) `test.ts` 曾作為幽靈偵測功能的測試暫存檔歸入此卡，刪除後觸發幽靈標記，驗證了 v4.0 幽靈引擎的偵測能力。已從追蹤清單與決策中移除。
- L02: (2026-05-14) README.md 與 CHANGELOG.md 已同步 v4.1.1 文件狀態；此卡屬靜態收容卡，文檔異動確認後可用 memory_commit 快速核銷。
- L03: (2026-05-14) README 已補齊 `workspace_brief` 與 `commit_preflight` 高階 MCP 工具說明，並同步測試數 123 passed 與架構樹新檔案。
- L04: (2026-05-14) CHANGELOG 已新增 2026-05-14 治理工具、依賴衰減、MCP 版本同步與 GitNexus CLI 修復紀錄。
- L05: (2026-05-14) README 已同步 MCP 工具名冊、統一治理回傳 envelope、測試數 128 passed 與新架構檔案。
- L06: (2026-05-14) CHANGELOG 已補充 MCP 工具名冊、治理回傳契約與 128 測試案例紀錄。
- L07: (2026-05-14) README 已同步 MCP dispatcher、`memory_commit confirm: true` 防線、測試數 133 passed 與 dispatcher 架構樹。
- L08: (2026-05-14) README 已同步 dependencies 語義警告、測試數 141 passed、dependency-semantics 架構檔、workspace_brief 依賴健康摘要，以及 memory_commit 未歸屬池清理與間接過期重算行為。
- L09: (2026-05-14) CHANGELOG 已同步 MCP 工具防線、記憶依賴語義警告與 141 測試案例紀錄。

## Relations

- 無

## Applicable Skills

- memory-ops
