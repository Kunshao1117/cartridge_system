---
name: extension.cabinet-workbench
description: >
  專案記憶：卡匣機櫃工作台。Use when: 修改編輯區 WebviewPanel、卡匣工作台模型、 V2 記憶卡 metadata
  解析、Cytoscape Webview 前端或卡匣機櫃測試時載入。
last_updated: '2026-06-04T06:35:24+08:00'
status: active
staleness: 0
dependencies:
  - core-types
  - index-manager
metadata:
  author: antigravity
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
---
# Cartridge Cabinet Workbench — 卡匣機櫃工作台記憶

> 本子卡記錄編輯區卡匣機櫃工作台。它使用 WebviewPanel 開啟精緻視覺介面，但產品語言維持卡匣、卡槽、訊號線與熱度線，不把 Cartridge System 轉成通用知識圖譜產品。

## Tracked Files

- src/cabinet-workbench-panel.ts
- src/cabinet-workbench-model.ts
- src/cabinet-workbench-derive.ts
- src/cabinet-memory-metadata.ts
- src/cabinet-workbench-html.ts
- src/cabinet-webview.ts
- src/tests/cabinet-workbench-model.test.ts
- src/tests/cabinet-workbench-html.test.ts

## Key Decisions

- D01: 卡匣機櫃使用 VS Code 編輯區 `WebviewPanel`，側邊欄只保留入口，避免把大型互動畫面塞進 TreeView。
- D02: 工作台資料層不修改核心 `CartridgeIndex` 介面；GitNexus impact 顯示該介面影響面為 CRITICAL，因此新增專用 `CabinetWorkbenchModel` 轉換層降低風險。
- D03: Webview 前端以 `cytoscape` 作為繪圖引擎，但使用者可見語言固定為卡匣、卡槽、訊號線、熱度線與狀態燈。
- D04: `cabinet-memory-metadata.ts` 讀取 V2 metadata 欄位（title、summary、tags、concepts、aliases），缺失時回退既有 description、Key Decisions、Module Lessons 與 Relations。
- D05: `tsup` 另建 browser IIFE bundle，輸出 `dist/cabinet-webview.global.js`；VSIX/npm 發布白名單已保留 `dist/*.js`，不需要把 `node_modules` 放進 VSIX。
- D06: dependency reason — `core-types` 持有 `CartridgeIndex` 與時間戳契約，若其型別或時間格式過期，卡匣工作台模型與 generatedAt 必須重新檢查。
- D07: dependency reason — `index-manager` 持有 `CartridgeIndexManager.getIndex()` 與索引生命週期，若其索引輸出或 RAM index 同步行為過期，WebviewPanel 顯示資料必須重新檢查。
- D08: 工作台 UI 採三艙位設計：維護艙看熱度/幽靈/待同步，記憶艙看決策/經驗/概念，結構艙看上下卡/依賴/追蹤檔，模式切換必須同步改變統計、篩選、圖譜樣式與詳情面板。
- D09: `cabinet-workbench-derive.ts` 集中放工作台衍生分數、三模式統計與 note 記憶連線，讓 `cabinet-workbench-model.ts` 維持資料組裝職責並避免核心 `CartridgeIndex` 介面擴張。
- D10: v5.3.2 圖譜狀態修復 — `cabinet-webview.ts` 只在模式、搜尋/篩選結果或重置視角時重排；點選卡匣只更新右側詳情與 focus class，不再觸發 layout。
- D11: 圖譜 viewport/layout 狀態已拆到 `extension.cabinet-workbench.graph-viewport` 子卡，父卡不追蹤 helper 檔，避免超過 8 個 tracked files。
- D12: v5.3.3 右下角控制列新增縮小、百分比、放大按鈕；按鈕縮放只更新 Cytoscape viewport 與百分比文字，不觸發 layout。
- D13: v5.4.1 卡匣工作台模型新增 `reviewScore` 承接 indirect staleness；`maintenanceScore` 與卡片健康燈號只看直接 stale、pending changes 與 ghost，避免間接過期改變卡片自身狀態。
- D14: v5.5 卡匣工作台模型與 Webview 新增 compaction due / advisory 訊號；due/invalid 可提高維護分數與 critical 樣式，legacy、中文比例與 split suggestion 只進入 advisory 篩選與詳情，不把 tracked files 超過 8 單獨染成阻擋。

## Known Issues

- 無

## Module Lessons

- L01: 大型互動工作台應作為編輯區 WebviewPanel，不應擴充原生 TreeView 的職責。
- L02: 圖譜能力是底層技術；對外命名仍應維持 Cartridge System 的卡匣機櫃隱喻。
- L03: 新 Webview 前端若依賴第三方視覺套件，必須打包成 dist 靜態 JS，因 `.vscodeignore` 會排除 `node_modules/**`。
- L04: 記憶模式不能只依賴既有依賴線；若沒有 note 線也要透過記憶分數、詳情內容與模式專屬 layout 形成明顯差異。
- L05: Cytoscape 的 layout、fit 與使用者 viewport 要分層處理；若 render 時總是 remove/add + layout，縮放和平移會被重設。
- L06: 圖譜控制文字要以使用者意義命名；縮放百分比可兼作回到 100% 的明確入口，比工程縮寫更容易理解。
- L07: 工作台健康燈號必須表示卡片自身直接狀態；傳播影響適合放在複審提醒、篩選與輔助統計，避免父子卡連鎖染色。

## Relations

- extension（parent card: VS Code commands 與治理側邊欄註冊）
- extension.governance-sidebar（卡匣機櫃入口由側邊欄標題列與 command manifest 暴露）
- extension.cabinet-workbench.graph-viewport（圖譜視角保存、layout reason 與可讀 zoom helper）

## Applicable Skills

- code-quality
- ui-ux-standards
