---
name: mem-_system
description: >
  專案記憶：系統技術堆疊與部署設定。
  Use when: 確認技術選型、環境設定、部署組態時載入。
last_updated: "2026-03-28T07:29:00+08:00"
status: stable
staleness: 0
---

# System — 系統記憶

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
- Test: `vitest`
- Config: JSON

## VS Code Extension & MCP
- Entry: `src/extension.ts` 及 `src/mcp-server.ts`
- Output: `dist/extension.js` 及 `dist/mcp-server.js`
- Activation: `workspaceContains:.agents`
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
- `package.json` — VS Code Extension 元數據（含 activationEvents / contributes）
- `tsconfig.json` — CommonJS + node 模組解析
- `tsup.config.ts` — entry: extension.ts / format: cjs / external: vscode
- `.vscodeignore` — 打包排除清單
- `cartridge_index.json` — 執行期產生

## Deploy
- 開發模式：VS Code F5 啟動 Extension Development Host
- 打包：`npm run package`（`npx vsce package`）

## Key Decisions
- D01: 業務邏輯模組（7 個）全部保留，只替換外殼層
- D02: chokidar 跨平台穩定
- D03: VS Code Extension 強制 CommonJS 輸出（`"type": "module"` 已移除）
- D04: gray-matter 解析 YAML frontmatter
- D05: 主動物理寫入策略
- D06: 需安裝 @types/node
- D07: activationEvents 設為 workspaceContains:.agents，避免在無關專案啟動
- D08: import.meta.dirname 在 CommonJS 中不可用，已改為 __dirname

## Known Issues
- 無

## Module Lessons
- D01: TypeScript ESM 使用 node: 前綴需 @types/node
- D02: VS Code Extension 強制 CommonJS，ESM 不相容
- D03: tsup 打包時必須將 vscode 設為 external，避免打包進 bundle
