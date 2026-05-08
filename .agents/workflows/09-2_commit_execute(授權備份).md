---
description: 打包日誌與進行遠端推播
---

# [WORKFLOW: COMMIT EXECUTE (授權備份)]

## 1. SNAPSHOT_AND_RECORD

[EXECUTE] Parse uncommitted diffs via `git diff`.
[EXECUTE] Write `CHANGELOG.md` natively in Traditional Chinese based on changes.
[CONSTRAINT] DO NOT modify memory card staleness. The scan phase is structurally isolated.

## 2. PRE_COMMIT_BUFFER

[EXECUTE] Formulate a Conventional Commit message in Traditional Chinese based on the diffs.

## 3. AUTHORIZATION_GATE

[IF-THEN-HALT]
- 印出擬定的 Commit Message 與變更紀錄。
- Print: "【防線鎖定】準備遠端備份。請輸入 GO 核准備份或要求修改註解。"
- HALT: SUSPEND GENERATION IMMEDIATELY. Require Director input exactly `GO` to proceed.

## 4. COMMIT_AND_PUSH

> [LOAD SKILL] 收到 GO 授權後，讀取推播技能：
> `view_file .agents/skills/github-ops/SKILL.md`

[EXECUTE ONLY UPON GO]
Run: `git add .`
Run: `git commit -m "{Message}"`
Run: `git push`

## 4a. CHANGELOG Update（CHANGELOG 同步更新）

- 維護倉庫根目錄的 `CHANGELOG.md`（Keep a Changelog 格式）
- 格式：`## [YYYY-MM-DD]` 下分 `### feat` / `### fix` / `### chore` 三類
- **強制商業語言**：禁止裸露識別符（函式名、變數名），必須用功能模組名稱描述行為
- 使用 `write_to_file` 或 `replace_file_content` 更新 CHANGELOG.md

範例條目格式：
```markdown
## [2026-05-06]
### feat
- 雙版本同等化 — 補入 PRE-FLIGHT GATE 與技能蒸餾閘門
### fix
- 腳本掃描範圍 — 修復 Measure-SkillQuality 漏掃衍生技能目錄
```

## 5. COMPLETION_GATE

[EXECUTE] Inherits: `.agents/workflows/_completion_gate.md`

## [SECURITY & COMPLIANCE MANDATE]
> Inherits: `.agents/workflows/_security_footer.md` (Role Lock Gate)

- **Role**: `Writer/SRE` | 寫入與推送權限