---
name: _system
description: |
  專案記憶：系統技術堆疊與部署設定。 Use when: 確認技術選型、環境設定、部署組態時載入。
last_updated: '2026-05-14T00:50:22+08:00'
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

## Runtime & Host

- OS: Windows 11 家用版 (10.0.26200, 64-bit)
- Node.js: v22.13.1
- npm: 10.9.2

## Tech Stack

- Language: TypeScript 5.x
- Framework: **VS Code Extension API**
- File Watcher: **VS Code 原生 FileSystemWatcher**（v2.0 棄用 chokidar）
- YAML Parser: `gray-matter`
- Build: `tsup` v8.5.1（CJS 輸出）
- Linter: `eslint` v9.x + `@typescript-eslint` v8.x（Flat Config）
- Test: `vitest`
- Config: JSON

## VS Code Extension & MCP

- Entry: `src/extension.ts` 及 `src/mcp-server.ts`
- Output: `dist/extension.js` 及 `dist/mcp-server.js`
- Activation: `workspaceContains:.agents` + `onStartupFinished`
- Commands: `cartridge.scan`、`cartridge.status`、`cartridge.scanGhosts`、`cartridge.attributeFile`
- Views: `cartridgeExplorer` (TreeView 側邊欄，v2.0 新增)
- Engine: `vscode ^1.85.0`
- Publisher: `cartridge-system`

## Dependencies（生產）

- `@modelcontextprotocol/sdk` ^1.0.1
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

- `package.json` — VS Code Extension 元數據（含 activationEvents / contributes），當前版本 **4.1.1**
- `tsconfig.json` — CommonJS + node 模組解析
- `tsup.config.ts` — entry: extension.ts / format: cjs / external: vscode / noExternal: gray-matter, ignore（v3.0 已移除 onSuccess 範本複製邏輯）
- `eslint.config.js` — ESLint v9 Flat Config（CJS 格式，@typescript-eslint）
- `.vscodeignore` — 打包排除清單（含 .agents/ 排除）
- `.cartridge/index.json` — 執行期產生（索引檔）

## 專案身份與工作模式

- **Project Identity**: Cartridge System — A VS Code extension + MCP tool server for the Antigravity framework, providing automated detection of stale memory, ghost files, and cross-module dependency propagation.
- **Work Mode**: Core extension logic development (TypeScript + vitest), MCP tool interface maintenance, and evolution of memory card specifications.
- **Director Role**: Traditional Chinese commander, acting as framework architect and quality supervisor.
- **Deployment Environment**: Local development on Windows 11, VSIX installation into Antigravity IDE, no cloud CI/CD.
- **MCP Toolchain**: cartridge-system (native), gitnexus (knowledge graph), multi-mcp-gateway (tool routing).

## Key Decisions

### D12

D12: v3.0.0 **[重大]** 外掛職責純化 — 移除框架基礎注入機制（`CoreInjector`、`src/templates/`、`tsup onSuccess` 複製邏輯、`.cartridge/injector.json` 狀態檔）。外掛的唯一職責聚焦於記憶卡匣的生命週期追蹤（檔案監聽、過期分析、UI 呈現）以及 AI 代理的 MCP 介面。Antigravity 框架的安裝由獨立腳本（install.ps1）全權管理。`chokidar` 亦一並從 noExternal 清單移除（早在 v2.0 已廢用）。

### D13

D13: v4.0.0 次世代依賴拓樸與幽靈感知 — 導入 import-resolver + dependency-propagator 雙引擎，支援自動依賴推導、間接過期傳播（BFS）、循環偵測（DFS）、幽靈檔案標記。MCP 新增 memory_deps 工具。版本號 4.0.0。

### D14

D14: v4.0.1 狀態列 Tooltip 幽靈感知修復 — 補齊狀態列懸浮健康報告中 `💀 幽靈檔案 (需清理)` 區塊的顯示，與 TreeView 側邊欄達成視覺一致性。

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

## Applicable Skills

- tech-stack-protocol
