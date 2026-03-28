---
name: mem-writer
description: >
  專案記憶：記憶卡寫入器模組。
  Use when: 處理警報植入、警報移除、記憶卡過期警示注入時載入。
last_updated: "2026-03-28T09:12:00+08:00"
status: stable
staleness: 0
---

# Memory Writer — 記憶卡寫入器記憶

## Tracked Files
- src/writer.ts

## Key Decisions
- D01: 使用 HTML 註解標記（WARNING_START/WARNING_END）標記警報區塊邊界，實現精確插入與移除
- D02: `injectWarning()` 先移除既有警報（idempotent），再植入新警報，避免重複堆疊
- D03: `checkAndCleanWarning()` 偵測 staleness === 0 且警報存在時，自動觸發清除動作
- D04: 警報植入時自動更新 frontmatter（staleness 值、status: stale）
- D05: 過期等級分兩種：🔴 嚴重（critical）和 🟠 顯著（warning）

## Known Issues
- 無

## Module Lessons
- D01: `matter.stringify()` 在前後新增 frontmatter 時，內容的前導換行需謹慎處理，否則警報移除後可能殘留空行

## Relations
- mem-watcher（上游事件驅動者，偵測到 staleness 重設時呼叫 checkAndCleanWarning）
- mem-analyzer（提供 getStalenessLevel() 判斷警報等級）
