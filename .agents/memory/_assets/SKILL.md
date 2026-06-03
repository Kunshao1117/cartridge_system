---
name: _assets
scopePath: null
description: |
  專案記憶：靜態檔案與一般文檔收納。 Use when: 處理不需要業務邏輯追蹤的靜態圖檔、授權文件或更新日誌等。
last_updated: '2026-06-04T06:35:24+08:00'
status: active
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
- desktop-assets/cartridge-desktop.ico

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
- L20: (2026-05-18) README.md 與 CHANGELOG.md 已同步 v5.2 npm MCP runtime 與 Gateway-first workspace：新增 `npx cartridge-system --workspace`、projectRoot 選填契約、npm dry-run 發布流程、npm manifest 正規化紀錄、22 個測試檔案 / 195 個測試案例。
- L21: (2026-05-19) README.md 與 CHANGELOG.md 已同步卡匣機櫃工作台：新增編輯區 WebviewPanel、Cytoscape bundle、`cartridge.openCabinetWorkbench` 入口、24 個測試檔案 / 199 個測試案例。
- L22: (2026-05-19) README.md 與 CHANGELOG.md 已將卡匣機櫃工作台收斂為 v5.3.0 發行版，安裝命令、tag 範例、版本 badge 與 CHANGELOG 標題皆同步至 `5.3.0`。
- L23: (2026-05-19) README.md 與 CHANGELOG.md 已同步 VSIX 打包腳本：`npm run package` 現在透過 `scripts/package-vsix.mjs` 使用 `package.json.files` 單一白名單並覆蓋同版本 VSIX。
- L24: (2026-05-19) README.md 與 CHANGELOG.md 已同步 v5.3.1 卡匣機櫃三艙位重設計、200 個測試案例、`cabinet-workbench-derive.ts` 架構樹與 `cartridge-system-5.3.1.vsix` 安裝命令。
- L25: (2026-05-19) README.md 與 CHANGELOG.md 已同步 v5.3.2 卡匣機櫃圖譜縮放/平移修復、25 個測試檔案、204 個測試案例、`cabinet-graph-viewport.ts` 架構樹與 `cartridge-system-5.3.2.vsix` 安裝命令。
- L26: (2026-05-19) README.md 與 CHANGELOG.md 已同步 v5.3.3 卡匣機櫃縮放控制與 `memory_graph` 工具、26 個測試檔案、212 個測試案例、`memory-graph.ts` 架構樹與 `cartridge-system-5.3.3.vsix` 安裝命令。
- L27: (2026-05-19) README.md 與 CHANGELOG.md 已同步 v5.3.4 插件更新檢查：啟動自動查 GitHub Release、手動命令、`cartridge.updateCheck.enabled` 設定、27 個測試檔案與 220 個測試案例、`cartridge-system-5.3.4.vsix` 安裝命令。
- L28: (2026-05-19) README.md 與 CHANGELOG.md 已同步 v5.3.5 插件更新檢查按鈕：治理總覽與記憶卡匣側邊欄標題列可直接手動檢查 GitHub Release，安裝命令與 tag 範例同步至 `cartridge-system-5.3.5.vsix`。
- L29: (2026-05-29) README.md 與 CHANGELOG.md 已同步專案脈絡層第一階段：新增四個 `project_context_*` 只讀 MCP 工具、十七工具總數、28 個測試檔案與 227 個測試案例，並補上 `.agents/context/` 與 `.agents/project_skills/` 版控白名單說明。
- L30: (2026-05-29) README.md 與 CHANGELOG.md 已同步 5.4.0 發布準備：版本 badge、VSIX 安裝命令、tag 範例、補發範例與 package 架構註記皆改為 5.4.0。
- L31: (2026-05-29) README.md 與 CHANGELOG.md 已同步發布流程分流：`vX.Y.Z` 保留給 VSIX 插件 release，npm MCP runtime 改用 `npm-vX.Y.Z` 或手動 workflow，避免同一 tag 同時觸發兩種產物。
- L32: (2026-06-02) README.md 與 CHANGELOG.md 已同步 v5.4.1 記憶警示分層：版本 badge、VSIX/npm tag 範例、測試數 232、`staleness.ts` 架構樹與 review/advisory 行為皆已更新。
- L33: (2026-06-02) CHANGELOG.md 已補入 v5.4.1 依賴安全修補紀錄：Vitest 4、`qs`、`tmp` 與 `@azure/msal-node` 更新後，完整與生產 `npm audit` 皆歸零。
- L34: (2026-06-03) README.md 與 CHANGELOG.md 已同步 Desktop Console 產品線：新增桌面監控台功能、桌面建構命令、桌面/VSIX/npm runtime 發布分流、桌面監控行為說明、桌面打包圖示、操作型控制台、分區滾輪與系統匣偏好設定，並同步 35 個測試檔案與 254 個測試案例；桌面專用 `.ico` 放在 `desktop-assets/`，避免進入 npm runtime 白名單。
- L35: (2026-06-03) Desktop Console 正式發布入口採 `desktop-vX.Y.Z`，README 與 CHANGELOG 已將第一版收斂為 `desktop-v5.4.1`；桌面 Release 不標記為 GitHub Latest，避免 VSIX 更新檢查誤讀桌面版；VSIX 仍用 `vX.Y.Z`，npm MCP runtime 仍用 `npm-vX.Y.Z`。
- L36: (2026-06-04) README.md 與 CHANGELOG.md 已同步 schema v2 記憶卡壓縮治理：memory_list、memory_commit、memory_audit、workspace_brief 與 commit_preflight 會揭露或使用 compaction metrics；31 筆 Cycle Events 會被阻擋，tracked files 超過 8 只作 split advisory；測試數更新為 36 檔案 / 276 案例。
- L37: (2026-06-04) README.md 與 CHANGELOG.md 已同步 Desktop Console 操作回饋與滾輪維修：新增狀態列/選取回饋、原生滾動容器與未歸屬列表不截斷測試紀錄；測試數更新為 36 檔案 / 279 案例。
- L38: (2026-06-04) README.md 與 CHANGELOG.md 已同步 5.4.2 發布：VSIX、Desktop Console 與 npm MCP runtime 各自使用 `v5.4.2`、`desktop-v5.4.2`、`npm-v5.4.2`，並保留桌面版獨立 release notes 段落。
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
