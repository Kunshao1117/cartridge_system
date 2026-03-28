---
name: memory-ops
description: >
  記憶技能完整操作指引（讀取 / 更新 / 建立）。
  MCP Server: cartridge-system
  Use when: 建立、讀取或更新 mem-* 專案記憶技能時載入。本技能取代手動的 Markdown 編輯，強制執行合規自動化。
---

# Memory Skill Operations (記憶技能操作指引)

## 1. Core Mandate (支配規則)

所有的專案記憶 (`mem-*`) 更新皆 **禁止** 使用 `view_file` 或 `write_to_file` 手動操作。你必須依賴 `cartridge-system` MCP 工具來保證時區 (`+08:00`) 與過期指數 (`staleness`) 的絕對準確。

> **Timestamp Standard**: ALL timestamps MUST use `YYYY-MM-DDTHH:mm:ss+08:00`. UTC (`Z` suffix) is FORBIDDEN.

## 2. Reading Memory (載入記憶)

- IDE auto-injects `mem-*` names/descriptions at session start
- Load on-demand via `memory_read` when task involves tracked files
- **總覽** — 交接 (`/11_handoff`) 或需要一覽全局時，調用 `memory_list` 取得所有模組名稱與健康度
- **單模組** — 執行任務前提取系統前置脈絡時，調用 `memory_read` 傳入目標模組名稱（例如 `mem-_system`）

## 3. Updating Memory (更新記憶)

After modifying source files tracked by a memory skill, you **MUST** invoke `cartridge-system__memory_update`.

### Mode Selection Decision Tree (模式選擇決策樹)

```
需要更新記憶嗎？
├── 修改既有段落（追蹤檔案清單、架構說明、歷史決策）
│   ├── 改動多個區段或前言 → memory_read → 修改 → memory_update(mode: replace)
│   └── 只改 1-2 個 ## 或 ### 區段 → memory_update(mode: patch)，僅傳目標區段
│       ├── 提供的 ### 子區段會被替換，未提及的 ### 自動保留
│       └── 郍重更新前可加 dryRun: true 先預覽變更報告
│
└── 純粹追加新條目（教訓紀錄 Dxx、已知問題）
    └── → 直接 memory_update(mode: append)，無需先 read
```

- **`replace`**（預設）：傳入完整的 SKILL.md 內容，整張替換。適用於結構性修改。
- **`append`**：傳入要附加的差分段落，附加到現有內容末尾。適用於增量追加。
- **`patch`**：傳入包含 `##` 或 `###` 標題的區段，不含 frontmatter。系統自動執行兩層合併：
  - `##` 層：同名區段替換、新區段附加、未提及的區段保持不動
  - `###` 層：若 patch 包含子區段，只替換提及的 `###`，保留未提及的 `###`（最小匹配原則）
  - 支援 `dryRun: true` 參數，只回傳變更預覽不寫入磁碟
  - 回傳結構化 JSON 報告（含替換/新增/保留/移除清單、行數差異、警告）

### Post-Update Checklist

1. **Add lessons** — under `## Module Lessons` if reusable knowledge discovered (format: `Dxx: description`)
2. **Cross-module lessons** — log in `.agents/logs/episodic_log.md`

### Passive Safety Net (被動防護網)

If memory updates were missed during the workflow, two safety nets exist:

1. **Completion Gate** — forces a file-to-memory cross-reference check before reporting completion
2. **Commit Staleness Warning** — `/09_commit_log` compares `git diff` against tracked files and warns the Director before committing with stale memory

## 4. Creating New Memory (建立新記憶)

When `/02_blueprint` or `/08_audit` identifies a new module:

1. Create folder `.agents/skills/mem-{module}/`
2. Create `SKILL.md` with frontmatter + standard sections
3. Description MUST include Chinese keywords for Director instruction matching

> 完整模板見 `references/memory-template.md`

## 5. System Memory (系統記憶)

`mem-_system/SKILL.md` stores tech stack, host platform, and deployment config.
Same update rules apply.
