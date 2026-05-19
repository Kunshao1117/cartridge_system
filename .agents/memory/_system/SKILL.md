---
name: _system
description: |
  專案記憶：系統技術堆疊與部署設定。 Use when: 確認技術選型、環境設定、部署組態時載入。
last_updated: '2026-05-19T20:29:22+08:00'
status: stable
staleness: 0
metadata:
  author: antigravity
  version: '4.1'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
---

# System — 系統記憶

## Tracked Files

- package.json
- tsconfig.json
- tsup.config.ts
- eslint.config.js
- vitest.config.ts
- package-lock.json
- .github/workflows/release.yml

## Runtime & Host

- OS: Windows 11 家用版 (10.0.26200, 64-bit)
- Node.js: v22.13.1
- npm: 10.9.2

## Tech Stack

- Language: TypeScript 5.x
- Framework: **VS Code Extension API**
- File Watcher: **VS Code 原生 FileSystemWatcher**（v2.0 棄用 chokidar）
- YAML Parser: `gray-matter`
- Build: `tsup` v8.5.1（Extension/MCP 為 CJS；卡匣機櫃 Webview 為 browser IIFE）
- Linter: `eslint` v9.x + `@typescript-eslint` v8.x（Flat Config）
- Test: `vitest`
- Config: JSON
- Webview Visualization: `cytoscape`

## VS Code Extension & MCP

- Entry: `src/extension.ts` 及 `src/mcp-server.ts`
- Output: `dist/extension.js` 及 `dist/mcp-server.js`
- Activation: `workspaceContains:.agents` + `onStartupFinished`
- Commands: `cartridge.scan`、`cartridge.status`、`cartridge.scanGhosts`、`cartridge.attributeFile`、`cartridge.showGhostFileInfo`、`cartridge.openGovernanceDashboard`、`cartridge.openCabinetWorkbench`、`cartridge.refreshGovernance`、`cartridge.contextAudit`、`cartridge.checkForUpdates`
- Views Container: `cartridgeGovernance` (Activity Bar，v5.0 新增)
- Views: `cartridgeGovernanceOverview`、`cartridgeExplorer`、`cartridgeContextExplorer`、`cartridgeActionItems`
- Engine: `vscode ^1.85.0`
- Publisher: `cartridge-system`

## Dependencies（生產）

- `@modelcontextprotocol/sdk` ^1.0.1
- `cytoscape` ^3.33.3
- `gray-matter` ^4.0.3
- `ignore` ^7.0.5

## DevDependencies

- `@types/vscode` ^1.85.0
- `@vscode/vsce` ^3.0.0
- `@types/node` ^25.5.0
- `tsup` ^8.0.0
- `typescript` ^5.5.0
- `vitest` ^3.0.0

## Config Files

- `package.json` — VS Code Extension 元數據（含 activationEvents / contributes），當前版本 **5.3.4**；同時公開 `cartridge-system` / `cartridge-mcp` npm bin 指向 `dist/mcp-server.js`，`files` 同時作為 npm 與 VSIX 發布白名單，`npm run package` 委派 `scripts/package-vsix.mjs`，repository URL 採 npm 正規化後的 `git+https://...`；`cartridge.updateCheck.enabled` 控制啟動時 GitHub Release 更新檢查，手動命令不受此設定影響
- `tsconfig.json` — CommonJS + node 模組解析
- `tsup.config.ts` — entry: extension.ts / mcp-server.ts 使用 cjs；cabinet-webview.ts 使用 browser iife；external: vscode / noExternal: gray-matter、ignore、cytoscape
- `eslint.config.js` — ESLint v9 Flat Config（CJS 格式，@typescript-eslint）
- `package.json files` — npm runtime 發布白名單：`dist/*.js`、`assets/**`、README、CHANGELOG、LICENSE；排除 `.agents/`、`src/`、測試、source map 與 GitHub workflow；卡匣機櫃 Webview 產物為 `dist/cabinet-webview.global.js`
- `.github/workflows/release.yml` — VSIX 自動發版流程：推送 `v*` tag 或手動輸入版本後執行 test/lint/build/package，並建立或更新 GitHub Release 附件
- `.cartridge/index.json` — 執行期產生（索引檔）

## 專案身份與工作模式

- **Project Identity**: Cartridge System — A VS Code extension + MCP tool server for the Antigravity framework, providing automated detection of stale memory, ghost files, and cross-module dependency propagation.
- **Work Mode**: Core extension logic development (TypeScript + vitest), MCP tool interface maintenance, and evolution of memory card specifications.
- **Director Role**: Traditional Chinese commander, acting as framework architect and quality supervisor.
- **Deployment Environment**: Local development on Windows 11, VSIX installation into Antigravity IDE, GitHub Actions publishes VSIX release assets, npm publishes the MCP runtime.
- **MCP Toolchain**: cartridge-system (native), gitnexus (knowledge graph), multi-mcp-gateway (tool routing).

