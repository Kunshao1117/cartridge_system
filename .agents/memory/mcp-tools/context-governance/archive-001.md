# mcp-tools.context-governance Legacy Archive Volume 001

Migrated: 2026-06-04T07:15:00+08:00
Archive policy: schema v2 lazy upgrade preserved the original legacy SKILL.md content verbatim for trace-back.

## Original Legacy Content

---
name: context-governance
description: >
  專案記憶：v5 規則檔檢查工具。Use when: 處理 context_inventory、context_audit、
  context_diff、context_plan、AI 規則來源掃描或跨代理規則衝突偵測時載入。
last_updated: '2026-05-17T23:39:29+08:00'
status: stable
staleness: 0
dependencies:
  - core-types
  - index-manager
  - mcp-tools.tool-registry
metadata:
  author: antigravity
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
    - 'filesystem:write'
---
# Context Governance — v5 規則檔檢查記憶

> 本模組承接 v5 只讀規則檔檢查能力，將 Codex、Claude、Copilot、Antigravity 與記憶卡規則來源轉成可讀清冊、衝突提醒與整理建議。

## Tracked Files

- src/context-types.ts
- src/context-contract.ts
- src/context-registry.ts
- src/context-audit.ts
- src/context-tools.ts
- src/tests/context-governance.test.ts

## Key Decisions

- D01: v5.0 第一階段只做 read-only context governance，不新增任何自動改寫、修復或提交工具，避免擴大 MCP 寫入面。
- D02: `context-types.ts` 定義規則來源資料：owner、scope、priority、supportedAgents、trackedFiles、dependencies、staleness、risk、signals，以及 v5.1 finding 的 explanation、paths、blocking、recommendedTool、recommendedAction。
- D03: `context-contract.ts` 持有靜態上下文資產定義、治理訊號解析、SKILL.md contract 建構與 inventory totals 彙整，讓 `context-registry.ts` 維持掃描流程職責。
- D04: `context-registry.ts` 掃描 Codex `AGENTS.md`、Claude `CLAUDE.md` / `.claude/skills` / `.claude/agents`、GitHub Copilot instructions、Antigravity `.agents/skills` 與 Cartridge `.agents/memory`。
- D05: 記憶卡 context asset 會重用 `parseTrackedFiles()` 解析 `## Tracked Files`，因此 `index-manager` 過期時本模組也需重新檢查 tracked file contract。
- D06: `context-audit.ts` 將提交授權與寫入政策衝突列為 blocking；語言規則差異只列 warning，重複規則只列 informational，避免把合法 scope 差異誤判成阻塞。
- D07: `context-tools.ts` 提供 `context_inventory`、`context_audit`、`context_diff`、`context_plan` 四個 MCP handler，全部 readOnly=true 並使用統一 envelope。
- D08: `mcp-tools.tool-registry` 是本模組的工具公開契約上游；新增、改名或調整 context 工具 schema 時必須同步 registry 與 dispatcher。
- D09: `core-types` 是本模組的實際 dependency：`context-tools.ts` 使用路徑驗證與 MCP response envelope，`context-contract.ts` 透過既有記憶卡解析 contract 維持 tracked file 相容；若 core 型別或 envelope 改變，本模組必須重新檢查。
- D10: v5.1 `context_audit` finding 需回白話 `message`、詳細 `explanation`、可開啟的 `paths`、是否阻塞的 `blocking` 與建議工具，讓側邊欄與 AI 開工清單可直接呈現。
- D11: `context_plan` 的建議文字改為白話只讀整理建議，明確說明不自動改 `AGENTS.md`、`CLAUDE.md` 或記憶卡。

## Known Issues

- v5.0 不讀取 GitHub Copilot path-specific instructions 或 VS Code custom agents；目前僅支援計畫中指定的核心位置。
- v5.1 仍不做自動修復；若 audit 出現 blocking conflict，只回報 findings 與 plan，後續寫入工具需另以 confirm-gated 設計。

## Module Lessons

- L01: 規則檔檢查比記憶卡治理更容易產生誤報；只有提交授權與寫入政策這類高風險衝突應阻擋，其餘差異先以 warning/info 呈現。
- L02: 規則來源掃描應允許目標目錄不存在並回傳缺失資產，而不是把跨代理支援不足視為工具錯誤。
- L03: v5 context tools 要保持快速與副作用為零，避免 `workspace_brief` 這類開工入口變成隱性重掃或修復流程。
- L04: finding 的第一層文字要給人看，機器需要的 code 與 asset id 保留在欄位中即可。

## Relations

- mcp-tools（父卡：MCP 工具介面總覽）
- mcp-tools.tool-registry（依賴：工具 metadata 與 envelope 契約）
- mcp-tools.dispatcher（消費：context tool handlers）
- mcp-tools.workspace-brief（消費：context readiness）
- core-types（依賴：路徑驗證與 MCP response envelope）
- index-manager（依賴：Tracked Files parser）

## Applicable Skills

- memory-ops
- security-sre
- test-patterns
