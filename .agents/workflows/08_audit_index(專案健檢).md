---
description: 全光譜專案健檢 — 工作空間安全、安全架構、記憶技能完整性、原始碼邏輯、測試覆蓋、API 串接、效能與可維護性。
required_skills:
  [
    memory-ops,
    tech-stack-protocol,
    delegation-strategy,
    code-audit,
    audit-engine,
    code-quality,
    security-sre,
    impact-test-strategy,
    performance-audit,
    test-patterns,
    a11y-testing,
    trunk-ops,
  ]
memory_awareness: full
---

# [WORKFLOW: AUDIT & MEMORY HEALTH (專案健檢)]

> **Required Skills**: 見 YAML `required_skills` 欄位。

## 1. Global Workspace Security Scan

- Scan `package.json`, `requirements.txt`, or equivalent for deprecated packages/CVEs.
- Scan for hardcoded API keys, orphaned files, and unused dependencies.

## 2. Memory Skill System Initialization Check

- Resolve two independent paths and store as variables for the entire workflow:
  - `workspace_root` = the IDE workspace directory (contains `.agents/` and `.gemini/`). CLI starts here.
  - `project_root` = the source code root (contains `package.json` / `src/`). May be `workspace_root` itself or a subdirectory.
  - `agents_dir` = `workspace_root/.agents`
- Detect the project source code root directory within the workspace. Store as `project_root`.
- If no memory cards exist in `.agents/memory/`:
  - Prompt the Director to run `/02_blueprint` to initialize the memory skill system.
  - Report: "記憶技能系統尚未初始化。"
- If `_system/SKILL.md` does NOT exist in `.agents/memory/` but other memory cards do:
  - Execute Migration Protocol to create the system memory skill.

## 3. Progressive Memory Skill Mapping

```
[ARRAY TRAVERSAL GATE] Memory skill mapping:
├── Step 1: Build component_array[] from all memory cards.
├── Step 2: FOR i = 0 TO component_array.length - 1:
│   ├── Process component_array[i] → view_file its SKILL.md.
│   ├── DO NOT skip any index.
│   └── Mark as [CHECKED].
├── Step 3: Verify ALL indices marked [CHECKED].
│   └── Any unchecked? → [HALT] 「🔴 [AUDIT HALT] 陣列遍歷不完整。」
└── Gate cleared → Proceed to Phase B.
```

- **Absolute Rule**: Do NOT scan or map directories matching `.git`, `node_modules`, `venv`, `__pycache__`, `dist`, `build`, `.next`, or any binary/image files.
- **Phase A (Structure Scan)**: Scan the project directory tree from `project_root`. List all existing memory cards in `.agents/memory/`. For each, `view_file` its `SKILL.md` — do NOT skip reading the actual content.
- **Phase B (Gap Detection)**: Identify source files/modules NOT covered by any existing memory card's `## Tracked Files`.
  - For each uncovered module: check if it belongs to an existing functional domain card (using `scopePath` containment). If yes, create as a nested child card. If no, create at root level. Follow the Nesting Decision Tree in `memory-ops` skill § 5.
  - Populate with auto-detected tracked files, key decisions, bilingual `description` (English + Chinese keywords), and relations.
- **Phase C (Staleness & Schema Check)**: For each existing memory card, `view_file` the `SKILL.md` and validate:
  1. **Schema Compliance**: All required sections per `memory-ops` skill are present (frontmatter with `last_updated`, `status`, `staleness` + body with `Tracked Files`, `Key Decisions`, `Known Issues`, `Module Lessons`, `Relations`, `Applicable Skills`).
  2. **Field Type Check**: `status` is one of `stable`, `in_progress`, `deprecated`. `staleness` is a number.
  3. **Tracked File Verification**: Each `## Tracked Files` entry exists on disk.
  4. **Staleness Evaluation**: Read `staleness` value.
  5. **Granularity Check**: Count tracked files. If > 8, flag as 🟡 and include split suggestion in the report. Scan nested subdirectories for child cards (max depth 4). If `scopePath` is missing, note as upgrade candidate.
  - If `staleness` > 10, trigger an automatic regeneration of the skill content.
  - If ALL tracked files are gone → move the entire skill folder to `_archived/`.
  - If SOME tracked files changed → update the skill and reset `staleness` to 0.
- **Phase D (System Memory Refresh)**: `view_file` the project's dependency files (`package.json`, `requirements.txt`, `go.mod`, or equivalent if they exist). Compare against `.agents/memory/_system/SKILL.md` tech stack sections. Flag any discrepancies and update if needed.
- **Phase E (Cross-Reference Integrity)**: For each card's `## Relations`, verify each referenced memory card exists. Flag any orphaned references pointing to non-existent or archived cards.
- **Phase F (Workflow-Skill Binding)**: For each workflow file in `.agents/workflows/`, read its YAML frontmatter `required_skills` and `memory_awareness` fields. Verify each listed skill has a corresponding folder in `.agents/skills/`. Verify `memory_awareness` is one of `none`, `read`, `full`. Verify each skill's `tool_scope` metadata field exists and contains valid category values (`filesystem:read`, `filesystem:write`, `mcp:{server}`, `browser`, `terminal`). Flag any broken bindings or missing fields.
- **Phase G (Project Skills Health — 專案衍生技能健康檢查)**: Scan `.agents/project_skills/` directory:
  1. Count total project skills. Verify each has a valid SKILL.md with compliant frontmatter (`metadata.origin: project`).
  2. Check for stale or unused project skills — if a skill has not been referenced by any workflow or memory card in the current session context, flag as a candidate for archival.
  3. Verify naming compliance (kebab-case, 1-64 characters).
  4. If recurring patterns are detected across 3+ module memory cards that are NOT covered by any existing skill, RECOMMEND creating a new project skill.

