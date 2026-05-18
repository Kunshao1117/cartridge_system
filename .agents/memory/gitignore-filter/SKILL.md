---
name: gitignore-filter
description: >
  專案記憶：Gitignore 排除引擎模組。讀取 .gitignore 規則進行路徑排除過濾。Use when:
  涉及檔案掃描、監聽排除、未歸屬檔案偵測時載入。
last_updated: "2026-05-18T15:35:34+08:00"
status: stable
staleness: 0
metadata:
  author: antigravity
  version: "1.0"
  origin: project
  memory_awareness: full
  tool_scope:
    - "filesystem:read"
---

# GitignoreFilter — Gitignore 排除引擎記憶

## Tracked Files

- src/gitignore-filter.ts
- .gitignore

## Key Decisions

- D01: 使用 `ignore` npm 套件解析 .gitignore 規則（npm 週下載量 30M+，ESLint/Prettier 共用核心）
- D02: 強制排除 `.git` 目錄作為安全網（即使 .gitignore 不存在）
- D03: scanDirectory() 在遞迴時進行提前剪枝，命中 gitignore 的目錄不再深入
- D04: 提供四個公開介面：isIgnored()、filterPaths()、scanDirectory()、reload()
- D05: 路徑正規化使用 `/` 分隔符（Windows 反斜線自動轉換），確保跨平台一致
- D06: `reload()` 允許重新載入 `.gitignore` 內容（用以在修改 `.gitignore` 時即時更新過濾機制）
- D07: `.vscodeignore` 必須可被 Git 追蹤，否則 GitHub Actions 打包 VSIX 時會缺少排除規則並把 CI / source 相關檔案包進插件；`.gitignore` 不再忽略 `.vscodeignore`。

## Known Issues

- 無

## Module Lessons

- D01: ignore 套件內部使用 Trie 結構，單次查詢 O(path_length)，效能影響可忽略
- D07: filterPaths 搭配忽略 `.git` 已能穩固應付巨量掃描，並能有效阻絕潛在的路徑穿越與掃描無限迴圈。
- L03: (2026-05-18) 為支援 VSIX 自動發版，`.gitignore` 移除 `.vscodeignore` 排除規則；`.vscodeignore` 由版本控制提供給 GitHub Actions，並額外排除 `.github/**`。

## Relations

- index-manager（根層模組：detectUntrackedFiles 傳入 GitignoreFilter 實例）
- watcher（extension 子卡：chokidar ignored 回呼使用 GitignoreFilter）
- extension（extension 子卡：啟動時初始化 GitignoreFilter 實例）

## Applicable Skills

- test-patterns
