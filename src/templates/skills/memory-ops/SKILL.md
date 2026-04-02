---
name: memory-ops
description: >
  Complete operating guide for reading, updating, and creating memory cards.
  MCP Server: cartridge-system
  Use when: 建立、讀取或更新專案記憶卡時載入。本技能取代手動的 Markdown 編輯，強制執行合規自動化。
---

# Memory Skill Operations (記憶技能操作指引)

## 1. Core Mandate (支配規則)

All memory card **writes and updates** MUST follow the **two-step flow**:
1. Use native tools (`write_to_file` / `replace_file_content`) to write the full SKILL.md content
2. Call `cartridge-system__memory_commit` to sync metadata (timezone, staleness, index)

**Commit Obligation (歸卡義務)**: Skipping step 2 is FORBIDDEN. A memory card written without `memory_commit` is considered INCOMPLETE. The Completion Gate will reject the workflow.

> **Legacy**: `memory_update(mode: replace)` is still available as a fallback but NOT recommended.
> **Deprecated**: `memory_update(mode: patch)` and `memory_update(mode: append)` are deprecated due to high error rates in Markdown merging.

> **Exception**: During audit workflows (`/08_audit`), **reading and verification** via `view_file` is permitted to validate memory card contents.

> **Timestamp Standard**: ALL timestamps MUST use `YYYY-MM-DDTHH:mm:ss+08:00`. UTC (`Z` suffix) is FORBIDDEN.

## 2. Reading Memory (載入記憶)

- IDE auto-injects memory card names/descriptions at session start
- Load on-demand via `memory_read` when task involves tracked files
- **Overview** — For handoff (`/11_handoff`) or full project overview, call `memory_list` to get all module names and health status
- **Single module** — For pre-task context loading, call `memory_read` with target module name (e.g., `_system`)

## 3. Repairing Stale Memory (過期修復)

When a memory cartridge has staleness > 0, you **MUST NOT** simply call `memory_update` to reset staleness. Follow this repair procedure:

### Staleness Repair Procedure (過期修復流程)

```
Stale memory card detected?
├── Step 1: Call memory_status(moduleName) ← diagnose staleness
│   ⇒ Returns: staleness index, changed files list (absolute paths), action guidance
├── Step 2: Call view_file on each changed file
│   ⇒ Understand the latest state of the source code
├── Step 3: Call memory_read(moduleName)
│   ⇒ Read existing memory content
├── Step 4: Compare source code changes vs existing memory
│   ⇒ Produce updated memory content (update decisions/known issues/lessons sections)
├── Step 5: Use write_to_file to write the updated SKILL.md
│   ⇒ Full content including updated sections
└── Step 6: Call memory_commit(moduleName, projectRoot)
    ⇒ staleness auto-resets to 0 + pendingChanges auto-cleared + index synced
```

> **Core principle**: The purpose of staleness repair is "sync memory with source code", NOT "suppress the alert". Staleness reset is merely a side effect of completing the sync.

## 4. Updating Memory (更新記憶)

After modifying source files tracked by a memory skill, you **MUST** update the corresponding memory card.

### Mandatory Flow (強制流程 — 不可略過)

```
Need to update memory?
├── 🔍 Granularity pre-check: does the target memory card have > 8 trackedFiles?
│   └── Yes → Pause update. Execute § 5.6 split procedure first
│       → Propose split strategy to Director
│       → After Director approves, execute split, then update the resulting child cards
├── Step 1: Call memory_read(moduleName) to get current content
│   ⇒ Understand existing decisions, tracked files, known issues
├── Step 2: Use write_to_file / replace_file_content to write updated SKILL.md
│   ⇒ Include all sections: frontmatter, Tracked Files, Key Decisions, etc.
│   ⇒ AI native tools provide the highest write stability
└── Step 3: Call memory_commit(moduleName, projectRoot)
    ⇒ Auto-injects Taiwan timezone timestamp
    ⇒ Auto-resets staleness to 0
    ⇒ Auto-syncs cartridge_index.json (clears pendingChanges, re-parses trackedFiles)
    ⇒ Returns structural validation report
```

### Legacy Fallback (舊版備用)

- `memory_update(mode: replace)`: Send complete SKILL.md content for full replacement. Still functional but less stable than the two-step flow.
- ⚠️ `memory_update(mode: patch)`: **Deprecated** — High error rate due to Markdown section matching sensitivity.
- ⚠️ `memory_update(mode: append)`: **Deprecated** — No structural validation, causes duplicate sections.

### Post-Commit Obligations (歸卡後義務)
1. Under `## Module Lessons`, append reusable knowledge discovered (format: `Dxx: description`)

### Enforcement (強制閘門)

