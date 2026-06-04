# mcp-tools.commit-preflight Legacy Archive Volume 001

Migrated: 2026-06-04T07:15:00+08:00
Archive policy: schema v2 lazy upgrade preserved the original legacy SKILL.md content verbatim for trace-back.

## Original Legacy Content

---
name: commit-preflight
description: >
  專案記憶：commit_preflight 提交前治理檢查工具。Use when: 處理 git dirty state、記憶卡健康阻塞、
  提交前建議動作與收尾治理決策時載入。
last_updated: '2026-06-04T06:35:24+08:00'
status: active
staleness: 0
dependencies:
  - core-types
  - mcp-tools.tool-registry
  - mcp-tools.memory-audit
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
- src/tests/commit-preflight.test.ts

## Key Decisions

- D01: `commit_preflight` 採用低副作用設計，只讀 `.cartridge/index.json` 並執行 `git status --porcelain=v1`，不自動測試、不自動 commit、不自動修改記憶卡。
- D02: Handler 與摘要 builder 分離：`commit-preflight.ts` 負責參數驗證、路徑安全、讀取索引與 git status；`commit-preflight-summary.ts` 負責 memory blockers、git dirty summary、recommendedActions 與 suggestedCommands。
- D03: readiness 使用分層阻擋模型；直接 stale、ghost、untracked、compatibility blocker 或 git dirty state 才回傳 `blocked`，單純 indirect stale / 上游影響 / 父子卡衍生提示只回 `warning`。
- D04: git 狀態解析使用 `git status --porcelain=v1`，避免依賴人類可讀輸出格式；handler 使用 `execFile` 固定參數呼叫，避免 shell 字串組合。
- D05: Handler 回傳改用 `mcp-response.ts` envelope，外層 status 與 preflight status 同步，原本 preflight 內容保留在 `summary` 欄位。
- D06: blockers 會轉成 error findings；review warnings 會轉成 warning findings，讓 AI 或未來 UI 可直接區分提交前阻擋原因與非阻塞複審提醒。
- D07: 父卡 `mcp-tools` 改為 Relations 導覽，不再寫入 `dependencies`；本卡僅依賴 `mcp-tools.tool-registry` 提供的 envelope 契約。
- D08: `commit_preflight` 會針對 git dirty 相關記憶卡執行 best-effort dependency semantics 摘要，將可疑 dependencies 轉為 warning findings；此檢查不改變 blocked/ready 判斷。
- D09: `commit_preflight` 摘要新增 `readiness` 區塊，將 blocking reasons 與 warning reasons 分層，讓 AI 不需自行從 blockers 與 dependency semantics 摘要重組提交狀態。
- D10: `commit-preflight.ts` 的 `McpToolResult` 型別來源改為 `mcp-response.ts`，避免提交前工具因型別依賴底層 handlers。
- D11: `core-types` 是 `commit-preflight.ts` 的路徑驗證上游 dependency；若 `core-types` 的 `path-guard.ts` 過期，提交前工具的 projectRoot 防線也必須重新檢查。
- D12: `commit_preflight` 測試已從 `mcp-handlers.test.ts` 拆至 `commit-preflight.test.ts`，避免底層 handlers 記憶卡因測試 import 被推導依賴本高階工具。
- D13: MCP stdio E2E 與 Gateway 實測都必須確認 dependency semantics warnings 為 0；若 blocked 只來自 git dirty state，表示工具層可用但尚未封存。
- D14: `commit_preflight` 新增 compatibility gate；缺索引或舊索引欄位會以 `memory_compatibility` blocker 阻擋封存，並建議先跑 `memory_audit`，避免在記憶判讀不完整時提交。
- D15: `commit_preflight` 實際依賴 `mcp-tools.memory-audit` 持有的 `memory-compatibility.ts`；若 compatibility warning 規則過期，提交前 compatibility blocker 也必須重新檢查。
- D16: v5.4.1 `commit_preflight` memory gate 新增 additive `memoryWarnings`、`reviewItems` 與 `advisories`；`memory_indirect_stale` 不再是 blocker，但仍保留原始 indirect 欄位供舊解析器讀取。
- D17: v5.5 `commit_preflight` 會把 compaction due / invalid 與 archive volume due 視為 blocker，並在摘要中揭露 compaction modules、legacy cards、language warnings、splitSuggestions 與 granularityAdvisories；提交前必須先彙整滿額或過大的主卡，但 tracked files 超過 8 且大小/行數健康時只作 advisory，不會取代 git dirty 或記憶健康 blocker。

## Known Issues

- 第一版不執行 vitest、tsc、eslint、build 或 GitNexus detect_changes；這些只列為 suggestedCommands，避免 MCP 查詢型工具隱性變慢。

## Module Lessons

- L01: 提交前治理工具應先回答「是否可提交與被什麼擋住」，驗證命令可以列為下一步，不應在第一版查詢工具中隱性執行。
- L02: `Relations` 可描述 workspace_brief 前置入口與父卡脈絡，但不應被用於依賴傳播。
- L03: dependency semantics 屬提交前輔助訊號，應只掃 dirty 相關卡片並保持 warning-only，避免 preflight 變成昂貴全專案語義審計。
- L04: dependency semantics 摘要必須讀取 dirty 卡片的 SKILL.md frontmatter；不可使用索引中的 dependencies，因其可能混入工程自動推導依賴。
- L05: 提交總閘門需要同時保留原始 blockers 與整理後 readiness；前者方便精準除錯，後者方便 AI 做下一步決策。
- L06: 高階提交工具的回傳型別應依賴 envelope 契約，不應為型別從底層 handler 匯入。
- L07: projectRoot 驗證是跨 MCP 工具共用防線，應由 core-types 層持有，避免高階工具為路徑驗證依賴 handlers。
- L08: 提交前工具測試應與功能記憶卡一起維護；測試檔混放在 handlers 卡會製造假的高階依賴。
- L09: commit_preflight 的 blocked 不等於工具錯誤；封存前需分辨 dirty files、memory blockers、dependency semantics warnings 三種原因。
- L10: 提交前工具可以因 compatibility mode 阻擋封存，但不應自行執行完整掃描或自動修復；深度診斷交給 `memory_audit`。
- L11: 提交前封存不可把上游影響或父子卡閱讀提示等同直接失真；warning readiness 可要求複審，但 blockingReasons 不應包含 indirectStaleness。
- L12: `commit_preflight` 在記憶健康但 git dirty 時，只應回報 dirtyFiles blocker；split suggestion 必須留在 advisory，避免把可維護性建議誤判為提交阻擋。

## Relations

- mcp-tools（父卡：MCP 工具註冊、路由與工具契約）
- core-types（依賴：projectRoot 路徑驗證）
- mcp-tools.workspace-brief（前置入口：專案健康摘要）
- mcp-tools.tool-registry（共用：MCP 統一回傳 envelope）
- mcp-tools.memory-audit（依賴：compatibility warning 規則）

## Applicable Skills

- memory-ops
- security-sre
- test-patterns
