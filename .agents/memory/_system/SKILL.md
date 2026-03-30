---
name: _system
description: |
  專案記憶：系統技術堆疊與部署設定。 Use when: 確認技術選型、環境設定、部署組態時載入。
last_updated: '2026-03-31T05:01:46+08:00'
status: stable
staleness: 0
---

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
- `package.json` — VS Code Extension 元數據（含 activationEvents / contributes），當前版本 **0.6.0**
- `tsconfig.json` — CommonJS + node 模組解析
- `tsup.config.ts` — entry: extension.ts / format: cjs / external: vscode / noExternal: chokidar, gray-matter / **onSuccess: 複製範本目錄**
- `eslint.config.js` — ESLint v9 Flat Config（CJS 格式，@typescript-eslint）
- `.vscodeignore` — 打包排除清單（含 .agents/ 排除）
- `cartridge_index.json` — 執行期產生
## Key Decisions
### D11
D11: tsup `onSuccess` hook 負責在建置完成後自動複製 `src/templates/` 至 `dist/templates/`，確保注入器的靜態範本隨外掛打包

## Known Issues
- 無

## Module Lessons
### D08
D08: tsup 只打包 TypeScript 模組樹，不會自動複製非程式碼的靜態資源（Markdown、JSONL 等）。需透過 `onSuccess` hook 手動複製
