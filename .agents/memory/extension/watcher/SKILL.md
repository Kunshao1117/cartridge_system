---
name: watcher
description: |
  專案記憶：檔案監聯引擎模組。 Use when: 處理檔案監聽、chokidar設定、監聽生命週期管理時載入。
last_updated: '2026-04-09T18:56:37+08:00'
status: stale
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
- D06: start() 加入 scopePath 目錄監控 — 若記憶卡設有 scopePath，監聽該目錄以偵測新增檔案
- D07: handleEvent() 修正未追蹤檔案加入機制：不再嘗試歸屬。任何非受追蹤事件，如果是 unlink 刪除事件，則自幽靈池移除；如果是 `.gitignore` 變更，則 reload() 並重掃；否則加入幽靈清單。
- D08: refresh() 同步 scopePath 目錄 — 刷新監聽清單時一併處理 scopePath 路徑的新增/移除
- D09: handleSkillFileChange 的 cartridgeId 提取改用 lastIndexOf('SKILL.md') 取前一層目錄名，確保巢狀路徑下正確識別記憶卡
- D10: v4.0 路徑遷移 — 記憶卡自身變動偵測擴展至 .agents/memory/ 路徑，與舊 .agents/skills/ 取聯集
- D11: `.gitignore` 的儲存事件（`change`）被捕捉時，主動呼叫 `indexManager.refilterUntrackedFiles` 更新幽靈池
## Known Issues
- 無
## Module Lessons
- D01: watcher 與 UI 層必須透過 onUpdate 回調解耦
- D02: 在 Windows 上，不可用 path.resolve() + glob 字串（`*/SKILL.md`）填入 chokidar.add()。
- D03: 系統自動產出的檔案嚴禁被監聽，否則會形成無限迴圈。
- D04: vitest 對 `node:fs` 的 vi.mock factory 存在 ESM interop 邊緣問題。
- D05: v1.0 scopePath 技術債教訓 — 舊版的 scopePath 地盤宣稱還留在記憶卡中，導致新增檔案被靜默呑噥而非進入幽靈池。已全面移除。

## Relations
- extension（父卡：外掛啟動後委託監聽）
- analyzer（兄弟卡：接收異動事件的下游消費者）
- index-manager（根層共用服務：提供需監聽的檔案清單）

## Applicable Skills
- test-patterns
