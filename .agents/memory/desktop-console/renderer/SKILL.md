---
name: desktop-console.renderer
description: >
  專案記憶：桌面監控台 React + Fluent UI 渲染端。Use when: 修改多專案 UI、狀態卡、 專案詳情、桌面版樣式或 renderer
  build 設定時載入。
last_updated: '2026-06-04T06:35:24+08:00'
status: active
staleness: 0
dependencies:
  - desktop-console.app
metadata:
  author: antigravity
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
---
# Desktop Renderer — 桌面 UI

## Tracked Files

- src/desktop/renderer/App.tsx
- src/desktop/renderer/common.tsx
- src/desktop/renderer/main.tsx
- src/desktop/renderer/desktop-api.ts
- src/desktop/renderer/desktopStyles.ts
- src/desktop/renderer/detailStyles.ts
- src/desktop/renderer/issue-drawer.tsx
- src/desktop/renderer/overview.tsx
- src/desktop/renderer/project-detail.tsx
- src/desktop/renderer/settings-panel.tsx
- src/desktop/renderer/sidebar.tsx
- src/desktop/renderer/status.ts
- src/desktop/renderer/styles.css
- src/desktop/renderer/index.html
- src/tests/desktop-renderer-layout.test.ts
- desktop.vite.config.ts

## Key Decisions

- D01: UI 採 Fluent UI v9 作為 Windows 工具型桌面語言，避免桌面監控台長成網站 landing page。
- D02: 版面固定為左側多專案清單、中間總覽與待處理項目、右側單專案詳情，符合多 repo 監控的掃描與比較工作流。
- D03: renderer 透過 preload 暴露的 `cartridgeDesktop` API 呼叫 IPC，不直接 import Electron 或 Node API。
- D04: Vite renderer build 輸出至 `dist/desktop/renderer`，與 VSIX Webview 的 browser IIFE bundle 分開；桌面版必須設定相對 base，避免 Electron `file://` 載入時把 renderer asset 指到磁碟根層 `/assets`。
- D05: dependency reason — `desktop-console.app` 持有 preload API 與 IPC channel 契約；若主程序橋接或快照 wire shape 過期，renderer API 與 UI 狀態轉換必須重新檢查。
- D06: 空專案第一畫面必須直接提供「加入監控專案」按鈕，不能只依賴側欄 icon tooltip，否則初次啟動不易理解下一步。
- D07: 桌面 UI 採導引儀表板方向：左側專案清單、中間處理順序與新手說明、右側單專案詳情與設定；頁面本身不可產生水平捲軸。
- D08: 記憶卡詳情必須用可讀欄位呈現卡匣名稱、狀態、過期分數、待處理數與幽靈數，避免 `stale/pending/ghost` 字串黏在一起。
- D09: 右側卡匣表格不得設定大於面板寬度的 `minWidth`；欄位需用可壓縮 grid、ellipsis 與面板內垂直捲動承接窄寬度，避免桌面視窗出現水平捲軸。
- D10: 2026-06-03 視覺方向鎖定操作型控制台：降低大字、大卡片與強色塊，使用 compact panel、狀態 pill、細分隔線、固定列高與較安靜的背景，讓桌面工具可長時間掃描。
- D11: 分區滾輪回到 Electron renderer 原生捲動，不再攔截 wheel 事件；左側專案清單、中間總覽與右側詳情靠明確高度、`overflowY: auto` 與穩定捲軸承接滑鼠滾輪。
- D12: 設定入口只保留左側底部一處；設定內容以右側覆蓋抽屜呈現，不插入專案詳情內容流，避免壓縮卡匣列表與未歸屬區。
- D13: 右側記憶卡匣改成可掃描的 grid list，列表 viewport 獨立垂直滾動，卡匣名稱優先可讀，狀態與開啟操作維持同列。
- D14: 操作閉環改版後，App 入口只保留專案、設定與問題選取狀態；側欄、總覽、專案詳情、設定抽屜與問題導引拆成獨立 renderer 元件，避免單一 TSX 再度超過可維護閾值。
- D15: 中間處理順序是問題入口，點選阻塞、未歸屬、幽靈或複審後才開右側導引抽屜；初始總覽不自動遮住右側卡匣列表。
- D16: 問題導引抽屜只提供原因、檔案清單、開檔與複製提示，不自動修復記憶卡正文，維持桌面版「導引處理」而非「自動改卡」邊界。
- D17: 2026-06-03 右側優先版面修正後，三欄比例改為左側固定、中間收斂、右側放大；中間移除重複摘要列，右側卡匣列改為卡名優先的兩行式列表，避免長卡名被六欄表格壓縮。
- D18: 2026-06-03 專案語意修正後，中間主面板只顯示目前選取專案的處理順序；右側卡匣列表回到單行緊湊表列，指標合併為「過期 / 待 / 幽」摘要，完整原因交給導引抽屜承接。
- D19: 桌面操作回饋集中由 App 管理，所有 IPC 操作、設定更新、列表選取、導引開檔與複製提示都必須更新底部狀態列，避免操作者誤判按鈕沒有反應。
- D20: 移除監控專案必須先顯示 Fluent Dialog 二次確認；取消與確認後的結果都回寫狀態列，且不刪除被監控專案檔案。
- D21: 滾動修復維持原生 overflow 策略，不新增 wheel handler；左側、中間、右側、卡匣列表、未歸屬列表、設定面板與導引抽屜都靠明確 `minHeight`、`overflowY` 與穩定 scrollbar 承接滑鼠滾輪。
- D22: 桌面詳情與導引抽屜會顯示 schema v2 compaction 指標，包括 size、line count、cycle events、legacy、language ratio 與 split advisory；compaction due / invalid 顯示為 blocking，舊卡與拆卡建議顯示為 review/advisory。
- D23: 未歸屬檔案清單不得用 `slice()` 截斷顯示；多筆未歸屬檔案必須全部保留在原生滾動清單中，讓操作者能滾到底。

