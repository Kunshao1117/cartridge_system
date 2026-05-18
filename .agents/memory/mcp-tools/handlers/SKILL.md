---
name: mcp-tools.handlers
description: >
  專案記憶：底層 memory_* MCP handlers。Use when: 處理 mcp-handlers.ts、 底層
  memory_list/read/status/commit/deps 行為或 handler 測試時載入。
last_updated: '2026-05-18T16:37:50+08:00'
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
- src/tests/mcp-handlers.test.ts
- src/tests/memory-deps-output.test.ts

## Key Decisions

- D01: `mcp-handlers.ts` 保持 MCP SDK 解耦，輸出純函式 handler；`McpToolResult` 型別由 `mcp-response.ts` 持有，避免高階治理工具為型別依賴底層 handler。
- D02: `path-guard.ts` 已移至 `core-types` 記憶卡持有；handlers 僅消費 `validateProjectRoot`，並在各 handler 內保留 Zod schema 共同提供路徑安全雙層防禦。
- D03: handlers 消費 `core-types` 持有的 `timestamp.ts` 產生台灣時區 ISO timestamp，供記憶卡歸卡使用。
- D04: `memory_commit` 的 `confirm: true` 授權檢查同時存在於 dispatcher 與 handler schema；dispatcher 擋住 MCP 入口未授權呼叫，handler schema 則防止測試或內部直接呼叫繞過公開契約。
- D05: 本卡的 `dependencies` 只保留實際工程依賴 `index-manager` 與 `core-types`；父卡脈絡放在 Relations。
- D06: `memory_commit` 會整合 `index-manager.dep-engine` 所持有的 `dependency-semantics.ts` warning-only 檢查；因此 `index-manager.dep-engine` 過期時本卡也需重新檢查。此檢查回報 dependencies 缺少理由、父子導覽可疑、技能名稱混用與 Relations 鏡像可疑，但不阻斷歸卡。
- D07: `memory_commit` 同步 trackedFiles 後會從 `untrackedFiles` 移除已歸屬路徑，並重算全域 `indirectStaleness`，避免 workspace_brief 顯示舊索引狀態。
- D08: `memory_deps` 回傳採相容式分層輸出；新增 `summary`、`engineeringGraph`、`frontmatterGraph`、`staleness` 與 `findings`，同時保留 legacy `dependencies`、`dependents`、`indirectStaleness` 與 `cycles` 欄位。
- D09: `memory_deps` 正式套用 `mcp-response.ts` envelope；新版 AI 流程讀 `summary.graph`、`findings`、`recommendedActions`，舊版拓樸欄位集中收納於 `legacy`。
- D10: `stalenessToLevel` 已抽出至 `core-types` 所持有的 `staleness.ts`，供 handlers 與 workspace 摘要共用，避免高階摘要為了過期等級轉換 import 整個 `mcp-handlers.ts`。
- D11: `workspace_brief` 與 `commit_preflight` 測試已拆出 `mcp-handlers.test.ts`，分別由各自子卡追蹤，避免 handlers 記憶卡因測試 import 被推導出高階工具依賴。
- D12: `timestamp.ts` 已移至 `core-types` 記憶卡持有；handlers 僅消費 `getTaiwanISO`，避免 `index-manager` 與 `mcp-response` 因共用時間戳工具反向依賴 handlers。
- D13: MCP stdio E2E 與 Gateway 實測均需覆蓋 `memory_deps`；目前 `mcp-tools.handlers`、`mcp-tools.tool-registry`、`index-manager` 的 cycles 驗收值為 0。
- D14: `memory_list`、`memory_read`、`memory_status` 與 `memory_commit` 已收斂為 `mcp-response.ts` envelope；舊文字、原始狀態與歸卡報告放入 `legacy`，新版 AI 優先讀 `summary/findings/recommendedActions`。
- D15: `memory_commit` 的回歸測試必須同時覆蓋 trackedFiles、fileMap、untrackedFiles、ghostFiles、pendingChanges 與 staleness，避免歸卡同步只修一半導致 workspace_brief 或側邊欄殘留舊提醒。
- D16: `moduleNameSchema` 是底層 memory_* handlers 的共同輸入防線；允許英數、底線、連字號與點號分隔，拒絕 `/`、`\`、`..` 等路徑片段，避免 moduleName 被當成相對路徑穿越到其他 `.agents` 區域。

## Known Issues

- `mcp-handlers.ts` 同時承接多個底層 memory 工具，若後續單檔複雜度繼續升高，可再依工具族群拆分子卡。

## Module Lessons

- L01: 底層 handler 應保持可直接單元測試，互動式授權與工具風險判斷留在 dispatcher 層。
- L02: dependencies 語義檢查需留在 warning 層，避免工具層取代 `D:\AI_Rules` 的核心規範判斷。
- L03: 歸卡工具不能只更新 fileMap；同一路徑若仍留在 untrackedFiles，workspace_brief 會持續阻擋，必須在同一次同步中清理。
- L04: memory_deps 的工程依賴與 frontmatter dependencies 應分開呈現；舊欄位保留給既有呼叫者，新 AI 流程優先讀分層欄位。
- L05: frontmatterGraph 必須直接讀 SKILL.md frontmatter 原文；索引中的 dependencies 可能已合併工程自動推導結果，不能代表人工欄位語義。
- L06: `memory_deps` 是 Cartridge 自身 Memory Graph 報告入口；可參考 GitNexus 的圖譜思維，但不得依賴 GitNexus 才能回答記憶卡依賴、過期傳播與循環問題。
- L07: 共用小函式應放在窄檔案中；否則 workspace 摘要、dispatcher 或回傳契約會因 type-only 或 utility import 造成 Memory Graph 雜訊。
- L08: 測試檔同樣會被工程依賴掃描納入 Memory Graph；高階工具測試不可長期混在底層 handler 測試檔內。
- L09: 時間戳這類跨索引器、handler 與 response envelope 的小工具不應由 handlers 卡持有，否則會製造雙向依賴。
- L10: 驗證 MCP 工具可用性時，單元測試只能證明 handler 行為；必須另跑 MCP stdio 與 Gateway 入口，才可宣稱工具層實測通過。
- L11: 底層 memory_* 工具也要遵守同一份回傳契約；否則 AI 在讀 Gateway 結果時仍需為舊工具寫特殊解析邏輯。
- L12: `memory_commit` 清理的是磁碟 `.cartridge/index.json`；VS Code extension 的 RAM index 仍需 watcher 在 SKILL.md 變更事件中自行 scan/refilter/flush。
- L13: handler 測試若大量呼叫 `handleMemoryCommit`，可用測試 helper 預設補 `confirm:true`，並另保留一個 raw handler 測試覆蓋未確認呼叫會被拒絕。

## Relations

- mcp-tools（父卡：MCP 工具介面總覽）
- mcp-tools.dispatcher（消費：底層 handler 與 MCP 回傳型別）
- index-manager（依賴：索引解析與 trackedFiles 解析）
- core-types（依賴：共用型別與設定）
- index-manager.dep-engine（依賴：dependency-semantics warning-only 檢查器）

## Applicable Skills

- memory-ops
- security-sre
- test-patterns
