# extension.governance-sidebar Legacy Archive Volume 001

Migrated: 2026-06-04T07:15:00+08:00
Archive policy: schema v2 lazy upgrade preserved the original legacy SKILL.md content verbatim for trace-back.

## Original Legacy Content

---
name: extension.governance-sidebar
description: >
  專案記憶：v5 獨立 Activity Bar 治理側邊欄。Use when: 修改 Cartridge Activity Bar
  container、治理總覽、上下文治理 findings、待處理項目或 VS Code TreeView provider 時載入。
last_updated: '2026-06-04T06:35:24+08:00'
staleness: 0
status: active
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
- D08: `ActionItemsProvider` 集中 stale、ghost、untracked、review advisory 與 context conflict；ghost 維持 modal 修復指引，untracked 走既有歸屬 QuickPick，review advisory 僅開啟相關記憶卡或提示複審工具。
- D09: v5.1 `GovernanceTreeProvider` 改以「AI 開工狀態」、「記憶卡健康」、「幽靈與未歸屬」、「規則檔檢查」呈現總覽，避免暴露 blocking/warning 等工程字眼。
- D10: v5.1 `ContextTreeProvider` 的 finding label 改用白話 message，code 放 description，tooltip 顯示 explanation 與 recommendedAction。
- D11: v5.1 `ActionItemsProvider` tooltip 顯示 reason 與 recommendedAction；ghost command 使用 `affectedPath`，避免白話 label 破壞原本幽靈檔案路徑參數。
- D12: Unreleased 卡匣機櫃入口 — `package.json` 在 governance overview 與 cartridge explorer 的 view title menu 暴露 `cartridge.openCabinetWorkbench`；本子卡測試只固定 manifest 入口，不追蹤 Webview 本體。
- D13: v5.3.4 插件更新檢查 — `governance-sidebar.test.ts` 固定 package manifest 已公開 `cartridge.checkForUpdates` 與 `cartridge.updateCheck.enabled`，避免命令面板入口或設定在後續側邊欄 manifest 調整中遺失。
- D14: v5.3.5 插件更新檢查按鈕 — `governance-sidebar.test.ts` 固定 `cartridge.checkForUpdates` 具有 `$(cloud-download)` icon，且同時出現在 `cartridgeGovernanceOverview` 與 `cartridgeExplorer` 的 view title menu。
- D15: v5.4.1 治理側邊欄把 indirect stale / parent-child advisory 呈現為 warning 等級「複審上游影響」項目；治理總覽可回 warning，但不把這類提示升級為記憶卡阻塞。
- D16: v5.5 治理側邊欄與待處理項目顯示 schema v2 compaction 訊號；compaction due / invalid / archive volume due 進入 blocking action item，legacy、中文比例、舊式 archive 遷移與 split suggestion 進入 advisory action item。

## Known Issues

- 大型卡匣機櫃工作台已拆到 `extension.cabinet-workbench` 子卡；本卡仍只負責原生 TreeView 與側邊欄入口測試。

## Module Lessons

- L01: VS Code manifest 的 container、views 與 commands 必須用 package-level 測試固定，避免後續改動把 `cartridgeExplorer` 退回 Explorer。
- L02: Provider 內應只負責 VS Code TreeItem 呈現；摘要與待辦轉換需保留在純 TypeScript model，方便 vitest 不依賴 VS Code runtime。
- L03: 側邊欄 item 的 `label` 可以給人看，但命令參數必須使用獨立欄位保存原始檔案路徑。
- L04: `governance-views.ts` 會 import 既有 `treeview-provider.ts` 並被 `extension.ts` import，應歸 extension 父卡，否則記憶卡工程依賴會形成父子循環。
- L05: Webview 工作台不應放進本卡追蹤；側邊欄卡只測 manifest 入口，避免 TreeView 與 Webview 模組互相污染。
- L06: manifest 級回歸測試可集中保護命令與設定公開面；若功能本體不屬側邊欄，測試仍可留在本卡作為 package manifest 防線。
- L07: 待處理清單的語氣要跟阻塞語義一致；非直接失真的連鎖提醒應用 warning icon 與複審文案，而不是修復/攔截語氣。

## Relations

- mcp-tools.context-governance（共用規則檔檢查概念）
- extension.cabinet-workbench（編輯區卡匣機櫃工作台）

## Applicable Skills

- code-quality