## Known Issues

- 2026-06-03 已用 packaged Electron 實機截圖檢查 1240x780、1600x900、1920x1080；三欄版面無頁面級水平捲軸，右側卡匣列表可獨立滾動，設定抽屜不再壓縮詳情內容。
- 2026-06-03 `desktop:dist` 打包通過；Electron Builder 仍會列出 duplicate dependency references 與 Node child-process deprecation warning，但未阻斷 installer 產出。
- 2026-06-03 操作閉環改版已用臨時 Electron QA harness 截圖驗收 1240x780、1600x900、1920x1080，涵蓋初始總覽、阻塞導引、未歸屬導引、幽靈導引與設定抽屜。
- 2026-06-03 右側優先版面已用臨時 Electron QA harness 重新截圖驗收 1240x780、1600x900、1920x1080；右側卡匣列表不再使用六欄窄表格，中間總覽只保留問題入口與簡短說明。
- 2026-06-03 專案語意與右側表列修正已用臨時 Electron QA harness 截圖驗收 1240x780、1600x900、1920x1080；中間標題改為目前專案待處理，右側卡匣列水平對齊。
- 2026-06-04 操作回饋與滾輪修正已通過 `npx tsc --noEmit`、桌面相關 vitest、完整 `npm test`（36 檔 / 279 案例）與 `npm run desktop:build`；尚未做 packaged Electron 實機滑鼠滾輪截圖驗收。

## Module Lessons

- L01: 桌面工具 UI 應維持高資訊密度與清楚狀態，而不是行銷型 hero 或大卡片首頁。
- L02: 若 Electron 視窗只剩白畫面，優先檢查 renderer build 的 asset URL；Vite 預設 `/assets/...` 不適合 packaged Electron 本機檔案模式。
- L03: 桌面版捲動優先使用原生 overflow 容器；自訂 wheel 正規化容易和 Electron / Windows 實際滑鼠行為脫節，只有在明確需要跨容器代理時才新增。
- L04: 桌面版若要補齊插件處理閉環，應先增加快照中的原因資料，再由 renderer 呈現導引；不要把核心監控流程或 MCP 工具線一起拉進 UI 改版。
- L05: 操作型桌面 UI 的「選取列」也需要狀態回饋；即使沒有 IPC，操作者仍需要確認目前右側導引與列表焦點已切換。

## Relations

- desktop-console（parent card）
- desktop-console.app（上游：IPC 與桌面狀態來源）

## Applicable Skills

- ai-dev-quality-gate
- ui-ux-standards
