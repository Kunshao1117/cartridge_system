# mcp-tools.project-context Legacy Archive Volume 001

Migrated: 2026-06-04T07:15:00+08:00
Archive policy: schema v2 lazy upgrade preserved the original legacy SKILL.md content verbatim for trace-back.

## Original Legacy Content

---
name: mcp-tools.project-context
description: >
  專案記憶：專案脈絡層 MCP 工具。Use when: 處理 project_context_list/read/validate/status、
  .agents/context/ CONTEXT.md 解析、專案脈絡狀態摘要或相關測試時載入。
last_updated: '2026-05-29T18:15:24+08:00'
status: stable
staleness: 0
dependencies:
  - core-types
  - mcp-tools.tool-registry
metadata:
  author: antigravity
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
    - 'terminal:test'
---

# Project Context Tools — 專案脈絡層 MCP 工具記憶

> 本子卡追蹤 `.agents/context/` 專案脈絡層的第一階段只讀 MCP 支援。此層級與 `.agents/memory/` 原始碼記憶平行，不參與 stale 計算，也不透過 `memory_commit` 核准或同步脈絡內容。

## Tracked Files

- src/project-context-types.ts
- src/project-context-registry.ts
- src/project-context-validation.ts
- src/project-context-tool-shared.ts
- src/project-context-tools.ts
- src/tests/project-context.test.ts

## Key Decisions

- D01: 第一階段只提供 read-only MCP 工具：`project_context_list`、`project_context_read`、`project_context_validate`、`project_context_status`；不新增 UI、自動寫入、候選寫入或核准工具。
- D02: 專案脈絡根目錄固定為 `.agents/context/`，脈絡卡檔名固定為 `CONTEXT.md`，避免被當成可執行 `SKILL.md`。
- D03: `project-context-types.ts` 持有狀態模型、必填 frontmatter、固定章節與 30 天 candidate 複審門檻；candidate 過久只回 warning，不自動升降級。
- D04: `project-context-registry.ts` 只掃描 `.agents/context/**/CONTEXT.md`，並提供安全 target 讀取；target 不接受絕對路徑或 `..` 路徑穿越。
- D05: YAML frontmatter 的 `last_reviewed` 可能被 `gray-matter` 解析成 Date，解析器會正規化為 `YYYY-MM-DD` 字串，確保 candidate stale 檢查穩定。
- D06: `project-context-validation.ts` 檢查 frontmatter 必填欄位、固定章節、approved approval、conflict 說明、candidate 過久與 `.agents/memory/**/CONTEXT.md` 誤放。
- D07: `project_context_status` 統計 approved、candidate、conflict、review、deprecated，並用 usage 區分可採用、只能提醒、必須詢問使用者與已淘汰脈絡。
- D08: 所有 project_context 工具使用 `mcp-response.ts` 統一 envelope；錯誤、findings 與 recommendedActions 必須維持 AI / Gateway 可解析格式。
- D09: 本模組不呼叫 `memory_commit`、不讀寫 `.agents/memory/` 記憶卡內容，也不把 project context 當作原始碼 tracked files 替代品。
- D10: dependency reason — `core-types` 持有 `path-guard.ts` 的 projectRoot 語意驗證；若路徑安全語義改變，project_context handlers 的輸入防線必須重新檢查。
- D11: dependency reason — `mcp-tools.tool-registry` 持有 MCP response envelope 與工具公開契約；若 envelope 或工具名冊語義改變，project_context schema、findings 與 recommendedActions 必須重新檢查。

## Known Issues

- 第一階段沒有 `project_context_write_candidate` 或 `project_context_approve`；若未來新增寫入能力，必須加明確 confirm 與 `GO CONTEXT` / `GO DNA` 核准防線。

## Module Lessons

- L01: 專案偏好與原始碼記憶要用平行工具層處理；把 candidate 當成 approved 或讓 context 參與 stale 都會破壞治理邊界。
- L02: YAML 日期解析是脈絡卡格式的實務風險；驗證邏輯不能假設 frontmatter 日期一定是字串。
- L03: 狀態摘要應給使用規則，而不是只回統計數字；AI 需要知道 approved 可作預設、candidate 只能提醒、conflict 必須詢問使用者。

## Relations

- mcp-tools（父卡：MCP 工具介面總覽）
- mcp-tools.tool-registry（工具名冊公開 project_context schema 與安全 metadata）
- mcp-tools.dispatcher（工具呼叫路由到 project_context handlers）
- mcp-tools.workspace-brief（消費專案脈絡摘要並轉為非阻塞開工提醒）
- core-types（依賴：projectRoot 路徑驗證與 MCP response envelope）

## Applicable Skills

- project-context-protocol
- memory-ops
- security-sre
- test-patterns
