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

## 3. Repairing Stale Memory (過期修復)

When a memory cartridge has staleness > 0, you **MUST NOT** simply call `memory_update` to reset staleness. Follow this repair procedure:

### Staleness Repair Procedure (過期修復流程)

```
發現過期記憶卡？
├── 步驟 1：呼叫 memory_status(moduleName) ← 診斷過期狀態
│   ⇒ 取得：過期指數、異動檔案清單（含絕對路徑）、行動指引
├── 步驟 2：呼叫 view_file 讀取每個異動檔案
│   ⇒ 理解原始碼的最新狀態
├── 步驟 3：呼叫 memory_read(moduleName)
│   ⇒ 讀取現有記憶內容
├── 步驟 4：比對原始碼變更 vs 現有記憶
│   ⇒ 產出更新後的記憶內容（更新決策/已知問題/教訓等區段）
└── 步驟 5：呼叫 memory_update(mode: patch 或 replace)
    ⇒ staleness 自動歸零 + pendingChanges 自動清除
```

> **核心原則**：過期修復的目的是「同步記憶與原始碼」，不是「消除警報」。staleness 歸零只是原始碼同步完成後的副作用。

## 4. Updating Memory (更新記憶)

After modifying source files tracked by a memory skill, you **MUST** invoke `cartridge-system__memory_update`.

### Mode Selection Decision Tree (模式選擇決策樹)

```
需要更新記憶嗎？
├── 🔍 粒度前置檢查：目標記憶卡的 trackedFiles 超過 8 個？
│   └── 是 → 暫停更新。先執行 § 5.6 拆分流程
│       → 向 Director 提出拆分建議（說明拆法）
│       → Director 批准後執行拆分，再更新對應的子卡
├── 修改既有段落（追蹤檔案清單、架構說明、歷史決策）
│   ├── 改動多個區段或前言 → memory_read → 修改 → memory_update(mode: replace)
│   └── 只改 1-2 個 ## 或 ### 區段 → memory_update(mode: patch)，僅傳目標區段
│       ├── 提供的 ### 子區段會被替換，未提及的 ### 自動保留
│       └── 慎重更新前可加 dryRun: true 先預覽變更報告
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

## 5. Creating New Memory (建立新記憶)

When `/02_blueprint` or `/08_audit` identifies a new module:
1. Create folder `.agents/skills/mem-{module}/`
2. Create `SKILL.md` with frontmatter + standard sections
3. Description MUST include Chinese keywords for Director instruction matching
4. Set `scopePath` frontmatter field when applicable

### Nesting Decision Tree (層級判斷決策樹)

```
建立新記憶卡？
├── 這個模組屬於已存在的功能域記憶卡嗎？
│   ├── 否 → 建在 .agents/skills/ 根層（第 1 層）
│   └── 是 → 父卡當前的 depth < 4 嗎？
│       ├── 否 → 已達深度上限，建在父卡同層（維持扁平）
│       └── 是 → 建在父卡目錄下的子目錄中
│           ⇒ 路徑：.agents/skills/{parentName}/mem-{child}/SKILL.md
└── 判斷依據：
    ├── scopePath 有包含關係？（子卡的 scopePath 是父卡 scopePath 的子路徑）
    ├── 修改子卡時通常也需要參考父卡的共用決策？
    └── 同一功能域下有 3+ 個模組可行獨立追蹤？
```

> 完整模板見 `references/memory-template.md`

## 5.5 Tree Structure (樹狀結構指南)

記憶卡支援父子層級，**目錄結構即層級**：

- 第 1-2 層記憶卡放在 `.agents/skills/` 直接子目錄（IDE 會自動注入名稱）
- 第 3-4 層記憶卡放在**父卡的子目錄**中（IDE 看不到，AI 讀取父卡後按需載入）
- 最大深度：**4 層**
- **`scopePath`**（可選）：該記憶卡負責的目錄前綴，用於新檔案歸屬

### Directory Example (目錄範例)

```
.agents/skills/
├── mem-api/                      ← 第 1 層（功能域） depth=1
│   ├── SKILL.md                  ← 共用 API 架構決策
│   ├── mem-api-auth/             ← 第 2 層 depth=2, parent='mem-api'
│   │   ├── SKILL.md              ← 認證模組特定決策
│   │   └── mem-api-auth-oauth/   ← 第 3 層 depth=3
│   │       └── SKILL.md          ← OAuth 子模組
│   └── mem-api-manage/           ← 第 2 層 depth=2, parent='mem-api'
│       └── SKILL.md              ← 管理功能模組
└── mem-frontend/                 ← 第 1 層（獨立功能域）
    └── SKILL.md
```

### Loading Nested Cards (子卡載入流程)

1. IDE 只注入第 1-2 層的名稱和描述
2. AI 讀取父卡後，從 `## Relations` 區段發現子卡存在
3. 按需呼叫 `memory_read(子卡名)` 載入深層記憶
4. `resolveSkillPath` 自動處理巢狀路徑解析，AI 無需知道實際目錄位置

### Granularity Principle (粒度判斷原則)

> 一張記憶卡 = 一個獨立變更單元。如果修改 A 時通常不需要同時修改 B，則 A 和 B 應在不同記憶卡。

- 單張記憶卡追蹤不超過 **8 個檔案**
- 超過時 `memory_list` 會主動提示拆分建議

## 5.6 Splitting Memory Cards (拆分操作步驟)

當系統提示某張記憶卡過大，或在日常工作中發現維護困難時：

```
需要拆分記憶卡嗎？
├── 步驟 1：呼叫 memory_read 取得舊卡完整內容
│   ⇒ 分析 trackedFiles 的目錄分佈和 Key Decisions 的歸屬
├── 步驟 2：向 Director 提出拆分建議
│   ⇒ 說明哪些決策提升為共用（父卡）、哪些下放（子卡）
├── 步驟 3：Director 批准後執行
│   ├── 將原卡提升為父卡（保留共用決策 + scopePath）
│   ├── 在父卡目錄下建立子卡子目錄（各含 scopePath + 特定決策）
│   └── memory_update 更新父卡內容（精簡為共用部分）
└── 步驟 4：外掛自動 scan + refresh
    ⇒ 索引和監聽器自動更新
```

## 6. System Memory (系統記憶)

`mem-_system/SKILL.md` stores tech stack, host platform, and deployment config.
Same update rules apply.
