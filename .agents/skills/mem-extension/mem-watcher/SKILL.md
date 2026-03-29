---
name: mem-watcher
description: |
  專案記憶：檔案監聯引擎模組。 Use when: 處理檔案監聽、chokidar設定、監聽生命週期管理時載入。
last_updated: '2026-03-30T03:13:03+08:00'
status: stable
staleness: 0
---

# Watcher Engine — 監聽引擎記憶

## Tracked Files
- src/watcher.ts

## Key Decisions
- D01: chokidar v4 使用 `watch(paths, options)` 一次性初始化（非鏈式呼叫）
- D02: 僅監聽記憶卡中明確追蹤的檔案，非整個專案目錄
- D03: start() 同時加入記憶卡 SKILL.md 路徑，用於偵測 AI 更新記憶
- D04: 偵測到 SKILL.md 變動時觸發特殊流程（讀取新 staleness → 若歸零則清除警報 → 重新掃描索引 → 刷新監聽清單）
- D05: D14 動態更新機制（refresh）— 每次 scan 後 diff 新舊路徑，動態 add/unwatch
- D06: start() 加入 scopePath 目錄監控 — 若記憶卡設有 scopePath，監聯該目錄以偵測新增檔案
- D07: handleEvent() 新增未追蹤檔案歸屬偵測 — 新增檔案（add 事件）若不在已追蹤清單中，透過 findOwner() 最長前綴匹配嘗試歸屬，匹配成功則加入該模組的 pendingChanges
- D08: refresh() 同步 scopePath 目錄 — 刷新監聽清單時一併處理 scopePath 路徑的新增/移除
- D09: handleSkillFileChange 的 cartridgeId 提取改用 lastIndexOf('SKILL.md') 取前一層目錄名，確保巢狀路徑下正確識別記憶卡

## Known Issues
- 無
## Module Lessons
- D01: watcher 與 UI 層必須透過 onUpdate 回調解耦
- D02: 在 Windows 上，不可用 path.resolve() + glob 字串（`mem-*/SKILL.md`）填入 chokidar.add()。`path.resolve` 把 `*` 當字面字符，導致 Windows 下靜默失效。正確做法是從索引取得每張記憶卡的精確絕對路徑連同加入。
- D03: 系統自動產出的檔案（如 cartridge_index.json）嚴禁被監聽，否則外掛寫入索引 → 觸發過期 → 寫入警報 → 再觸發…形成無限迴圈。已透過 config.ignoreFiles 在插件端硬性排除。
- D04: vitest 對 `node:fs` 的 vi.mock factory 存在 ESM interop 邊緣問題，新增於 mock factory 中的 `readFileSync` vi.fn() 在某些測試順序下會回傳意料之外的值。解決方案：避免在已用 vi.mock('node:fs') 的測試檔中新增使用 readFileSync 的 writer 方法，改在呼叫端（watcher）直接讀取。

## Relations
- mem-extension（父卡：外掛啟動後委託監聽）
- mem-analyzer（兄弟卡：接收異動事件的下游消費者）
- mem-index-manager（根層共用服務：提供需監聽的檔案清單）
