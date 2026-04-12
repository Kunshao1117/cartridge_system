---
description: 第二階段（共 2 階段）— 授權實體執行已核准的建構計畫。寫入磁碟、歸檔新檔案記憶卡、更新受影響記憶卡、執行測試。需 /03_build 的明確 GO 授權。
required_skills: [memory-ops, security-sre, code-quality, test-patterns, trunk-ops]
memory_awareness: full
---

# [WORKFLOW: BUILD — EXECUTE (建構執行)]


> **前置條件**: 本工作流須由 `/03_build(建構計畫)` 的 GO 授權後方可執行。

## 0. Precondition Check（前置條件確認）

```
[PRECONDITION GATE] Verify authorization before any disk write:
├── Was this workflow triggered by an explicit GO approval from /03_build?
│   └── NO → [HALT] 「🔴 [AUTH HALT] 未收到建構計畫授權。請先執行 /03_build 並取得 GO 確認。」
└── YES → Load implementation_plan.md to identify [NEW] and [MODIFY] file lists.
           Proceed to §1.
```

## 1. Physical Write（實體寫入磁碟）

- 呼叫 `task_boundary` 切換至 `EXECUTION` 模式。
- 依 `implementation_plan.md` 的 diff 清單，將所有變更**寫入物理磁碟**。
- 寫入順序：**依賴者先於被依賴者**（底層模組先寫，上層模組後寫）。

// turbo

## 2. New File Memory Card Archiving（新建檔案歸卡歸檔）

```
[MEM ARCHIVE GATE] For every [NEW] file in implementation_plan.md:
├── Does an existing memory card already track this module's scope?
│   ├── YES → Append new file to that card's `## Tracked Files` section.
│   │           Update `last_updated` timestamp (ISO 8601, +08:00).
│   │           Load memory-ops skill for update procedures.
│   └── NO  → Create a new memory card for this module.
│              Load memory-ops skill for card creation procedures.
│              Populate: Tracked Files, Key Decisions, Module Lessons,
│                        Relations, Applicable Skills, staleness: 0.
│              Memory card descriptions MUST include Chinese keywords.
├── Unresolved after 1 attempt?
│   └── [HALT] 「🔴 [MEM HALT] 新建模組尚未完成歸卡。請先執行記憶歸檔再繼續。」
│             DO NOT proceed to §3.
└── All new files archived → Proceed silently.
```

## 3. Modified File Memory Update（修改檔案記憶卡更新）

```
[MEM UPDATE GATE] For every [MODIFY] file in implementation_plan.md:
├── Locate the memory card whose `## Tracked Files` contains this file.
│   ├── Found → Update the following sections as applicable:
│   │   ├── Key Decisions：記錄本次修改的核心決策原因
│   │   ├── Known Issues：若本次修改引入或修復了已知問題，同步更新
│   │   ├── Module Lessons：若有值得記錄的教訓，追加一條
│   │   └── `last_updated`：更新為當前台灣時間（ISO 8601, +08:00）
│   └── Not Found → Create a memory card for the affected module.
│                   Load memory-ops skill for card creation procedures.
├── Any card update unresolved?
│   └── [HALT] 「🔴 [MEM HALT] 記憶卡尚未更新。請先執行記憶歸卡。」
│             DO NOT proceed to §4.
└── All cards updated → Proceed silently.
```

> [LOAD SKILL] §4 測試步驟前，必須讀取：
> `view_file .agents/skills/test-patterns/SKILL.md`

## 4. Unit Test Generation（單元測試熔斷器）

```
[TEST CIRCUIT BREAKER] After §1–§3 complete:
├── Consult test-patterns skill § 1 Test Decision Tree.
├── Unit tests required?
│   ├── NO → Proceed to §5 silently.
│   └── YES → Run tests.
│       ├── PASS → Proceed silently.
│       └── FAIL → Auto-repair loop:
│           ├── Attempt 1 → Fix and re-run.
│           ├── Attempt 2 → Fix and re-run.
│           ├── Attempt 3 → Fix and re-run.
│           └── Attempt 4+ → [HALT]
│               「🔴 [BUILD HALT] 單元測試修復失敗 (3/3)。請總監介入診斷。」
│               DO NOT continue. DO NOT invoke E2E.
└── Gate cleared → Chain to §5.
```

> ⚠️ 此正規工作流**嚴禁使用 [SUDO] 破窗**。品質不達標就是死鎖。

// turbo

## 5. Automated Chaining to Test（自動串聯視覺測試）

- 單元測試通過後，**必須自主觸發** `/06_test` 工作流，對自身的修改執行視覺驗證。
- **禁止**要求總監手動執行測試工作流。

## COMPLETION GATE（完成閘門 — 不可略過）

> Inherits: `.agents/workflows/_completion_gate.md`

- Execute all checks defined in the shared Completion Gate.

## [SECURITY & COMPLIANCE MANDATE]

> Inherits: `.agents/workflows/_security_footer.md` (Role Lock Gate)

- **Role**: `Writer/SRE` | Permissions based on the security gate matrix。
- **Memory Update**: MANDATORY — §2 與 §3 強制執行，不可略過。違反即 HALT。
