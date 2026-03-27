---
name: mem-watcher
description: >
  專案記憶：檔案監聽引擎模組。
  Use when: 處理檔案監聽、chokidar設定、監聽生命週期管理時載入。
last_updated: "2026-03-28T06:01:58+08:00"
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

## Known Issues
- 無

## Module Lessons
- D01: watcher 與 UI 層必須透過 onUpdate 回調解耦
- D02: 在 Windows 上，不可用 path.resolve() + glob 字串（`mem-*/SKILL.md`）填入 chokidar.add()。`path.resolve` 把 `*` 當字面字符，導致 Windows 下靜默失效。正確做法是從索引取得每張記憶卡的精確絕對路徑連同加入。

## Relations
- mem-analyzer（接收異動事件的下游消費者）
- mem-index-manager（提供需監聽的檔案清單）
