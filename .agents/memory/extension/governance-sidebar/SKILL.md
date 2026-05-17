---
name: extension.governance-sidebar
description: >
  專案記憶：v5 獨立 Activity Bar 治理側邊欄。Use when: 修改 Cartridge Activity Bar
  container、治理總覽、上下文治理 findings、待處理項目或 VS Code TreeView provider 時載入。
last_updated: '2026-05-17T23:41:06+08:00'
staleness: 0
status: stable
metadata:
  author: antigravity
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
---
# Extension Governance Sidebar — 獨立治理側邊欄

> 本子卡記錄 v5 將 Cartridge UI 從 Explorer 內嵌 view 升級為獨立 Activity Bar 側邊欄的設計、檔案歸屬與 v5.1 白話提示。

## Tracked Files

- src/governance-summary.ts
- src/governance-tree-provider.ts
- src/context-tree-provider.ts
- src/action-items-model.ts
- src/action-items-provider.ts
- src/tests/governance-sidebar.test.ts

## Key Decisions

- D01: 第一版側邊欄採 VS Code 原生 TreeView，不使用 Webview，降低啟動成本與 UI 維護面。
- D02: Activity Bar container id 固定為 `cartridgeGovernance`，title 為 `Cartridge`，icon 由 `assets/cartridge-activity.svg` 提供。
- D03: `cartridgeExplorer` 從 `views.explorer` 移至 `views.cartridgeGovernance`，保留既有記憶卡樹行為並新增點卡片開啟 SKILL.md。
- D04: 側邊欄分為四個 view：`cartridgeGovernanceOverview`、`cartridgeExplorer`、`cartridgeContextExplorer`、`cartridgeActionItems`。
- D05: `registerGovernanceViews()` 屬於 extension 父卡追蹤；本子卡只追蹤純 provider/model 檔，避免父卡啟動流程與側邊欄子卡互相依賴。
- D06: `GovernanceTreeProvider` 只做總覽摘要；memory 與 context readiness 由 `governance-summary.ts` 純函式轉換，方便單元測試。
- D07: `ContextTreeProvider` 只讀呈現 context audit findings，點擊 finding 或 asset 僅開啟對應檔案，不自動修改 `AGENTS.md`、`CLAUDE.md` 或記憶卡。
- D08: `ActionItemsProvider` 集中 stale、ghost、untracked 與 context conflict；ghost 維持 modal 修復指引，untracked 走既有歸屬 QuickPick。
- D09: v5.1 `GovernanceTreeProvider` 改以「AI 開工狀態」、「記憶卡健康」、「幽靈與未歸屬」、「規則檔檢查」呈現總覽，避免暴露 blocking/warning 等工程字眼。
- D10: v5.1 `ContextTreeProvider` 的 finding label 改用白話 message，code 放 description，tooltip 顯示 explanation 與 recommendedAction。
- D11: v5.1 `ActionItemsProvider` tooltip 顯示 reason 與 recommendedAction；ghost command 使用 `affectedPath`，避免白話 label 破壞原本幽靈檔案路徑參數。

## Known Issues

- 尚未做 Webview 儀表板；v5.0 范圍維持原生 TreeView。

## Module Lessons

- L01: VS Code manifest 的 container、views 與 commands 必須用 package-level 測試固定，避免後續改動把 `cartridgeExplorer` 退回 Explorer。
- L02: Provider 內應只負責 VS Code TreeItem 呈現；摘要與待辦轉換需保留在純 TypeScript model，方便 vitest 不依賴 VS Code runtime。
- L03: 側邊欄 item 的 `label` 可以給人看，但命令參數必須使用獨立欄位保存原始檔案路徑。
- L04: `governance-views.ts` 會 import 既有 `treeview-provider.ts` 並被 `extension.ts` import，應歸 extension 父卡，否則記憶卡工程依賴會形成父子循環。

## Relations

- mcp-tools.context-governance（共用規則檔檢查概念）

## Applicable Skills

- code-quality
