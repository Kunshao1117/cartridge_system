---
description: 全光譜健檢入口 — 支援完整三階段（08-1→08-2→08-3）或單獨觸發任一階段
required_skills: [memory-ops, code-audit, audit-engine]
memory_awareness: full
---

# [WORKFLOW: 08_audit — 全光譜健檢入口]

> 本工作流為三階段健檢的入口控制器，不包含實際掃描邏輯。
> 實際邏輯分別在 08-1_audit_infra / 08-2_audit_logic / 08-3_audit_report 工作流中。

## 入口分派閘門

```
[PARTIAL AUDIT GATE] 依總監輸入決定執行路徑：
├── 「@[/08_audit] infra」或「只跑基礎盤點」→ 僅觸發 @[/08-1_audit_infra]
├── 「@[/08_audit] logic」或「只跑邏輯審查」→ 僅觸發 @[/08-2_audit_logic]
├── 「@[/08_audit] report」→ 使用上次快取報告直接觸發 @[/08-3_audit_report]
└── 無修飾詞 → 完整三階段依序執行：
    Step 1: 觸發 @[/08-1_audit_infra] → 等待完成
    Step 2: 觸發 @[/08-2_audit_logic] → 等待完成
    Step 3: 觸發 @[/08-3_audit_report] → 輸出最終燈號儀表板
```

## [SECURITY & COMPLIANCE MANDATE]

> Inherits: `.agents/workflows/_security_footer.md` (Role Lock Gate)

- **Role**: `Reader` | 全程唯讀，不修改任何原始碼。