## 3.5 Source Code Deep Audit（原始碼深度審計）

> **Execution Condition**: This section ONLY executes when memory cards contain non-empty `## Tracked Files`. If the project is a pure framework/ruleset (e.g., Antigravity itself), output: 「本專案無應用程式原始碼，跳過深度審計。」 and skip to §4.

### Step 1: CLI Tool Scan (CLI 工具掃描 — 無條件強制委派)

> [!IMPORTANT]
> **[無條件強制委派 CLI — 零例外]**
> 必須無條件啟動 CLI 子代理執行工具掃描。不得以任何理由跳過。跳過此步驟視為流程安全違規。

依 `delegation-strategy` 技能 `references/cli-delegation-sop.md` 檔案傳令模式執行：

1. **構建任務檔案**：依 `code-audit` 技能 §1 程序，讀取 `references/scan-task-prompt.md` 構建任務描述，並在任務描述中額外加入以下腳本命令：
   ```powershell
   pwsh .agents/scripts/Invoke-HealthAudit.ps1 -ProjectRoot {project_root} -AgentsDir {agents_dir} -Module all
   ```
   寫入 `{agents_dir}/logs/cli_task.md`。
2. **啟動 CLI**：`run_command: gemini`（Cwd = workspace root）
3. **發送任務**：`send_command_input: 請讀取 {agents_dir}/logs/cli_task.md 並執行其中定義的任務`
4. **棄管**：Do NOT read further terminal output.
5. 通知總監：「CLI 掃描已啟動，請選擇 "Allow all server tools for this session"。完成後請通知我繼續。」

**等待總監確認掃描完成再進行下一步。**

CLI 執行完成後輸出：

- `.agents/logs/scan_report.md` — code-audit 掃描報告
- `.agents/logs/audit_security_scan.md` — 硬編碼憑證掃描
- `.agents/logs/audit_perf.md` — 效能掃描

### Step 2: Read Scan Report (讀取掃描報告)

1. `view_file` on `{agents_dir}/logs/scan_report.md` — 依 `code-audit` 技能 §2 解析（ESLint/Snyk/TypeScript/TODO/環境變數）。
2. `view_file` on `{agents_dir}/logs/audit_security_scan.md` — 硬編碼憑證 / 環境變數一致性。
3. 萃取關鍵數據：錯誤/警告數、CVE 清單、最常違反規則。

### Step 2.5: Trunk 測試穩定度掃描 (主腦直連)

1. 如果專案具備測試框架，由主腦 (Master Agent) 直接呼叫原生工具 `mcp_trunk_detect-frameworks` 取代 CLI 子代理。
2. 分析專案是否有不穩定測試 (Flaky Tests)，並彙整 Trunk 的建議狀態。

### Step 3: AI Cross-Boundary Analysis (AI 跨邊界架構分析)

These analyses CANNOT be done by tools — they require understanding of architectural context and cross-referencing with module memory:

#### B. Module Relationship Audit（模組關聯性驗證）

- Read each source file's import/require/from statements.
- Build an actual dependency graph.
- Cross-compare with memory card `## Relations` — flag inconsistencies.
- Detect circular dependencies.

#### C. API Integration Check（API 串接完整性）

依 `audit-engine` 技能 §2 執行三層強制比對（端點存在性 / Dead API / Schema 欄位一致性）。
將比對結果寫入最終報告【前後端串接缺口】區塊。

#### E. Dead Code / Orphan Detection（死碼與孤立檔案偵測）

- Using the dependency graph from (B), identify source files NOT imported by any other module.
- Exclude known entry points (main, index, app, layout, page).
- Flag remaining files as orphan candidates.

#### F. Key Function Survival Check（關鍵函式存活驗證）

- For each memory card's `## Key Decisions` that reference specific functions, use `grep_search` against the corresponding tracked files.
- Confirm each function/class still exists and its name is unchanged.
- If mismatched → flag skill as needing update.

// turbo

#### G. Skill Quality Scan（技能品質掃描）

- Run `.agents/scripts/Measure-SkillQuality.ps1` against all skills directories (framework + project + memory)
- Include results in health report under【技能品質】section
- Flag 🔴 items as requiring immediate attention

#### J. Data Layer Consistency（資料層一致性）— conditional on DB in tech_stack

- **Model vs API Response**: Compare database model/schema field definitions with API response structures. Flag mismatches.
- **Migration Integrity**: If migration files exist, verify they correspond to current model definitions.

#### K. Test Coverage Gap Analysis（測試覆蓋缺口分析）

