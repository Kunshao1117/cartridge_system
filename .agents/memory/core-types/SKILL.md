---
name: core-types
description: |
  專案記憶：共用型別與設定模組。 Use when: 處理系統共用型別定義、設定工廠函式、預設參數時載入。
last_updated: '2026-05-06T07:05:44+08:00'
status: stable
staleness: 0
scopePath: src/
---


# Core Types & Config — 共用型別與設定記憶

> 本模組包含整個系統的共用型別定義和設定工廠函式，被幾乎所有其他模組引用。

## Tracked Files

- src/types.ts
- src/config.ts

## Key Decisions

- D01: CartridgeEntry 資料結構不包含 scopePath，廢除原有的基於目錄前綴推導歸屬機制的債務
- D02: StalenessLevel 四級制（healthy / mild / significant / critical）
- D03: CartridgeConfig 包含 projectRoot、skillsDir、memoryDir、excludeDirs、ignoreFiles、thresholds、scoring 七大設定區塊
- D04: createConfig() 工廠函式支援 Partial<CartridgeConfig> 覆蓋，預設值集中管理
- D05: getSkillsAbsPath() 從 config 動態組合操作技能目錄絕對路徑
- D06: ignoreFiles 清單用於排除系統產物（如 cartridge_index.json）不觸發過期計算
- D07: v4.0 路徑遷移 — 新增 memoryDir 欄位（預設 .agents/memory），搭配 getMemoryAbsPath() 輔助函式。skillsDir 保留給操作技能

## Known Issues

- 無

## Module Lessons

- D01: types.ts 是純型別定義檔（無執行邏輯），修改時需確認所有引用模組的型別相容性
- D02: config.ts 的 DEFAULT_EXCLUDES 清單需與 watcher 的實際排除邏輯保持一致（例如加入 `.cartridge` 避免無謂掃描）。
- D08: 新增之 config 管理有效將 memoryDir 和 skillsDir 切開，防止系統本身因結構目錄設計變化（如 v4.0）產生的降級相容錯誤。

## Relations

- analyzer（引用 CartridgeConfig、StalenessLevel、FileEventType）
- index-manager（引用 CartridgeConfig、CartridgeEntry、CartridgeIndex、getSkillsAbsPath）
- watcher（引用 CartridgeConfig、FileEventType）
- writer（引用 CartridgeConfig、StalenessLevel）
- injector（引用 CartridgeConfig、InjectionReportItem、InjectionStatus）
- extension（引用 createConfig）

## Applicable Skills

- code-quality
