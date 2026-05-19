---
name: core-types
description: |
  專案記憶：共用型別、設定與跨層小工具模組。 Use when: 處理系統共用型別定義、設定工廠函式、路徑驗證、時間戳或 staleness 等級轉換時載入。
last_updated: '2026-05-19T14:44:00+08:00'
status: stable
staleness: 0
scopePath: src/
metadata:
  author: antigravity
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
    - 'filesystem:write'
---

# Core Types & Config — 共用型別與設定記憶

> 本模組包含整個系統的共用型別定義和設定工廠函式，被幾乎所有其他模組引用。

## Tracked Files

- src/types.ts
- src/config.ts
- src/path-guard.ts
- src/staleness.ts
- src/timestamp.ts
- src/tests/path-guard.test.ts
- src/tests/staleness.test.ts
- src/tests/timestamp.test.ts

## Key Decisions

- D01: CartridgeEntry 資料結構不包含 scopePath，廢除原有的基於目錄前綴推導歸屬機制的債務
- D02: StalenessLevel 四級制（healthy / mild / significant / critical）
- D03: CartridgeConfig 包含 projectRoot、skillsDir、memoryDir、excludeDirs、ignoreFiles、thresholds、scoring 七大設定區塊
- D04: createConfig() 工廠函式支援 Partial<CartridgeConfig> 覆蓋，預設值集中管理
- D05: getSkillsAbsPath() 從 config 動態組合操作技能目錄絕對路徑
- D06: ignoreFiles 清單用於排除系統產物（如 cartridge_index.json）不觸發過期計算
- D07: v4.0 路徑遷移 — 新增 memoryDir 欄位（預設 .agents/memory），搭配 getMemoryAbsPath() 輔助函式。skillsDir 保留給操作技能
- D08: `staleness.ts` 提供 MCP 工具、workspace 摘要、analyzer 與 writer 共用的 healthy / mild / significant / critical 等級轉換，避免高階工具或寫入器依賴底層 handler / analyzer 大檔。
- D09: `path-guard.ts` 提供跨 MCP 工具共用的 projectRoot 路徑安全驗證，歸 core-types 持有可避免 workspace/commit 工具為路徑驗證依賴底層 handlers。
- D10: `timestamp.ts` 提供跨 index-manager、MCP handlers 與 MCP response envelope 共用的台灣時區時間戳，歸 core-types 持有可避免 tool-registry 或 index-manager 因時間戳工具反向依賴 handlers。
- D11: `getStalenessLevel()` 已由 `analyzer.ts` 移入 `staleness.ts`，讓 `writer.ts` 可共用過期等級判斷而不再 import analyzer，解除 extension analyzer/writer 工程循環。
- D12: v5.2 `path-guard.ts` 新增 projectRoot 身分比較 helper；Windows 會以 resolved path 小寫化比較，讓 Gateway/CLI workspace 與 tool argument 能判斷是否指向同一工作區。
- D13: v5.3.3 `path-guard.ts` 改為依輸入格式選擇 `path.win32` 或 `path.posix` 驗證，讓 Windows projectRoot 在 GitHub Ubuntu runner 與本機 Windows 都能一致通過，同時保留 `..` 片段防線。

## Known Issues

- 無

## Module Lessons

- D01: types.ts 是純型別定義檔（無執行邏輯），修改時需確認所有引用模組的型別相容性
- D02: config.ts 的 DEFAULT_EXCLUDES 清單需與 watcher 的實際排除邏輯保持一致（例如加入 `.cartridge` 避免無謂掃描）。
- D08: 新增之 config 管理有效將 memoryDir 和 skillsDir 切開，防止系統本身因結構目錄設計變化（如 v4.0）產生的降級相容錯誤。
- D09: staleness 等級轉換、path guard 與 timestamp 都屬跨 MCP handler、索引器與高階摘要的共用語義，歸 core-types 可避免 Memory Graph 中的工具層循環雜訊。
- L10: 過期等級轉換同時服務 analyzer 計分流程與 writer 警報呈現；若放在 analyzer 會讓 writer 反向依賴 analyzer，造成工程依賴循環。
- L11: projectRoot 驗證與 workspace 身分比較必須同屬 core-types，否則 dispatcher、commit_preflight、workspace_brief 會各自長出不一致的路徑判斷。
- L12: 路徑安全測試若使用 Windows 樣本，核心驗證不能依賴當前作業系統的 `path.isAbsolute`；否則本機 Windows 會通過、GitHub Ubuntu runner 會失敗。

## Relations

- analyzer（引用 CartridgeConfig、StalenessLevel、FileEventType）
- index-manager（引用 CartridgeConfig、CartridgeEntry、CartridgeIndex、getSkillsAbsPath）
- watcher（引用 CartridgeConfig、FileEventType）
- writer（引用 CartridgeConfig、StalenessLevel）
- injector（引用 CartridgeConfig、InjectionReportItem、InjectionStatus）
- extension（引用 createConfig）

## Applicable Skills

- code-quality
