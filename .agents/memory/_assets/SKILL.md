---
name: _assets
scopePath: null
description: |
  專案記憶：靜態檔案與一般文檔收納。 Use when: 處理不需要業務邏輯追蹤的靜態圖檔、授權文件或更新日誌等。
last_updated: '2026-05-18T16:38:49+08:00'
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
- assets/cartridge-activity.svg

## Key Decisions

- D01: 集中收容靜態與文檔檔案，賦予底線名稱以享有過期放寬特權。

## Known Issues

- 無

## Module Lessons

- L01: (2026-05-06) `test.ts` 曾作為幽靈偵測功能的測試暫存檔歸入此卡，刪除後觸發幽靈標記，驗證了 v4.0 幽靈引擎的偵測能力。已從追蹤清單與決策中移除。
- L02: (2026-05-14) README.md 與 CHANGELOG.md 已同步 v4.1.1 文件狀態；此卡屬靜態收容卡，文檔異動確認後可用 memory_commit 快速核銷。
- L03: (2026-05-17) README.md 與 CHANGELOG.md 已同步 v5.0.0：十二個 MCP 工具、21 個測試檔案、174 個測試案例、上下文治理 OS 架構、獨立 Activity Bar 側邊欄與未歸屬自動清除行為。
- L17: (2026-05-17) README.md 與 CHANGELOG.md 已同步 v5.1.0：AI 開工檢查、規則檔檢查白話化、側邊欄提醒可讀性、MCP 工具安全說明、21 個測試檔案與 175 個測試案例。
- L18: (2026-05-18) README.md 新增 GitHub Releases 下載入口、tag 自動發版與 Actions 手動補發說明；CHANGELOG.md 新增 Unreleased 的 VSIX 自動發版紀錄。
- L19: (2026-05-18) README.md 與 CHANGELOG.md 已同步穩定性強化：npm audit 歸零、Windows `ComSpec` 修復、moduleName 路徑片段防線、memory_audit 索引漂移偵測、Gateway 未註冊限制，以及 21 個測試檔案 / 181 個測試案例。
- L03: (2026-05-14) README 已補齊 `workspace_brief` 與 `commit_preflight` 高階 MCP 工具說明，並同步測試數 123 passed 與架構樹新檔案。
- L04: (2026-05-14) CHANGELOG 已新增 2026-05-14 治理工具、依賴衰減、MCP 版本同步與 GitNexus CLI 修復紀錄。
- L05: (2026-05-14) README 已同步 MCP 工具名冊、統一治理回傳 envelope、測試數 128 passed 與新架構檔案。
- L06: (2026-05-14) CHANGELOG 已補充 MCP 工具名冊、治理回傳契約與 128 測試案例紀錄。
- L07: (2026-05-14) README 已同步 MCP dispatcher、`memory_commit confirm: true` 防線、測試數 133 passed 與 dispatcher 架構樹。
- L08: (2026-05-14) README 已同步 dependencies 語義警告、測試數 141 passed、dependency-semantics 架構檔、workspace_brief 依賴健康摘要，以及 memory_commit 未歸屬池清理與間接過期重算行為。
- L09: (2026-05-14) CHANGELOG 已同步 MCP 工具防線、記憶依賴語義警告與 141 測試案例紀錄。
- L10: (2026-05-14) README 已同步 MCP 分層摘要、workspace submitReadiness、commit_preflight dependency semantics 摘要與測試數 143 passed。
- L11: (2026-05-14) CHANGELOG 已補充 MCP 操作摘要強化，涵蓋 memory_deps 分層、workspace submitReadiness 與 commit_preflight dependency semantics 摘要。
- L12: (2026-05-14) README 與 CHANGELOG 已同步 MCP 標準 envelope 的 `legacy` 相容欄位，以及 memory_deps 採標準報告格式的說明。
- L13: (2026-05-14) README 與 CHANGELOG 已同步 MCP 依賴圖瘦身，包含 path guard / timestamp / staleness 共用工具、Memory Graph 分層與測試數 149 passed。
- L14: (2026-05-15) README 已新增 MCP 驗證層級，明確區分終端單元測試、MCP stdio 協議 E2E 與 multi-mcp-gateway 真實工具入口；CHANGELOG 已同步 MCP 雙重驗證紀錄，確認七個工具可由協議層與 Gateway 正常列出並呼叫。
- L15: (2026-05-15) README 與 CHANGELOG 已同步 MCP 介面收斂，明確七個工具皆採 envelope，測試數提升至 154 passed。
- L16: (2026-05-16) README 與 CHANGELOG 已同步 memory_audit cycle 來源分層、analyzer/writer 工程循環解除與測試數 161 passed。
- L16: (2026-05-15) README 與 CHANGELOG 已同步雙層記憶卡預防架構，新增第八個工具 `memory_audit`，測試數提升至 159 passed。

## Relations

- 無

## Applicable Skills

- memory-ops
