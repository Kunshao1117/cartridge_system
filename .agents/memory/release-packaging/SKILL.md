---
name: release-packaging
description: >
  專案記憶：VSIX 發行打包輔助腳本。Use when: 修改本機 VSIX 打包流程、處理 VSCE 與 npm files
  白名單衝突、重打包安裝檔或調整發布腳本時載入。
scopePath: scripts/
dependencies:
  - _system
metadata:
  author: antigravity
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
    - 'filesystem:write'
    - 'terminal:test'
last_updated: '2026-05-19T06:06:59+08:00'
staleness: 0
status: stable
---

# Release Packaging — VSIX 發行打包記憶

> 本卡追蹤本機 VSIX 打包輔助腳本。它的職責是讓 `npm run package` 能穩定產出 Antigravity / VS Code 可安裝的 `.vsix` 檔案。

## Tracked Files

- scripts/package-vsix.mjs

## Key Decisions

- D01: `scripts/package-vsix.mjs` 是 `npm run package` 的唯一入口，負責用目前 Node 執行本機 `node_modules/@vscode/vsce/vsce package`，並保留命令列參數轉傳能力。
- D02: 本卡依賴 `_system`，因腳本行為直接依賴 `package.json` 的版本與 `files` 白名單；上述設定變更時本腳本需重新檢查。
- D03: VSCE 不允許同時使用 `.vscodeignore` 與 `package.json.files`；本 repo 移除 `.vscodeignore`，由 `package.json.files` 統一決定 VSIX 與 npm runtime 的打包內容。
- D04: 未指定 `--out` 時，腳本會刪除同版本既有 `.vsix` 後重新打包，支援重複執行 `npm run package`。

## Known Issues

- 無

## Module Lessons

- L01: VSIX 與 npm runtime 共用同一個 `package.json` 時，npm `files` 白名單會和 VSCE 的 `.vscodeignore` 策略互斥；最穩定做法是保留 `package.json.files` 作為單一白名單。
- L02: Windows / Node 24 下從 npm script 內 `spawnSync("npx.cmd")` 可能回 `EINVAL`；直接用 `process.execPath` 執行本機 VSCE CLI 較穩定。

## Relations

- _system（系統設定、package manifest 與 GitHub Actions）
- _assets（README / CHANGELOG 發布文件）

## Applicable Skills

- memory-ops
- memory-arch
