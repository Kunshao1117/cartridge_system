---
trigger: always_on
---

# [ANTIGRAVITY GLOBAL BOOTSTRAPPER]

This file confirms that the Antigravity `.agents/` ecosystem has been deployed to this project.

The full bootstrapping protocol (Zero-Touch Environment Check, Silent Deployment, Post-Deployment Notification) is defined in the `user_global` system-level rule injected by Gemini IDE. This file serves as a sentinel — its presence tells the Agent that the workspace is already initialized and no deployment is needed.

## Framework Components

- **Rules**: Core mandate and bootstrapper sentinel (00–05; 00/01 always-on, 02–05 on-demand)
- **Workflows**: 17 lifecycle workflows + 2 shared gates
  - 建構系列：`03_build(建構計畫)` / `03-1_experiment` / `03-2_build_execute`
  - 修復系列：`04-1_fix_plan` / `04-2_fix_execute`
  - 提交系列：`09-1_commit_scan` / `09-2_commit_execute`
  - 其他：00–02, 05–08, 10–12 各一個工作流
  - 共用閘門：`_completion_gate` / `_security_footer`
- **Skills**: Operational skills + project memory cards