## Key Decisions

### D12

D12: v3.0.0 **[重大]** 外掛職責純化 — 移除框架基礎注入機制（`CoreInjector`、`src/templates/`、`tsup onSuccess` 複製邏輯、`.cartridge/injector.json` 狀態檔）。外掛的唯一職責聚焦於記憶卡匣的生命週期追蹤（檔案監聽、過期分析、UI 呈現）以及 AI 代理的 MCP 介面。Antigravity 框架的安裝由獨立腳本（install.ps1）全權管理。`chokidar` 亦一並從 noExternal 清單移除（早在 v2.0 已廢用）。

### D13

D13: v4.0.0 次世代依賴拓樸與幽靈感知 — 導入 import-resolver + dependency-propagator 雙引擎，支援自動依賴推導、間接過期傳播（BFS）、循環偵測（DFS）、幽靈檔案標記。MCP 新增 memory_deps 工具。版本號 4.0.0。

### D14

D14: v4.0.1 狀態列 Tooltip 幽靈感知修復 — 補齊狀態列懸浮健康報告中 `💀 幽靈檔案 (需清理)` 區塊的顯示，與 TreeView 側邊欄達成視覺一致性。

### D15

D15: VSIX 發布自動化 — GitHub Actions `Release VSIX` workflow 成為正式插件發布入口。推送 `v*` tag 或手動輸入版本會執行 `npm ci`、測試、lint、build、package，並將 `cartridge-system-*.vsix` 建立或覆蓋到 GitHub Release；workflow 不自動 bump version、不自動 commit。打包白名單由 `package.json.files` 統一持有。

### D16

D16: 安全依賴採 lockfile 內相容修補優先 — `npm audit fix --package-lock-only` 可在不升級 direct dependency major 的前提下更新 `@modelcontextprotocol/sdk` / `tsup` / `vitest` 牽出的 transitive packages；本輪將 `fast-uri`、`hono`、`express-rate-limit`、`ip-address` 與 `postcss` 提升至修補版本，`npm audit` 歸零。

### D17

D17: v5.2 npm MCP runtime — package 版本升至 5.2.0，新增 `bin`、`files` 與 `prepublishOnly`，正式 publish 前會跑 lint/test/build/tsc/pack dry-run；VSIX extension manifest 仍留在同一 package。

### D18

D18: v5.3.0 卡匣機櫃工作台 — 新增 `cytoscape` 生產依賴與 browser IIFE tsup build，讓 VS Code 編輯區 WebviewPanel 可載入 `dist/cabinet-webview.global.js`，同時保留 Extension/MCP CJS 輸出。

D19: v5.3.1 VSIX 打包 — 本版發行以 `cartridge-system-5.3.1.vsix` 作為本機安裝檔，打包前需先同步 `package.json`、`package-lock.json`、README 與 CHANGELOG 的版本號。

D20: VSIX / npm 發布策略收斂 — `package.json.files` 同時作為 npm runtime 與 VSIX 打包白名單；`scripts/package-vsix.mjs` 負責覆蓋同版本 VSIX 並直接呼叫本機 VSCE CLI。

D21: v5.3.1 為卡匣機櫃工作台 UI 修正版，僅 bump package/package-lock 版本並沿用 v5.3.0 的依賴與打包白名單。

D22: v5.3.2 為卡匣機櫃圖譜縮放與可讀性修正版；package/package-lock、README、CHANGELOG 與 VSIX 檔名同步至 5.3.2，Webview bundle 仍由 `tsup` browser IIFE 輸出。

D23: v5.3.3 為卡匣機櫃縮放控制與 AI 記憶圖譜工具版；package/package-lock、README、CHANGELOG 與 VSIX 檔名同步至 5.3.3，MCP server runtime 版本常數仍維持既有契約。

D24: v5.3.4 插件更新檢查 — VSIX extension manifest 新增 `cartridge.checkForUpdates` 與 `cartridge.updateCheck.enabled`；更新來源只信任 GitHub Release，不追 main 分支或未完成打包的 tag。package/package-lock、README、CHANGELOG 與 VSIX 檔名同步至 5.3.4。

## Known Issues

- 無

## Module Lessons

