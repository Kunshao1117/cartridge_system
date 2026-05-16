---
name: workspace-brief
description: >
  專案記憶：workspace_brief 高階治理摘要工具。Use when: 處理 AI 開工摘要、記憶卡健康彙整、readiness
  判斷與建議行動排序時載入。
last_updated: '2026-05-15T15:42:06+08:00'
status: stable
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
# Workspace Brief — 高階治理摘要記憶

> 本模組提供 `workspace_brief` MCP 工具的摘要彙整邏輯，作為 AI 進入專案時的高階開工入口。

## Tracked Files

- src/workspace-brief.ts
- src/workspace-brief-summary.ts
- src/tests/workspace-brief.test.ts

## Key Decisions

- D01: `workspace_brief` 採用純檔案讀取設計，只讀 `package.json` 與 `.cartridge/index.json`，不隱性執行 git、npm audit、GitNexus 或索引重建，確保 MCP 呼叫快速且副作用為零。
- D02: Handler 與摘要 builder 分離：`workspace-brief.ts` 負責參數驗證、路徑安全與 I/O；`workspace-brief-summary.ts` 負責記憶卡統計、readiness 判斷與 recommendedActions 排序。
- D03: readiness 使用保守阻擋模型；只要存在 stale、ghost、untracked 或 indirect stale，即回傳 `blocked` 並列出具體 reasons。
- D04: recommendedActions 以 P1/P2 排序，優先處理 significant stale、ghost files 與 untracked files，讓 AI 能直接判斷下一步。
- D05: Handler 回傳改用 `mcp-response.ts` envelope，外層提供 status、summary、findings、recommendedActions 與 metadata；原本的 brief 內容保留在 `summary` 欄位。
- D06: readiness reasons 會轉成 warning findings，讓 AI 或未來 UI 可直接顯示具體阻擋原因。
- D07: 父卡 `mcp-tools` 改為 Relations 導覽，不再寫入 `dependencies`；本卡僅依賴 `mcp-tools.tool-registry` 提供的 envelope 契約。
- D08: `workspace_brief` 會在 memory summary 中揭露 dependencies 總邊數；語義可疑判斷留給能讀完整 SKILL.md 內文的 `memory_commit`，避免 index-only 摘要誤報合法父子工程依賴。
- D09: `workspace_brief` 新增 `submitReadiness`；記憶健康阻擋時回 `blocked`，記憶健康乾淨時回 `needs_review` 並指向 `commit_preflight`，避免在未讀 git state 時宣稱可提交。
- D10: `submitReadiness` 補充單一 `reason` 與 `nextAction`，讓 AI 可直接判讀提交前下一步，同時保留 `reasons` 與 `nextTool` 相容既有輸出。
- D11: `workspace-brief-summary.ts` 改由 `staleness.ts` 取得過期等級轉換，不再為了 `stalenessToLevel` import `mcp-handlers.ts`。
- D12: `core-types` 是 `workspace-brief.ts` 與 `workspace-brief-summary.ts` 的路徑驗證與 staleness 等級轉換上游 dependency；若 `core-types` 的 `path-guard.ts` 或 `staleness.ts` 過期，workspace 摘要也必須重新檢查。
- D13: `workspace_brief` 測試已從 `mcp-handlers.test.ts` 拆至 `workspace-brief.test.ts`，避免底層 handlers 記憶卡因測試 import 被推導依賴本高階工具。
- D14: MCP stdio E2E 與 Gateway 實測都必須確認 `workspace_brief` 記憶健康為 ready，且 stale、ghost、untracked、oversized 皆為 0。
- D15: `workspace_brief` 新增輕量 compatibility summary；缺索引或舊索引欄位時回 `warning` 並建議 `run_memory_audit`，但不讀取所有 SKILL.md、不執行完整健檢。
- D16: `workspace_brief` 實際依賴 `mcp-tools.memory-audit` 持有的 `memory-compatibility.ts`；若 compatibility warning 規則過期，workspace 摘要的日常導入提醒也必須重新檢查。

## Known Issues

- 第一版不讀取 git dirty state、npm audit 或 GitNexus 狀態；這些能力預留給後續 `commit_preflight` 或 `project_health_summary` 工具。

## Module Lessons

- L01: 高階 MCP 工具應避免在查詢型摘要中執行隱性掃描或外部命令，否則會讓 AI 開工入口變慢且難以預測。
- L02: 超過 8 檔粒度上限時，應優先建立子卡承接新功能，而不是把父卡繼續擴大。
- L03: `Relations` 可提示 AI 讀父卡取得脈絡，但不應觸發 staleness propagation。
- L04: workspace 摘要只做 index 層可見的輕量拓樸提示，不讀取所有 SKILL.md，避免開工入口變慢，也避免在缺少依賴理由內文時誤判。
- L05: workspace_brief 可提示提交前下一步，但不應取代 commit_preflight；只要沒有讀取 git state，就只能給 needs_review 而非 ready-to-submit。
- L06: readiness 給記憶健康狀態，submitReadiness 給提交前流程狀態；兩者不可混用，避免 AI 把「記憶乾淨」誤解成「可直接提交」。
- L07: 高階摘要工具只應依賴窄型共用工具與 envelope 契約；避免直接依賴底層 handler 大檔，降低 Memory Graph 循環雜訊。
- L08: 高階工具的 handler 測試應由對應子卡持有；測試檔 import 也會影響 Memory Graph 的工程依賴推導。
- L09: workspace_brief 不讀 git state；它可以回報記憶健康 ready，但提交是否可封存仍以 commit_preflight 為準。
- L10: 日常開工入口只應提示「需要深度健檢」，完整舊格式導入診斷由 `memory_audit` 承擔，避免 workspace_brief 變慢或變成大雜燴。

## Relations

- mcp-tools（父卡：MCP 工具註冊、路由與工具契約）
- core-types（依賴：路徑驗證與 staleness 等級轉換）
- mcp-tools.tool-registry（共用：MCP 統一回傳 envelope）
- mcp-tools.memory-audit（依賴：compatibility warning 規則）

## Applicable Skills

- memory-ops
- memory-arch
- security-sre
- test-patterns
