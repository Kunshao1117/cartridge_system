---
description: 專案濃縮初始化 — 自動掃描代碼庫，萃取專案身份與工作模式，寫入永久上下文
---

## 0. Precondition Check（前置條件確認）

[PRECONDITION GATE] Verify environment:
- IF (`.agents/rules/AGENTS.md` does NOT exist):
  - [HALT] Output exactly: 「🔴 [CONDENSE HALT] 目標專案未安裝 Antigravity 框架。請先執行 install.ps1 部署。」
- ELSE: Proceed to §1.

## 1. Scan（掃描階段）

> [LOAD SKILL] Before executing §1, you MUST read:
> 1. `view_file .agents/skills/memory-ops/SKILL.md`
> 2. `view_file .agents/skills/memory-arch/SKILL.md`
> 3. `view_file .agents/skills/tech-stack-protocol/SKILL.md`

Scan the project systematically using the following priority order:

```
掃描優先順序：
├── 1. README.md（根目錄）→ 專案名稱、定位、核心功能
├── 2. 目錄結構（根目錄 + 主要子目錄 depth=2）→ 專案類型推斷
├── 3. 技術堆疊設定檔（package.json / *.toml / *.mod / requirements.txt）→ 框架版本、依賴
├── 4. gitnexus 知識圖譜 → 代碼結構、模組關聯、入口點
│   └── 降級路徑：gitnexus 未索引時 → list_dir + view_file 代表性檔案
├── 5. .agents/memory/_system/SKILL.md → 現有系統記憶（若已存在）
└── 6. 主要設定檔（.env.example / docker-compose.yml / wrangler.toml 等）→ 部署環境
```

[DEGRADATION NOTICE] If gitnexus call fails or returns empty index:
- Output: 「ℹ️ gitnexus 尚未建立索引，使用手動掃描模式。」
- Fallback to `list_dir` (depth 2) + `view_file` on representative files.

## 2. Extract（萃取階段）

From the scan results, extract exactly **6 dimensions**, each expressed in **one sentence**:

```
1. 專案身份    → 「這個專案是什麼」
2. 工作模式    → 「主要工作類型是什麼」
3. 技術堆疊    → 「核心框架與語言」
4. 總監角色    → 「操作者的背景與指揮語言」
5. 部署環境    → 「執行平台與 CI/CD」
6. MCP 工具鏈  → 「已配置的外部工具」
```

Generate two outputs from these dimensions:

- **壓縮摘要（6 行以內）** → 寫入 AGENTS.md 保護區段（Path A）
- **完整上下文** → 寫入 _system 記憶卡的 `## 專案身份與工作模式` 段落（Path B）

## 3. Director Review Gate（總監審閱閘門）

[MANDATORY HALT] — AI MUST output a preview and wait for Director confirmation.

Output format:
```
🔍 濃縮工作流 — 即將寫入內容預覽

═══ Path A：AGENTS.md 保護區段（永遠注入）═══

## [PROJECT IDENTITY — /05_condense 生成，升級時保留]
- **專案身份**：{萃取結果}
- **工作模式**：{萃取結果}
- **技術堆疊**：{萃取結果}
- **總監角色**：{萃取結果}
- **部署環境**：{萃取結果}
- **MCP 工具鏈**：{萃取結果}
<!-- /PROJECT_IDENTITY_END -->

═══ Path B：_system 記憶卡 — 新增/更新段落 ═══
（完整記憶卡預覽）

確認後輸入 GO 授權寫入。
```

DO NOT proceed until Director provides explicit GO approval.

## 4. Write（寫入階段）

After Director GO approval:

### Path A: AGENTS.md 保護區段

```
寫入目標：.agents/rules/AGENTS.md
├── IF AGENTS.md 已包含 「## [PROJECT IDENTITY」標記
│   └── 更新標記區段內容（覆蓋舊版萃取結果）
├── ELSE
│   └── 在 AGENTS.md 末尾追加保護區段
└── 區段格式：
    ## [PROJECT IDENTITY — /05_condense 生成，升級時保留]
    - **專案身份**：{一句話}
    - **工作模式**：{一句話}
    - **技術堆疊**：{核心框架}
    - **總監角色**：{角色描述}
    - **部署環境**：{環境說明}
    - **MCP 工具鏈**：{工具清單}
    <!-- /PROJECT_IDENTITY_END -->
```

### Path B: _system 記憶卡

```
寫入目標：.agents/memory/_system/SKILL.md
├── IF _system/SKILL.md 已存在
│   ├── IF 已包含 「## 專案身份與工作模式」段落
│   │   └── 覆蓋更新該段落
│   └── ELSE
│       └── 在 ## Key Decisions 前插入新段落
├── ELSE IF _system/SKILL.md 不存在
│   └── 依 memory-arch 模板建立完整記憶卡，以 6 大維度填充
└── 強制呼叫 memory_commit('_system', projectRoot) 同步索引
```

## COMPLETION GATE（完成閘門 — 不可略過）

> Inherits: `.agents/workflows/_completion_gate.md`

- Execute all checks defined in the shared Completion Gate.

## [SECURITY & COMPLIANCE MANDATE]

> Inherits: `.agents/workflows/_security_footer.md` (Role Lock Gate)

- **Role**: `Writer/SRE` | Permissions based on the security gate matrix。
- **Memory Update**: MANDATORY — §4 Path B 強制執行記憶卡寫入與 memory_commit。