The following enforcement mechanisms ensure compliance:
1. **Completion Gate** — BLOCKS workflow completion if modified files are not reflected in memory cards
2. **Commit Staleness Warning** — `/09_commit_log` HALTS before committing if memory is stale

## 4.5 New File Attribution (新建檔案歸屬義務)

When your workflow creates new source code files, you MUST attribute them to memory cards BEFORE entering the Completion Gate.

```
New source file created?
├── Step 1: Call memory_list to get all cards with scopePath
├── Step 2: Match new file path against scopePath prefixes
│   ├── Match found → Add file to that card's ## Tracked Files + memory_commit
│   └── No match → Step 3
└── Step 3: HALT and propose to Director:
    ├── Option A: Expand nearest card's scopePath to cover the new file
    └── Option B: Create new memory card (execute § 5)
```

**FORBIDDEN**: Leaving new source files untracked. Every production source file MUST belong to exactly one memory card.

## 5. Creating New Memory (建立新記憶)

When `/02_blueprint` or `/08_audit` identifies a new module:
1. Create folder `.agents/memory/{module}/`
2. Create `SKILL.md` with frontmatter + standard sections
3. Description MUST include Chinese keywords for Director instruction matching
4. Set `scopePath` frontmatter field when applicable

### Nesting Decision Tree (層級判斷決策樹)

```
Create new memory card?
├── Does this module belong to an existing functional domain card?
│   ├── No → Create at `.agents/memory/` root level (layer 1)
│   └── Yes → Is the parent card's depth < 4?
│       ├── No → Max depth reached, create at parent's level (keep flat)
│       └── Yes → Create inside parent card's subdirectory
│           ⇒ Path: `.agents/memory/{parentName}/{child}/SKILL.md`
└── Decision criteria:
    ├── scopePath containment? (child's scopePath is sub-path of parent's)
    ├── Does modifying the child typically require referencing the parent's shared decisions?
    └── Are there 3+ modules under the same domain that can be independently tracked?
```

> See `references/memory-template.md` for the complete template.

## 5.5 Tree Structure (樹狀結構指南)

Memory cards support parent-child hierarchy via **directory structure**:

- Layer 1-2 cards live in `.agents/memory/` direct subdirectories (IDE auto-injects names)
- Layer 3-4 cards live inside **parent card's subdirectory** (IDE cannot see; AI loads on-demand after reading parent)
- Maximum depth: **4 layers**
- **`scopePath`** (optional): directory prefix this card is responsible for, used for file attribution

### Directory Example (目錄範例)

```
.agents/memory/
├── api/                          ← Layer 1 (functional domain) depth=1
│   ├── SKILL.md                  ← Shared API architecture decisions
│   ├── auth/                     ← Layer 2 depth=2, parent='api'
│   │   ├── SKILL.md              ← Auth module specific decisions
│   │   └── oauth/                ← Layer 3 depth=3
│   │       └── SKILL.md          ← OAuth sub-module
│   └── manage/                   ← Layer 2 depth=2, parent='api'
│       └── SKILL.md              ← Management module
└── frontend/                     ← Layer 1 (independent domain)
    └── SKILL.md
```

### Loading Nested Cards (子卡載入流程)

1. IDE only injects layer 1-2 names and descriptions
2. AI discovers child cards from `## Relations` section after reading parent
3. Load deep memory on-demand via `memory_read(childName)`
4. `resolveSkillPath` handles nested path resolution automatically — AI does not need to know physical directory locations

### Granularity Principle (粒度判斷原則)

> One memory card = one independent change unit. If modifying A typically does not require modifying B, then A and B should be in separate cards.

- Each memory card tracks no more than **8 files**
- When exceeded, `memory_list` will proactively suggest splitting

## 5.6 Splitting Memory Cards (拆分操作步驟)

When the system flags a memory card as oversized, or maintenance difficulty is discovered during routine work:

```
Need to split a memory card?
├── Step 1: Call memory_read to get the full content of the old card
│   ⇒ Analyze trackedFiles directory distribution and Key Decisions attribution
├── Step 2: Propose split strategy to Director
│   ⇒ Explain which decisions promote to shared (parent) and which demote to (child)
├── Step 3: Execute after Director approves
│   ├── Promote the original card to parent (retain shared decisions + scopePath)
│   ├── Create child card subdirectories under parent (each with scopePath + specific decisions)
│   └── memory_update to update parent content (trim to shared portions only)
├── Step 4: Plugin auto scan + refresh
│   ⇒ Index and file watchers update automatically
├── Step 5: Call memory_commit for EACH new child card
│   ⇒ Each child card must be individually committed
└── Step 6: Call memory_commit for the parent card
    ⇒ Parent card's trimmed content must also be committed
```

## 6. System Memory (系統記憶)

`_system/SKILL.md` (in `.agents/memory/`) stores tech stack, host platform, and deployment config.
Same update rules apply.
