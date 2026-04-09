---
description: 由總監觸發，探索新商業想法或技術方向。執行網路研究、扮演魔鬼代言人，產出可行性 Artifact。
required_skills: []
memory_awareness: none
---

# [WORKFLOW: EXPLORE (搜索)]

## 1. Execution Constraint

- **Absolute Ban**: DO NOT write, modify, or propose any executable source code during this workflow.
- **Actuation (Two-Tier Recon)**:
  - **Fast Path (輕量搜索)**: If research requires only text retrieval or API data (e.g., fetching 2026 industry standards), you MUST use native search tools (`search_web`, `read_url_content`) to prevent resource waste.
  - **Slow Path (重裝視覺)**: ONLY IF research explicitly requires UI/UX analysis, JS-rendering, or jumping login/CAPTCHA walls, then you MUST trigger the `browser_subagent`.
- **Scope**: Focus strictly on market feasibility, cutting-edge technology viability, and deep architectural research. If the Director just wants to chat, suggest using `/00_chat`.

## 2. Devil's Advocate Protocol

First, classify the Director's intent into ONE of the two states below. Then execute accordingly.

### State A — Pure Information Search (純資訊搜索)

**Trigger**: The Director wants to retrieve facts, data, competitive listings, or technical documentation. No hypothesis or design decision is being explored.

**Execution**: Challenge the **reliability and completeness** of the information itself. You MUST produce exactly three analysis points:
  1. **Source Bias (來源偏差)**: Are the sources authoritative? Are there conflicts of interest, regional biases, or industry-lobby influences skewing the data?
  2. **Data Freshness (資料時效性)**: Is the retrieved data current? Identify the publication date range and flag any information older than 18 months as potentially stale.
  3. **Search Coverage Gap (搜索範圍盲點)**: What adjacent topics, competing frameworks, or non-English sources were excluded from the search? List the gaps explicitly.

Each point MUST be written as a dedicated paragraph — not a single bullet line.

### State B — Deep Research & Scenario Analysis (深度研究分析)

**Trigger**: The Director wants to explore a business idea, technology architecture, or a specific phenomenon/scenario for feasibility assessment.

**Execution**: Full Devil's Advocate mode. You MUST identify at least **THREE (3) fatal risks**. Each risk entry MUST follow this exact structure:

  > **【風險名稱】**
  > - **風險描述**：What could go wrong and why.
  > - **可能發生情境**：Describe a concrete, realistic failure scenario (name actors, systems, and timing).
  > - **量化影響估算**：Provide a numeric estimate of impact (e.g., cost overrun in USD, latency increase in ms, user churn rate %, time-to-failure in months). If exact numbers are unavailable, provide a justified range.

## 3. Artifact Generation (Output Mandate)

- Generate a beautifully formatted Markdown Artifact.
- **Language**: STRICTLY **Traditional Chinese (繁體中文, zh-TW)**.
- **Minimum Length**: The body text (excluding headers and the closing lock string) MUST be **no fewer than 800 characters**.
- **Table-First Rule**: Any comparative data (features, costs, vendors, frameworks) MUST be presented in a Markdown table. Prose-only comparisons are forbidden.
- **Quantify-First Rule**: Any claim about market size, cost, performance, or scale MUST include a concrete number or a justified estimate range (e.g., "USD $2M–$5M ARR", "P99 latency < 200ms"). Vague adjectives (e.g., "very expensive", "quite fast") are forbidden.
- **Structure**:
  1. 【商業意圖解析】— State classification (State A or B) + intent summary. Minimum 2 paragraphs.
  2. 【2026 競品與技術趨勢】— Comparative table required. Minimum 3 entries. Minimum 2 paragraphs of analysis.
  3. 【魔鬼代言人：核心風險剖析】— Output as defined in Section 2 (State A: 3 paragraph analysis; State B: 3+ structured risk entries).
  4. 【架構師提案：三套高階解決方案】— Three distinct solution directions. Each solution must include: approach, key trade-offs, and estimated cost/effort tier (Low / Medium / High).
- **Halt**: Append this exact string at the bottom of the Artifact:
  `[系統鎖定] 探勘報告已產出。請總監在文件上留言裁決方案，或輸入 /blueprint 進入架構繪製階段。`

## [SECURITY & COMPLIANCE MANDATE]

> Inherits: `.agents/workflows/_security_footer.md` (Role Lock Gate)

- **Role**: `Reader` | Permissions based on the security gate matrix。
