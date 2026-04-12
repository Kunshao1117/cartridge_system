---
description: 在不改變商業邏輯的前提下重構程式碼，提升效能與整潔度。強制執行重構前後的自動化測試基線比對。
required_skills: [memory-ops, code-quality, test-patterns, impact-test-strategy]
memory_awareness: full
---

# [WORKFLOW: REFACTOR (重構)]


> [LOAD SKILL] §0 執行前，必須讀取：
> `view_file .agents/skills/memory-ops/SKILL.md`

## 0. Memory Recall (記憶載入)

- Check the IDE-injected skill list for memory cards relevant to the target modules.
- Load relevant memory card SKILL.md files — check `## Relations` to ensure refactoring does not break dependent modules.

> [LOAD SKILL] 測試基線建立前，必須讀取：
> 1. `view_file .agents/skills/test-patterns/SKILL.md`
> 2. `view_file .agents/skills/impact-test-strategy/SKILL.md`

## 1. Tech-Stack Binding & Zero-Regression

```
[SAVE STATE GATE] Pre-refactor baseline:
├── [SUDO] detected? → Skip baseline. Allow logic-altering refactors.
├── Step 1: Read _system memory for test runner.
├── Step 2: Run ALL existing unit tests → Store results as Baseline.
│   ├── No test framework detected? → Skip baseline comparison. Warn:
│   │   「無基線測試可比對，重構風險提升。」
│   └── Baseline FAIL? → [HALT] 「🔴 [REFACTOR HALT] 基線測試已故障。請先修復再重構。」
├── Step 3: Execute refactoring changes.
├── Step 4: Re-run ALL unit tests → Compare to Baseline.
│   ├── PASS (identical results) → Proceed silently.
│   └── FAIL (regression) → Auto-revert ALL refactored files.
│       「🔴 [REFACTOR HALT] 重構導致回歸。已自動退版。請總監審閱。」
└── Gate cleared → Report to Director.
```

> [LOAD SKILL] §2 重構執行前，必須讀取：
> `view_file .agents/skills/code-quality/SKILL.md`

## 2. Refactoring Execution

- Optimize for Big-O performance, readability, and SOLID principles.
- Split files exceeding their thresholds as defined in the `code-quality` Skill.
- ALL newly generated docstrings MUST be in **Traditional Chinese (繁體中文)**.

## 3. QA Validation & Reporting

- Re-run the Unit Tests. They MUST pass 100%.
- Generate an Artifact detailing the performance gains.
- **Halt**: Output: `[系統鎖定] 重構完畢且通過單測基線。請總監審閱效能提升報告。`

## COMPLETION GATE（完成閘門 — 不可略過）

> Inherits: `.agents/workflows/_completion_gate.md`

- Execute all checks defined in the shared Completion Gate.

## [SECURITY & COMPLIANCE MANDATE]

> Inherits: `.agents/workflows/_security_footer.md` (Role Lock Gate)

- **Role**: `Worker` | Permissions based on the security gate matrix。
- **Memory Update**: After refactoring, update affected memory cards' `## Tracked Files` (if files moved/renamed), `## Key Decisions` (if interfaces changed), and frontmatter.