- L01: \_system 紀錄專案的基礎依賴變更與發布紀錄。
- L02: v0.7.0 (2026-03-31) — 發布區段標題黏連修復與行內自動修復引擎。
- L03: v0.8.1 (2026-04-02) — MCP Server 新增 memory_commit 兩步驟操作流機制，同步升級版本號。
- L04: v0.9.0 (2026-04-02) — 三合一架構重構：移除 patch/append 棄用模式、索引檔搬遷至 `.cartridge/`、注入器三方比對覆蓋機制。
- L05: 最新的系統已全面進入雙子星架構，確保前端 IDE UI 與後端 MCP 邏輯絕對隔離。全專案具備離線與未歸屬邊緣檔案偵測能力。
- L06: v2.0.0 (2026-04-12) — 次世代架構升級：棄用 chokidar 改用 VS Code 原生 FileSystemWatcher + debounceMap；Cache-First I/O 機制（isDirty + flushIfDirty + 5 分鐘安全心跳）；背景化幽靈掃描；新增 TreeView 側邊欄 + CodeLens 行內標記 + 智慧歸屬推薦引擎。
- L07: v3.0.0 (2026-05-04) — 職責純化：移除框架基礎注入機制，外掛聚焦記憶卡匣管理核心功能。
- L08: v4.0.0 (2026-05-06) — 次世代依賴引擎上線：自動化依賴推導 + 間接過期傳播 + 幽靈檔案偵測。單元測試從 94 躍升至 106 個案例。
- L09: v4.0.1 (2026-05-06) — 修復狀態列 Tooltip 幽靈資訊顯示缺口。
- L10: v4.1.0 (2026-05-08) — 健康合約升級：memory_commit 新增標題精確匹配驗證（HEADING_TYPO）與路徑基準驗證（PATH_ABSOLUTE / PATH_TRAVERSAL），測試 106→112。
- L11: v4.1.1 (2026-05-14) — package.json 已確認維持 extension metadata、MCP server 入口、commands 與依賴設定；系統記憶同步至目前版本狀態。
- L12: (2026-05-14) GitNexus CLI 環境修復 — npm Roaming 全域 shim 曾指向殘缺的 `node_modules/gitnexus/dist/cli/index.js`，導致 `npx gitnexus` 失敗；已將 npm shim 改為優先委派 pnpm 全域 GitNexus，缺失時 fallback 到 `pnpm dlx --allow-build=... gitnexus`。
- L13: v5.0.0 (2026-05-17) — package.json 與 MCP server metadata 同步升級至 5.0.0；本版主軸為只讀上下文治理 OS，不新增生產依賴。
- L14: v5.0.0 (2026-05-17) — package.json contributes 新增 `viewsContainers.activitybar` 的 `cartridgeGovernance`，並新增三個治理 commands；`cartridgeExplorer` 不再掛在 Explorer。
- L15: v5.1.0 (2026-05-17) — package.json 與 MCP server metadata 同步升級至 5.1.0；本版主軸為 AI 開工清單、規則檔檢查白話化、側邊欄提醒可讀性與 MCP 工具安全說明。
- L16: (2026-05-18) — `.github/workflows/release.yml` 新增 VSIX 自動發版；正式發布以 `package.json` 版本與 `v*` tag 一致為門檻，Release notes 優先取 `CHANGELOG.md` 對應版本段落。
- L17: (2026-05-18) — 本機若 `ComSpec` 為空，npm 10 在 Windows 上執行 `npm run *` 會於 `@npmcli/promise-spawn` 拋 `ERR_INVALID_ARG_TYPE`；User 層 `ComSpec=C:\Windows\System32\cmd.exe` 是跨 repo 的持久修復。
- L18: (2026-05-18) — 安全修補不一定需要調整 `package.json` direct ranges；先用 lockfile 相容更新清除 npm audit，再評估是否另做 major upgrade。
- L19: (2026-05-18) — 同 repo 兼任 VS Code extension 與 npm MCP runtime 時，npm `files` 白名單要保留 `assets/**`，因 package manifest 仍引用 extension icon / Activity Bar 圖示。
- L20: (2026-05-18) — `npm publish --dry-run` 會正規化 package manifest；本 repo 以 `git+https://...` repository URL 與不含 `./` 的 bin path 作為發布前測試契約。
- L21: (2026-05-19) — Webview 前端不能依賴 VSIX 內的 `node_modules`；視覺化依賴要透過 tsup 打進 `dist/*.js`，才能符合 `package.json.files` 白名單。
- L22: (2026-05-19) — VSCE 3.x 偵測到 `.vscodeignore` 與 `package.json.files` 同時存在會直接中止；本 repo 改由 `package.json.files` 作為單一白名單來源。
- L23: (2026-05-19) — 版本號升級需同步 package-lock 根層版本、README 安裝命令、CHANGELOG 版本段落與本機 VSIX 檔名。
- L24: (2026-05-19) — v5.3.2 打包前需確認 `cabinet-graph-viewport.ts` 已歸卡，否則 `commit_preflight` 會以未歸屬 source file 阻塞提交。
- L25: (2026-05-19) — VSIX/package 修補版可升 package 版本但不必同步改 `MCP_SERVER_VERSION`，除非本次發行目標包含 npm runtime 版本宣告。

## Applicable Skills

- tech-stack-protocol
