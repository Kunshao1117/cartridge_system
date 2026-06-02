---
name: _system
description: |
  專案記憶：系統技術堆疊與部署設定。 Use when: 確認技術選型、環境設定、部署組態時載入。
last_updated: '2026-06-02T21:25:10+08:00'
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
- .github/workflows/npm-publish.yml

## Runtime & Host

- OS: Windows 11 家用版 (10.0.26200, 64-bit)
- Node.js: v24.15.0
- npm: 11.14.1

## Tech Stack

- Language: TypeScript 5.x
- Framework: **VS Code Extension API**
- File Watcher: **VS Code 原生 FileSystemWatcher**（v2.0 棄用 chokidar）
- YAML Parser: `gray-matter`
- Build: `tsup` v8.5.1（Extension/MCP 為 CJS；卡匣機櫃 Webview 為 browser IIFE）
- Linter: `eslint` v9.x + `@typescript-eslint` v8.x（Flat Config）
- Test: `vitest` 4.x
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
- `vitest` ^4.1.8

## Config Files

- `package.json` — VS Code Extension 元數據（含 activationEvents / contributes），當前版本 **5.4.1**；同時公開 `cartridge-system` / `cartridge-mcp` npm bin 指向 `dist/mcp-server.js`，`files` 同時作為 npm 與 VSIX 發布白名單，`npm run package` 委派 `scripts/package-vsix.mjs`，repository URL 採 npm 正規化後的 `git+https://...`；`cartridge.updateCheck.enabled` 控制啟動時 GitHub Release 更新檢查，手動命令不受此設定影響
- `tsconfig.json` — CommonJS + node 模組解析
- `tsup.config.ts` — entry: extension.ts / mcp-server.ts 使用 cjs；cabinet-webview.ts 使用 browser iife；external: vscode / noExternal: gray-matter、ignore、cytoscape
- `eslint.config.js` — ESLint v9 Flat Config（CJS 格式，@typescript-eslint）
- `package.json files` — npm runtime 發布白名單：`dist/*.js`、`assets/**`、README、CHANGELOG、LICENSE；排除 `.agents/`、`src/`、測試、source map 與 GitHub workflow；卡匣機櫃 Webview 產物為 `dist/cabinet-webview.global.js`
- `.github/workflows/release.yml` — VSIX 自動發版流程：推送 `v*` tag 或手動輸入版本後執行 test/lint/build/package，並建立或更新 GitHub Release 附件；`v*` tag 保留給 VSIX 插件 release，不發布 npm MCP runtime；workflow 使用 Node 24 相容 GitHub Actions 與 Node 24 打包環境
- `.github/workflows/npm-publish.yml` — npm Trusted Publishing 發布流程：推送 `npm-v*` tag 或手動輸入版本後檢查 package 版本一致性與 npm registry 既有版本；若版本已存在則成功跳過 npm 發布，若版本未存在則執行 lint/test/build/tsc/pack dry-run，再透過 GitHub OIDC 發布 npm；job environment 固定為 `npm publish`，必須與 npm package access 設定一致
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
D25: v5.3.5 插件更新檢查按鈕 — `package.json` 讓 `cartridge.checkForUpdates` 使用 `$(cloud-download)` icon，並掛到 `cartridgeGovernanceOverview` 與 `cartridgeExplorer` 的 `view/title` navigation 區，讓側邊欄可直接點按鈕手動檢查；package/package-lock、README、CHANGELOG 與 VSIX 檔名同步至 5.3.5。
D26: Release workflow Node 24 升級 — `.github/workflows/release.yml` 改用 `actions/checkout@v6`、`actions/setup-node@v6` 與 `node-version: "24"`，保留既有 tag / workflow_dispatch 發版契約，但避免 Node.js 20 action runtime deprecation warning。
D27: v5.4.0 專案脈絡層 npm 發布版 — package/package-lock、README、CHANGELOG 與 MCP server runtime version 同步至 5.4.0；本版目標包含 npm MCP runtime 發布，因此不沿用只 bump VSIX manifest 的例外策略。
D28: npm Trusted Publishing workflow — 新增 `.github/workflows/npm-publish.yml` 作為 npm 發布入口，使用 GitHub OIDC (`id-token: write`) 與 npm package trusted publisher，不保存長期 `NPM_TOKEN`；workflow 會確認 tag/input 與 `package.json` version 一致後再執行 lint/test/build/tsc/pack dry-run/publish。若 npm package access 填入 environment `npm publish`，GitHub Actions job environment 必須同名。
D29: npm 既有版本保護 — `.github/workflows/npm-publish.yml` 在執行 npm 發布前先查詢 `cartridge-system@版本` 是否已存在；若 registry 已有同版本，workflow 成功跳過 npm 發布，避免補推既有 release tag 時因 npm 版本不可覆蓋而失敗。
D30: 發布 tag 分流 — `v*` tag 保留給 VSIX 插件 release workflow；npm MCP runtime 改用 `npm-v*` tag 或 `Publish npm` 手動 workflow。兩種知識資產共用 package 版本欄位，但不再由同一個 tag 同時觸發兩種發布產物。
D31: v5.4.1 記憶警示分層 — 保留依賴圖與 indirect stale 傳播引擎，但高階治理與 UI 只把直接 stale、ghost、untracked、compatibility 視為 blocking；上游影響與父子卡衍生提示改為 review/advisory warning。
D32: 依賴安全漏洞清零 — 保留 package 版本 5.4.1、不升級 `@modelcontextprotocol/sdk` / `@vscode/vsce` direct range；僅將直接測試框架升至 `vitest` ^4.1.8，並用 lockfile resolver 將 `qs`、`tmp`、`@azure/msal-node` 提升至安全版本，完整與生產 `npm audit` 皆歸零。

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
- L26: (2026-05-29) — 發布到 npm 時，`package.json` 版本、`package-lock.json` 根層版本、README 安裝範例、工具名冊版本測試與 MCP server `--version` 輸出必須同步，避免 npm 使用者看到舊 runtime 版本。
- L27: (2026-05-29) — npm Trusted Publishing 的 owner、repository、workflow filename 與 environment name 皆需和 npm package access 設定完全一致；本 repo 採 `Kunshao1117/cartridge_system`、`npm-publish.yml`、environment `npm publish`。
- L28: (2026-05-29) — npm registry 的同名同版本不可覆蓋；若要補推已手動發布過的 tag，npm workflow 必須先偵測既有版本並成功跳過 publish，否則 Actions 會在 npm 發布步驟失敗。
- L29: (2026-05-29) — MCP runtime 與 VSIX 插件是不同發布面；未來 npm 發布使用 `npm-vX.Y.Z`，插件發布使用 `vX.Y.Z`，避免測 npm Trusted Publishing 時重建 VSIX release。
- L30: (2026-06-02) — 直接狀態與衍生傳播提醒必須分層治理；若只改警示語義，不能碰底層依賴圖建構與 BFS 傳播，降低啟動、監聽與記憶查詢風險。
- L31: (2026-06-02) — 當直接依賴存在安全修復 major（例如 `vitest` 4.x）時，先只升必要 direct package，再用 `npm update` 抬升相容的傳遞套件；若 audit 歸零且 package/VSCE/MCP direct range 未改，即不需要同步版本號或發布文件。

## Applicable Skills

- tech-stack-protocol
