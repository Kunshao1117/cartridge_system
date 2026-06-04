# _system Legacy Archive Volume 001

Migrated: 2026-06-04T07:15:00+08:00
Archive policy: schema v2 lazy upgrade preserved the original legacy SKILL.md content verbatim for trace-back.

## Original Legacy Content

---
name: _system
description: |
  專案記憶：系統技術堆疊與部署設定。 Use when: 確認技術選型、環境設定、部署組態時載入。
last_updated: '2026-06-04T06:35:24+08:00'
status: active
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
- tsup.desktop.config.ts
- desktop.vite.config.ts
- electron-builder.desktop.yml
- eslint.config.js
- vitest.config.ts
- package-lock.json
- .github/workflows/release.yml
- .github/workflows/npm-publish.yml
- .github/workflows/desktop-release.yml

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
- Desktop Shell: Electron 42 + React 19 + Fluent UI v9（桌面監控台產品線）
- Desktop Renderer Build: Vite 8 + React plugin
- Desktop Installer: electron-builder

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
- `@fluentui/react-components` ^9.74.1
- `@fluentui/react-icons` ^2.0.328
- `cytoscape` ^3.33.3
- `gray-matter` ^4.0.3
- `ignore` ^7.0.5
- `react` ^19.2.7
- `react-dom` ^19.2.7

## DevDependencies

- `@types/vscode` ^1.85.0
- `@types/react` ^19.2.16
- `@types/react-dom` ^19.2.3
- `@vitejs/plugin-react` ^6.0.2
- `@vscode/vsce` ^3.0.0
- `@types/node` ^25.5.0
- `electron` ^42.3.2
- `electron-builder` ^26.8.1
- `vite` ^8.0.16
- `concurrently` ^10.0.3
- `wait-on` ^9.0.10
- `tsup` ^8.0.0
- `typescript` ^5.5.0
- `vitest` ^4.1.8

## Config Files

- `package.json` — VS Code Extension 元數據（含 activationEvents / contributes），當前版本 **5.4.2**；同時公開 `cartridge-system` / `cartridge-mcp` npm bin 指向 `dist/mcp-server.js`，`files` 同時作為 npm 與 VSIX 發布白名單，`npm run package` 委派 `scripts/package-vsix.mjs`，repository URL 採 npm 正規化後的 `git+https://...`；`cartridge.updateCheck.enabled` 控制啟動時 GitHub Release 更新檢查，手動命令不受此設定影響
- `tsconfig.json` — CommonJS + node 模組解析
- `tsup.config.ts` — entry: extension.ts / mcp-server.ts 使用 cjs；cabinet-webview.ts 使用 browser iife；external: vscode / noExternal: gray-matter、ignore、cytoscape
- `eslint.config.js` — ESLint v9 Flat Config（CJS 格式，@typescript-eslint）
- `package.json files` — npm runtime 發布白名單：`dist/*.js`、`assets/**`、README、CHANGELOG、LICENSE；排除 `.agents/`、`src/`、測試、source map 與 GitHub workflow；卡匣機櫃 Webview 產物為 `dist/cabinet-webview.global.js`
- `.github/workflows/release.yml` — VSIX 自動發版流程：推送 `v*` tag 或手動輸入版本後執行 test/lint/build/package，並建立或更新 GitHub Release 附件；`v*` tag 保留給 VSIX 插件 release，不發布 npm MCP runtime；workflow 使用 Node 24 相容 GitHub Actions 與 Node 24 打包環境
- `.github/workflows/npm-publish.yml` — npm Trusted Publishing 發布流程：推送 `npm-v*` tag 或手動輸入版本後檢查 package 版本一致性與 npm registry 既有版本；若版本已存在則成功跳過 npm 發布，若版本未存在則執行 lint/test/build/tsc/pack dry-run，再透過 GitHub OIDC 發布 npm；job environment 固定為 `npm publish`，必須與 npm package access 設定一致
- `.github/workflows/desktop-release.yml` — Desktop Console 自動發版流程：推送 `desktop-v*` tag 或手動輸入版本後，在 Windows runner 執行 test/lint/tsc/`desktop:dist -- --publish never`，建立或更新 `Cartridge Desktop Console desktop-vX.Y.Z` Release 並上傳 Windows installer；此流程不觸發 VSIX 或 npm MCP runtime 發布，且建立 release 時明確 `--latest=false`，避免 VSIX 更新檢查誤讀桌面版
- `.cartridge/index.json` — 執行期產生（索引檔）
- `tsup.desktop.config.ts` — 桌面主程序與 preload 的 CJS bundle，輸出至 `dist/desktop`，external: electron，noExternal: gray-matter / ignore
- `desktop.vite.config.ts` — React + Fluent UI renderer build，root 指向 `src/desktop/renderer`，base 使用相對路徑，輸出至 `dist/desktop/renderer`；桌面本機 bundle 警告門檻設為 700KB，避免 Fluent UI 單檔約 510KB 時產生誤導性警告
- `electron-builder.desktop.yml` — Desktop Console Windows installer 設定，透過 extraMetadata 指定 Electron main，Windows icon 指向 `desktop-assets/cartridge-desktop.ico`，不改 VSIX manifest

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
D33: Desktop Console 產品線 — 新增 Electron + React + Fluent UI 桌面監控台，桌面建構與發行設定獨立於 VSIX `v*` 與 npm MCP runtime `npm-v*`；桌面版重用 Cartridge 監控規則但不新增 MCP 工具能力，Windows installer 使用 `desktop-assets/cartridge-desktop.ico` 避免 Electron 預設圖示，且不進 npm `assets/**` 白名單。
D34: v5.4.2 發布包含三條產品線：VSIX 插件、npm MCP runtime 與 Desktop Console；正式發布需分別推送 `v5.4.2`、`npm-v5.4.2` 與 `desktop-v5.4.2`，且三者都要求 package 版本一致。
D34: Desktop Console 發布分流 — 桌面安裝檔使用 `desktop-v*` tag 與 `Release Desktop Console` workflow 發布，Release title 採 `Cartridge Desktop Console desktop-vX.Y.Z`，建立時明確不標記 GitHub Latest；`v*` 繼續只代表 VSIX 插件，`npm-v*` 繼續只代表 npm MCP runtime。
D35: Desktop Console CI 打包隔離 — `.github/workflows/desktop-release.yml` 的 build step 必須以 `npm run desktop:dist -- --publish never` 執行，避免 electron-builder 在 GitHub Actions 中自行進入 publish 流程；GitHub Release 建立與附件覆蓋只由後續 `gh release` 步驟負責。

## Known Issues