# desktop-console.monitoring Legacy Archive Volume 001

Migrated: 2026-06-04T07:15:00+08:00
Archive policy: schema v2 lazy upgrade preserved the original legacy SKILL.md content verbatim for trace-back.

## Original Legacy Content

---
name: desktop-console.monitoring
description: >
  專案記憶：桌面版純 Node 多專案監控 runtime。Use when: 處理桌面監控核心、Node 檔案監聽、 多專案快照、共享 watcher
  規則或監控測試時載入。
last_updated: '2026-06-04T06:35:24+08:00'
status: active
staleness: 0
dependencies:
  - index-manager
  - extension.watcher
metadata:
  author: antigravity
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
---
# Desktop Monitoring — 桌面監控核心

## Tracked Files

- src/monitoring/file-list.ts
- src/monitoring/project-event-handler.ts
- src/monitoring/node-project-watcher.ts
- src/monitoring/project-snapshot.ts
- src/monitoring/project-monitor.ts
- src/monitoring/multi-project-monitor.ts
- src/tests/monitoring-event-handler.test.ts
- src/tests/desktop-snapshot.test.ts

## Key Decisions

- D01: `project-event-handler` 承接 VSIX watcher 與桌面 Node watcher 的共用事件語意，避免兩邊各自維護記憶卡優先、`.gitignore` 重載、幽靈檔案與未歸屬檔案規則。
- D02: Node watcher 使用 `fs.watch` recursive 監聽並搭配 300ms debounce；桌面監控 runtime 另以 60 秒重掃補漏，降低 Node 檔案監聽跨平台差異風險。
- D03: `CartridgeProjectMonitor` 只組合既有 `CartridgeIndexManager`、`StalenessAnalyzer`、`MemoryWriter` 與 `GitignoreFilter`，不修改高風險索引器與寫入器公開契約。
- D04: `MultiProjectMonitor` 以專案 root 分隔 runtime，每個專案獨立持有索引、watcher、心跳與錯誤狀態，避免多專案互相污染。
- D05: dependency reason — `index-manager` 持有索引結構、fileMap、pendingChanges、ghostFiles 與 untrackedFiles 契約；若其索引輸出或狀態生命週期過期，桌面多專案快照與事件處理必須重新檢查。
- D06: dependency reason — `extension.watcher` 是既有 VSIX watcher 語意來源；若插件 watcher 的事件順序、記憶卡優先規則或 `.gitignore` 行為過期，共用事件 helper 與桌面 watcher 必須重新檢查。
- D07: 桌面快照保留既有 summary counts，同時新增 pendingChangeFiles、ghostFilePaths、trackedFiles 與 guidance，讓 renderer 能顯示問題原因與處理導引，而不需要直接讀取索引或呼叫 MCP。
- D08: 未歸屬檔案快照保留 suggestedOwner，並補上 detectedAt、lastEvent 與 guidance；桌面版只引導開檔與人工歸屬，不自動寫入記憶卡正文。
- D09: 桌面快照會投影 `CartridgeEntry.compaction` 與 advisory count；compaction due / invalid 進入 blocking 導引，legacy schema、中文比例與 tracked files 超過 8 進入 review/advisory 導引，renderer 不重新解析記憶卡內容。

## Known Issues

- Node watcher 在網路磁碟或虛擬化環境可能漏事件；目前以定期重掃補漏，若後續仍不穩再評估更重的 watcher 方案。
- 2026-06-03 快照 wire shape 已擴充，Electron app 與 renderer 需使用新增細節欄位時仍保留舊 counts 作為排序與摘要來源。

## Module Lessons

- L01: `detectMissedChanges` 的過期分數會包含每日衰退，不應在測試中假設單次 change 永遠等於 10 分。
- L02: 桌面 UI 若要解釋「為什麼阻塞」，資料應由 project snapshot 投影提供；renderer 不應重新解析 `.cartridge/index.json`，否則會繞過監控 runtime 的單一資料來源。

## Relations

- desktop-console（parent card）
- desktop-console.app（下游：Electron 主程序消費多專案快照）
- extension.watcher（共享事件規則）
- index-manager（索引與未歸屬/幽靈狀態來源）

## Applicable Skills

- test-patterns
- code-quality
