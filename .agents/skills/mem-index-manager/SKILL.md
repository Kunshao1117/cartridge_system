---
name: mem-index-manager
description: >
  專案記憶：記憶索引管理器模組。
  Use when: 處理卡匣索引、檔案反向映射、持久化讀寫時載入。
last_updated: "2026-03-28T06:01:58+08:00"
status: stable
staleness: 0
---

# Cartridge Index Manager — 索引管理器記憶

## Tracked Files
- src/index-manager.ts
- cartridge_index.json

## Key Decisions
- D01: 索引持久化為 JSON 格式（cartridge_index.json）
- D02: 維護雙向映射：卡匣→檔案 與 檔案→卡匣
- D03: 啟動時自動掃描 .agents/skills/mem-*/SKILL.md 建立索引
- D04: 追蹤檔案解析使用正則表達式匹配 ## Tracked Files 區段
- D05: 路徑正規化使用 forward slash 以跨平台相容

## Known Issues
- 無

## Module Lessons
- D01: staleness 重設後必須同步呼叫 clearPendingChanges()，否則去重邏輯會封鎖後續的相同檔案事件，導致再次修改無法觸發計分。

## Relations
- mem-watcher（提供監聽檔案清單）
- mem-analyzer（接收過期指數更新）
- mem-mcp-tools（第二階段對外暴露查詢能力）