依 `audit-engine` 技能 §3 執行測試覆蓋缺口分析四步驟。
將未覆蓋率與前五名高風險函式寫入最終報告【測試覆蓋缺口】區塊。

> **Batch Strategy**: If the project has more than 5 module memory cards, follow the `code-audit` skill §3 batch procedures.

#### H. Accessibility Audit（無障礙審計 — 僅前端專案）

```
[A11Y GATE] 觸發判斷：
├── 記憶卡中是否包含前端頁面模組？
│   ├── 否 → 「本專案無前端頁面，無障礙審計跳過。」
│   └── 是 → 依 `a11y-testing` 技能 §1 掃描流程執行
└── Critical 違規 = 🔴 紅燈 | Serious = 🟡 黃燈 | Moderate/Minor = 仅紀錄
```

#### S. Security Architecture Review（後端安全架構審查）

> **前提**: 此時已完成 B/E/F 分析，所有後端原始碼已讀取完畢。

依 `audit-engine` 技能 §1 執行 S1–S5 五項強制核查。每項輸出 PASS / FAIL + 詳情 / N/A。
將結果寫入最終報告的【安全架構審查】區塊。

## 4. Migration Protocol (Legacy Fallback)

When initializing memory cards for an old project:

- Detect `project_root`. If legacy `.agents/cartridges/` directory exists, create corresponding memory cards from their contents.
- Ensure old legacy cartridge directories are archived to `.agents/memory/_archived/`.

## 5. Traditional Chinese Output Mandate (Strictly zh-TW)

You MUST halt and output a Traffic Light Health Report and Memory Status EXACTLY matching this Traditional Chinese structure:

【健檢與測繪完畢】: 模組記憶系統已對齊 (System Updated).
【資安狀況 (Traffic Light)】:

- 🔴 紅燈 (Critical): <如果有，列出>
- 🟡 黃燈 (Warning): <如果有，列出>
- 🟢 綠燈 (Healthy): <如果有，列出>
  【記憶狀態】:
- 📦 新增: <本次新建的模組記憶>
- ♻️ 更新: <本次更新或去腐敗的模組記憶>
  【工具掃描摘要】:（取自 CLI 掃描報告）
- 🧹 ESLint: 錯誤 {N} / 警告 {M} / 最常違反: {top 3 rules}
- 🛡️ 依賴安全 (npm/yarn audit): 🔴嚴重 {N} 🟠高危 {N} 🟡中等 {N} 🟢低 {N} / 最嚴重: {top vulnerability}
- 📝 型別檢查: 錯誤 {N}（若有執行）
- 🏷️ 代辦標記: TODO {N} / FIXME {N} / HACK {N}
- 🔑 環境變數: {不一致項目數}
  【安全架構審查】:（S1-S5 核查結果）
- 🔐 API 輸入驗證: <PASS/FAIL — 缺失端點列表>
- 🔑 憑證隔離: <PASS/FAIL — 硬編碼位置>
- 🛡️ 存取控制: <PASS/FAIL — 未守衛路由>
- 🚨 錯誤隔離: <PASS/FAIL — 洩漏位置>
- 📋 日誌標準: <PASS/FAIL — 違規模組>
  【AI 架構分析】:（主腦直接分析）
- 🔗 模組關聯異常: <哪些模組的實際依賴關係跟記憶記錄的不一致>
- 🔌 前後端串接缺口: <端點不存在 / Dead API / Schema 欄位不符>
- 🗑️ 疑似沒有在用的檔案: <沒有被任何其他檔案引用的孤立檔案>
- 📋 記憶同步: <記憶記錄的功能跟實際程式碼對不上的模組>
- 💾 資料層: <資料庫欄位跟 API 回傳的內容不一致 / 資料庫版本升級紀錄缺漏>
- 🧪 測試覆蓋缺口: 未覆蓋率 {N}% <{燈號}> / 最高風險未覆蓋函式: <前 5 名>
- ♿ 無障礙審計: <Critical {N} / Serious {N}，或「無前端，跳過」>
  【效能審查】:
  依 `performance-audit` 技能 §1 執行 Lighthouse 掃描：

```
[PERFORMANCE GATE] 觸發判斷：
├── 記憶卡中是否包含前端頁面模組？
│   ├── 否 → 「本專案無前端頁面，效能審查跳過。」
│   └── 是 → 讀取 audit_perf.md 報告並依 §1「分數→燈號判定閘門」套用燈號
└── 將結果寫入報告【效能狀況】欄位
```

- 🌐 效能狀況: <分數與燈號，或「無前端，跳過」>
  【下一步建議】: <給總監的繁體中文簡短建議>

## COMPLETION GATE（完成閘門 — 不可略過）

> Inherits: `.agents/workflows/_completion_gate.md`

- Execute all checks defined in the shared Completion Gate.

## [SECURITY & COMPLIANCE MANDATE]

> Inherits: `.agents/workflows/_security_footer.md` (Role Lock Gate)

- **Role**: `Reader/Memory` | Permissions based on the security gate matrix。記憶寫入限於 `.agents/memory/` 與 `.agents/logs/`。
