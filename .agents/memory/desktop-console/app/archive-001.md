# desktop-console.app Legacy Archive Volume 001

Migrated: 2026-06-04T07:15:00+08:00
Archive policy: schema v2 lazy upgrade preserved the original legacy SKILL.md content verbatim for trace-back.

## Original Legacy Content

---
name: desktop-console.app
description: >
  專案記憶：Electron 桌面外殼、IPC、系統匣、通知與專案清單設定。Use when: 修改桌面主程序、 預載橋接、AppData
  專案設定、桌面通知或桌面打包設定時載入。
last_updated: '2026-06-04T06:50:55+08:00'
status: active
staleness: 0
dependencies:
  - desktop-console.monitoring
  - _system
metadata:
  author: antigravity
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
---
# Desktop App Shell — 桌面外殼

## Tracked Files

- src/desktop/main.ts
- src/desktop/preload.ts
- src/desktop/ipc-channels.ts
- src/desktop/path-guard.ts
- src/desktop/window-behavior.ts
- src/desktop/project-store.ts
- src/desktop/desktop-notifier.ts
- src/tests/desktop-store.test.ts
- src/tests/desktop-path-guard.test.ts
- src/tests/desktop-window-behavior.test.ts
- src/tests/desktop-notifier.test.ts
- tsup.desktop.config.ts
- electron-builder.desktop.yml

## Key Decisions

- D01: Electron 主程序負責視窗、系統匣、通知、IPC 與專案監控器生命週期；renderer 不直接接觸 Node 檔案系統。
- D02: 預載橋接只暴露白名單操作：列出/加入/移除/暫停/恢復/掃描專案、開啟專案資料夾與開啟檔案。
- D03: 桌面專案清單寫入 Electron userData 目錄的 `desktop-projects.json`，並保存 enabled 狀態；不寫入被監控專案。
- D04: Electron app 的 main 透過 electron-builder `extraMetadata` 指向 `dist/desktop/main.js`，不修改 VSIX extension manifest 的 `main`。
- D05: dependency reason — `desktop-console.monitoring` 提供主程序啟動、停止、重掃與快照來源；若監控 runtime 的狀態契約或生命週期過期，Electron IPC 與通知行為必須重新檢查。
- D06: dependency reason — `_system` 持有 Electron、Vite、React、Fluent UI 與 electron-builder 版本及建構腳本；若桌面技術棧或輸出位置過期，桌面主程序與打包設定必須重新檢查。
- D07: Windows installer 使用 `desktop-assets/cartridge-desktop.ico`，圖示由既有 `assets/logo.png` 轉製，避免使用 Electron 預設 app icon，且不混入 npm runtime 的 `assets/**` 白名單。
- D08: IPC 開啟專案與開啟檔案操作必須通過 `path-guard`：root 需存在於目前監控快照，relative file path 不可為絕對路徑或跳出 project root；renderer 同時啟用 contextIsolation、nodeIntegration false 與 sandbox。
- D09: Windows 桌面版移除 Electron 預設 Application Menu，避免首次啟動只看到英文 File/Edit/View/Window 選單而誤判應用沒有內容。
- D10: 桌面設定與專案清單共用 `desktop-projects.json`，全域設定包含按 X 縮到系統匣、桌面通知與新手說明；設定保存於 Electron userData，不寫入被監控專案。
- D11: 視窗 close 事件依 `window-behavior` 判斷是否縮到系統匣；只有系統匣退出或明確退出流程會真正停止監控。
- D12: `desktop-notifier.ts` 不在 module load 階段直接載入 Electron Notification；改採 lazy loading 與可注入 notification API，避免 CI 單元測試依賴 Electron binary path。
- D13: Desktop IPC 操作型 API 改回傳 `DesktopOperationResult` 封套，讓 renderer 可辨識 success / cancelled / blocked / error；查詢型 API 維持原樣。
- D14: 主程序開啟專案與檔案時必須保留 path-guard 邊界，並將 `shell.openPath()` 的非空錯誤字串轉為 error 結果；對話框取消、未知專案與非法路徑不得安靜返回。

## Known Issues

- 無

## Module Lessons

- L01: 桌面打包必須和 VSIX/npm runtime 發布分流，否則 `package.json` 同時承載三條產品線時容易造成產物污染。
- L02: 2026-06-03 GitHub Windows runner 執行單元測試時，`electron` 套件可能尚未具備 `path.txt`；測試通知邏輯應使用注入物件，不應載入真實 Electron binary。
- L03: 操作者可見的桌面按鈕不可只依賴 Promise resolve；IPC 需要回傳可呈現的結果訊息，否則主程序成功、取消或被 path guard 阻擋都會被使用者看成「沒反應」。
- L04: 2026-06-04 桌面 IPC 結果封套與開檔錯誤語意已隨操作回饋維修回歸驗證；`npm run desktop:build` 會產出 `dist/desktop/main.js`，避免 Electron 預覽找不到 main bundle。
- L05: 2026-06-04 `desktop-store.test.ts` 不能把 Windows 樣本路徑硬寫為固定反斜線期望；Linux runner 會把 `D:/demo` 視為相對路徑，測試應用 `path.resolve()` 取得平台實際正規化結果。

## Relations

- desktop-console（parent card）
- desktop-console.monitoring（上游：多專案監控 runtime）
- desktop-console.renderer（下游：IPC 消費者）
- _system（建構與 dependency 設定）

## Applicable Skills

- security-sre
- plugin-release-governance
