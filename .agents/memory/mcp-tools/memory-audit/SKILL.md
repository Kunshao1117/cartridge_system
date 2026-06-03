---
name: mcp-tools.memory-audit
description: >
  專案記憶：memory_audit 記憶卡完整健檢工具與舊格式相容提醒規則。Use when: 處理專案記憶卡 audit、compatibility
  mode、舊索引導入提醒或完整健檢測試時載入。
last_updated: '2026-06-04T06:35:24+08:00'
status: active
staleness: 0
dependencies:
  - core-types
  - index-manager
  - index-manager.dep-engine
  - mcp-tools.tool-registry
metadata:
  author: antigravity
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
---
# Memory Audit — 記憶卡完整健檢記憶

> 本模組提供只讀 `memory_audit` MCP 工具，並提供 `workspace_brief` / `commit_preflight` 共用的舊格式相容提醒規則。

## Tracked Files

- src/memory-audit.ts
- src/memory-compatibility.ts
- src/tests/memory-audit.test.ts

## Key Decisions

- D01: `memory_audit` 是第八個 MCP 工具，定位為深度健檢入口；它只讀 `.agents/memory`、相容讀取 `.agents/skills/mem-*` 舊卡與 `.cartridge/index.json`，不自動修復、不批次遷移。
- D02: `memory-audit.ts` 掃描 frontmatter 必要欄位、metadata、Tracked Files 區塊、絕對/穿越路徑、索引缺欄位、索引幽靈卡、dependencies 語義可疑項與 dependency cycle。
- D03: `memory-compatibility.ts` 提供輕量 compatibility report，讓 `workspace_brief` 與 `commit_preflight` 在日常流程中提醒 AI 執行 `memory_audit`，但不承擔完整掃描成本。
- D04: `memory_audit` 回傳遵守 `mcp-response.ts` envelope；`metadata.readOnly` 必須是 true，舊欄位或完整 findings 可放入 `legacy` 供既有呼叫者查閱。
- D05: 舊專案缺 `.cartridge/index.json` 不視為工具錯誤；`memory_audit` 應回 `warning` 與 compatibility mode，讓 AI 知道目前是導入整理問題。
- D06: 本卡實際依賴 `core-types` 的路徑驗證與 envelope metadata、`index-manager` 的 Tracked Files 解析、`index-manager.dep-engine` 的 dependency cycle/semantic 檢查，以及 `mcp-tools.tool-registry` 的 MCP envelope 契約；任一上游過期時，memory_audit 的健檢準確度都必須重新檢查。
- D07: `memory_audit` 的主要 cycle 判斷改用即時 frontmatter graph 與 engineering graph；`.cartridge/index.json` 的 persisted dependencies 只回報為 `persistedIndexCycles` 診斷資訊，不再讓舊索引殘留造成主要 warning。
- D08: `memory_audit` 會把 `staleness=0` 但 `pendingChanges` 未清的索引項標成 `INDEX_PENDING_WITH_ZERO_STALENESS`；這不是記憶內容過期，而是 `.cartridge/index.json` 同步狀態不一致，建議對該卡重新執行 `memory_commit`。
- D09: `memory_audit` 會檢查 schema v2 compaction 問題代碼：legacy schema、主卡過大、行數超限、根層索引超 8KB、Cycle Events 滿 30、Cycle Events 超過 30、平面歸檔卷超限、舊式 archive 目錄遷移、tracked files 超過 8 的拆卡 advisory 與中文比例過高，並提供 compact / open next archive / lazy upgrade / split suggestion / reduce Chinese body 建議。

## Known Issues

- 第一版只診斷，不提供批次修復工具；後續若要半自動修復，應另走明確 confirm 防線。

## Module Lessons

- L01: 舊專案導入提醒不應全部塞進 `workspace_brief`；日常入口只提示，完整細節交給 `memory_audit`。
- L02: `memory_audit` 可以檢查欄位語義可疑項，但不得取代 `D:\AI_Rules` 對 dependencies / Relations / Applicable Skills 的核心規範定義。
- L03: 全域 audit 與單卡 `memory_deps` 必須使用一致的主要 graph 口徑；persisted index 可協助追蹤索引殘留，但不可直接代表目前記憶卡語義或工程依賴。
- L04: 索引漂移測試應使用現代格式卡片加 `pendingChanges`，避免 compatibility warning 干擾 `INDEX_PENDING_WITH_ZERO_STALENESS` 的行為判讀。

## Relations

- mcp-tools（父卡：MCP 工具介面總覽）
- mcp-tools.workspace-brief（消費：compatibility warning）
- mcp-tools.commit-preflight（消費：compatibility warning）
- mcp-tools.dispatcher（消費：memory_audit handler）
- mcp-tools.tool-registry（共用：MCP envelope 契約）

## Applicable Skills

- memory-ops
- memory-arch
- test-patterns
