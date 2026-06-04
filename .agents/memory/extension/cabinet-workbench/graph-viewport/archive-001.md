# extension.cabinet-workbench.graph-viewport Legacy Archive Volume 001

Migrated: 2026-06-04T07:15:00+08:00
Archive policy: schema v2 lazy upgrade preserved the original legacy SKILL.md content verbatim for trace-back.

## Original Legacy Content

---
name: extension.cabinet-workbench.graph-viewport
description: >
  專案記憶：卡匣機櫃圖譜視角狀態輔助層。Use when: 修改圖譜 viewport 保存、layout reason 判斷、 可讀 zoom clamp
  或相關回歸測試時載入。
last_updated: '2026-05-19T07:59:21+08:00'
status: stable
staleness: 0
metadata:
  author: antigravity
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
    - 'filesystem:write'
    - 'terminal:test'
---

# Cabinet Graph Viewport — 卡匣圖譜視角記憶

> 本子卡追蹤卡匣機櫃 Webview 圖譜的視角與 layout 狀態輔助層。它不擁有產品 UI，而是避免 `cabinet-webview.ts` 持續膨脹，並讓 pan、zoom、selection 與 layout 的邊界可測試。

## Tracked Files

- src/cabinet-graph-viewport.ts
- src/tests/cabinet-graph-viewport.test.ts

## Key Decisions

- D01: 每個艙位各自保存 `zoom` / `pan`，維護艙、記憶艙與結構艙切換後不共用視角，避免使用者在某一艙位調整後污染另一個艙位。
- D02: 本卡以 Relations 指向 `extension.cabinet-workbench`，但 helper 只接受最小結構型 `GraphCardSnapshot` / `GraphLineSnapshot` / `GraphLens`，不 import 父卡模型型別，避免父子工程依賴循環。
- D03: `GraphLayoutReason` 固定描述初次載入、艙位切換、內容變化與重置視角；點選卡匣、更新詳情、pan、zoom 不應產生重新 layout。
- D04: `layoutForLens()` 的 layout option 均設定 `fit:false`，由 Webview 在 layout stop 後以可讀 zoom clamp 主動 fit，避免 Cytoscape 自動把所有節點壓成不可讀的小群。
- D05: `buildGraphSignature()` 必須納入卡匣標題、狀態、分數、追蹤檔數與連線語意，避免模型內容變更但 signature 不變而跳過必要重排。
- D06: v5.3.3 新增 `clampUserZoom()` 與 `formatZoomPercent()`，讓前端按鈕縮放使用同一個可測試 helper。

## Known Issues

- 無

## Module Lessons

- L01: 圖譜縮放穩定性要把「內容是否變了」與「使用者只是移動視角」分開判斷；selection/focus 屬於視覺狀態，不應觸發 layout。
- L02: 自動 fit 後需要限制最低可讀 zoom，否則節點數一多會被壓成不可辨識的線團。
- L03: 子卡 helper 若被父卡 Webview import，helper 與測試不可 type-only import 父卡模型；TypeScript type-only import 仍會被工程圖視為依賴邊。
- L04: 使用者手動縮放與自動 fit 的上下限應分開測試；手動縮放走 Cytoscape min/max，自動 fit 走可讀性下限。

## Relations

- extension.cabinet-workbench（父卡：卡匣機櫃 Webview 與模型）

## Applicable Skills

- memory-ops
- ui-ux-standards
