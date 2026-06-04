# desktop-console Legacy Archive Volume 001

Migrated: 2026-06-04T07:15:00+08:00
Archive policy: schema v2 lazy upgrade preserved the original legacy SKILL.md content verbatim for trace-back.

## Original Legacy Content

---
name: desktop-console
description: >
  專案記憶：Cartridge Desktop Console 桌面監控台父層總覽。Use when: 處理桌面版產品線、多專案監控台、 Electron
  外殼、桌面監控 runtime 或桌面發布邊界時載入。
last_updated: '2026-06-02T23:16:55+08:00'
status: stable
staleness: 0
metadata:
  author: antigravity
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
---

# Desktop Console — 桌面監控台父卡

> 本父卡記錄桌面產品線的總體邊界。桌面版是 VSIX 插件與 npm MCP runtime 之外的第三條產品線：它重用 Cartridge 記憶卡監控規則，但不新增 MCP 工具能力。

## Tracked Files

- （父層總覽，不直接追蹤實作檔案）

## Key Decisions

- D01: v1 桌面版採 Electron + React + Fluent UI，優先保證 TypeScript / Node 核心重用、Windows 工具型 UI 穩定性與可維護性。
- D02: 桌面版不改 `package.json` 的 VSIX `main`、MCP `bin` 或 npm `files` 白名單；桌面 bundle 走獨立 `dist/desktop`，桌面發行產物走 `release/desktop`。
- D03: 桌面版採「完全同插件」監控寫入語意，可更新 `.cartridge/index.json` 與記憶卡警報區塊；記憶卡內容修復仍由使用者開檔處理。
- D04: 桌面版專案清單保存於使用者 AppData，不寫入被監控專案，避免跨專案設定污染。

## Known Issues

- 桌面版 v1 只以 Windows 為主要支援平台；跨平台行為需在後續版本另行驗證。

## Module Lessons

- L01: VSIX、npm MCP runtime 與 Desktop Console 必須維持發布入口分流，避免同一 tag 或同一打包流程同時改動多條產品線。

## Relations

- desktop-console.monitoring（子卡：純 Node 多專案監控 runtime）
- desktop-console.app（子卡：Electron 主程序、IPC、設定與通知）
- desktop-console.renderer（子卡：React + Fluent UI 桌面 UI）
- _system（系統技術棧與建構設定）
- _assets（README / CHANGELOG 文件）

## Applicable Skills

- code-quality
- ai-dev-quality-gate
- security-sre
