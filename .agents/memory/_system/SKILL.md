---
name: _system
description: |
  專案記憶：系統技術堆疊與部署設定。 Use when: 確認技術選型、環境設定、部署組態時載入。
last_updated: '2026-03-31T12:15:32+08:00'
status: stale
staleness: 11
---
<!-- CARTRIDGE_SYSTEM_WARNING_START -->

> [!CAUTION]
> 🟠 **系統強制攔截**：此記憶已過期失真！
> 追蹤檔案異動：`package.json`（2026-04-02T11:43:32+08:00）
> AI 嚴禁基於此記憶施工，必須優先閱讀最新原始碼並更新此記憶卡。
> staleness: 11 | threshold: 🟠 顯著過期

<!-- CARTRIDGE_SYSTEM_WARNING_END -->

# System — 系統記憶

## Tracked Files
- package.json

## Runtime & Host
- OS: Windows 11 家用版 (10.0.26200, 64-bit)
- Node.js: v22.13.1
- npm: 10.9.2

## Tech Stack
- Language: TypeScript 5.x
- Framework: **VS Code Extension API**
- File Watcher: `chokidar` v4
- YAML Parser: `gray-matter`
- Build: `tsup` v8.5.1（CJS 輸出）
- Linter: `eslint` v9.x + `@typescript-eslint` v8.x（Flat Config）
- Test: `vitest`
- Config: JSON

## VS Code Extension & MCP
- Entry: `src/extension.ts` 及 `src/mcp-server.ts`
- Output: `dist/extension.js` 及 `dist/mcp-server.js`
- Activation: `workspaceContains:.agents` + `onStartupFinished`
- Commands: `cartridge.scan`、`cartridge.status`
- Engine: `vscode ^1.85.0`
- Publisher: `cartridge-system`

## Dependencies（生產）
- `@modelcontextprotocol/sdk` ^1.0.1
- `chokidar` ^4.0.0
- `gray-matter` ^4.0.3

## DevDependencies
- `@types/vscode` ^1.85.0
- `@vscode/vsce` ^3.0.0
- `@types/node` ^25.5.0
- `tsup` ^8.0.0
- `typescript` ^5.5.0
- `vitest` ^3.0.0

## Config Files
- `package.json` — VS Code Extension 元數據（含 activationEvents / contributes），當前版本 **0.7.0**
- `tsconfig.json` — CommonJS + node 模組解析
- `tsup.config.ts` — entry: extension.ts / format: cjs / external: vscode / noExternal: chokidar, gray-matter / **onSuccess: 複製範本目錄**
- `eslint.config.js` — ESLint v9 Flat Config（CJS 格式，@typescript-eslint）
- `.vscodeignore` — 打包排除清單（含 .agents/ 排除）
- `cartridge_index.json` — 執行期產生## Key Decisions
### D11
D11: tsup `onSuccess` hook 負責在建置完成後自動複製 `src/templates/` 至 `dist/templates/`，確保注入器的靜態範本隨外掛打包

## Known Issues
- 無

## Module Lessons
- L01: _system 紀錄專案的基礎依賴變更與發布紀錄。
- L02: v0.7.0 (2026-03-31) — 發布區段標題黏連修復與行內自動修復引擎。
