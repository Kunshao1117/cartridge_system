---
name: mem-watcher
description: |
  專案記憶：檔案監聯引擎模組。 Use when: 處理檔案監聽、chokidar設定、監聽生命週期管理時載入。
last_updated: '2026-03-28T17:10:00+08:00'
status: stable
staleness: 0
---

# Watcher Engine — 監聽引擎記憶

## Tracked Files
- src/watcher.ts

## Key Decisions
- D01: 使用 chokidar v4 作為檔案監聽器
- D02: 僅監聽記憶卡匣中明確追蹤的檔案，非整個專案目錄
- D03: 採用事件發送器模式向過期分析器傳遞異動事件
- D04: 同時監聽 mem-*/SKILL.md 以偵測 AI 重設 staleness 的動作
- D05: awaitWriteFinish 設定 300ms 穩定閾值避免重複觸發
- D06: handleEvent 中新增 ignoreFiles 豁免守衛，跳過外掛自身產出的檔案（如 cartridge_index.json），防止自我監聽迴圈
- D07: handleSkillFileChange 修正為「staleness=0 即同步」策略。與舊版的 `checkAndCleanWarning` 不同，新版先嘗試清除警告，若無警告但 frontmatter.staleness=0，仍然觸發快取同步。修復了 MCP `memory_update` 寫入乾淨 SKILL.md 後外掛忽略同步的問題。
- D08: refresh() 動態更新監聽清單。scan() 後自動 diff 新舊路徑，動態 add/unwatch，解決新增追蹤路徑需重啟 VS Code 才生效的問題

## Known Issues
- 無

## Module Lessons
- D01: watcher 與 UI 層必須透過 onUpdate 回調解耦
- D02: 在 Windows 上，不可用 path.resolve() + glob 字串（`mem-*/SKILL.md`）填入 chokidar.add()。`path.resolve` 把 `*` 當字面字符，導致 Windows 下靜默失效。正確做法是從索引取得每張記憶卡的精確絕對路徑連同加入。
- D03: 系統自動產出的檔案（如 cartridge_index.json）嚴禁被監聽，否則外掛寫入索引 → 觸發過期 → 寫入警報 → 再觸發…形成無限迴圈。已透過 config.ignoreFiles 在插件端硬性排除。
- D04: vitest 對 `node:fs` 的 vi.mock factory 存在 ESM interop 邊緣問題，新增於 mock factory 中的 `readFileSync` vi.fn() 在某些測試順序下會回傳意料之外的值。解決方案：避免在已用 vi.mock('node:fs') 的測試檔中新增使用 readFileSync 的 writer 方法，改在呼叫端（watcher）直接讀取。

## Relations
- mem-analyzer（接收異動事件的下游消費者）
- mem-index-manager（提供需監聽的檔案清單）
