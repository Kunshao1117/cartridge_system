---
name: cross-lingual-guard
description: >
  Confidence-gated 4-layer Chinese intent decoding protocol with workflow-context awareness.
  Enforces semantic extraction, English reasoning, and echo-back confirmation for ambiguous input.
  Use when: 處理繁體中文輸入的語意理解、意圖解碼、跨語系推理防護。
metadata:
  author: antigravity
  version: "1.0"
  origin: framework
  memory_awareness: none
  tool_scope: ["reasoning"]
---

# Cross-Lingual Guard — Chinese Intent Decoding Protocol

## 1. Activation Scope

```
Chinese input received?
├── Trivial (≤5 chars: 繼續/GO/好/對/確認) → Skip all phases
└── Non-trivial → Phase 0
```

## 2. Phase 0: Workflow Context Awareness

```
Workflow command present? (@[/xx_name])
├── Yes → Extract workflow metadata:
│         ├── Role (Reader/Writer/Worker)
│         ├── Write permission (read-only vs write-enabled)
│         ├── Scope constraints (what actions are allowed)
│         └── Use these to NARROW interpretation of Chinese payload
│
│   Workflow classification:
│   ├── Read-Only workflows (/00, /01, /06, /07, /08, /11)
│   │   → Echo threshold: RELAXED
│   │   → Misinterpretation damage: recoverable
│   │
│   └── Write-Enabled workflows (/02, /03, /04, /05, /09, /10, /12)
│       → Echo threshold: STRICT
│       → Misinterpretation damage: high
│
└── No workflow → Treat as ad-hoc conversation
    → Echo threshold: MODERATE
    → No workflow context to narrow interpretation
```

## 3. Phase 1: 4-Layer Intent Decode (Internal)

For the Chinese payload (text AFTER workflow command), decode four layers:

### Layer 1 — Surface (字面)
Extract literal meaning of each clause.

### Layer 2 — Intent (意圖)
Determine what action the speaker expects:
```
Action type?
├── Request information → answer / explain
├── Request action → build / fix / search / test
├── Express disagreement → change approach / rethink
├── Redirect direction → pivot to different angle
├── Confirm/approve → proceed as planned
└── Uncertain → flag for echo-back
```

### Layer 3 — Tone (情緒)
Assess speaker's attitude:
```
Tone markers?
├── Positive: 很好/不錯/可以/同意 → satisfaction
├── Mild negative: 不太/好像不/感覺怪怪 → gentle correction
├── Strong negative: 不對/不合理/完全錯 → firm rejection
├── Exploratory: 如果/可能/或許/要不要 → brainstorming
├── Impatient: 直接/快/不用解釋 → wants speed
└── Neutral → no adjustment needed
```

### Layer 4 — Implicit (隱含)
Identify unstated assumptions:
```
Check for:
├── Omitted subject → who is performing the action?
├── Omitted object → what is being acted upon?
├── Assumed context → references to previous conversation?
├── Degree of statement → '不太' (slightly not) vs '不' (not) vs '完全不' (absolutely not)
└── Cultural implicature → politeness masking strong opinion?
```

## 4. Phase 2: English Reasoning (Internal)

1. Reformulate the decoded intent in English
2. Conduct all logical analysis, planning, and step decomposition in English
3. Map conclusions back to Director-facing Traditional Chinese output per Core Mandate §7

## 5. Phase 3: Confidence-Gated Echo

```
Self-assess confidence in interpretation:
├── HIGH → Proceed silently
├── MEDIUM → Proceed, prefix response with one-line intent summary: 「執行方向：___」
└── LOW → Echo-back before acting:
          Output: 「我理解您的意思是：___。是否正確？」
```

### Heuristic Safety Triggers (force confidence to LOW)

Override self-assessed confidence to LOW when ANY condition matches:

```
├── Negation + degree modifier: 不太/不是很/並非完全/也不算
├── Abstract concept with no concrete referent in input
├── Reference to prior context without specifics: 你剛說的/之前的/上次那個
├── Input > 80 chars with no explicit action verb
├── Complex conditional: 如果...就.../除非...否則.../只要...但是...
├── Multiple possible interpretations exist for a key phrase
└── Director previously corrected a similar interpretation in this session
```

## Gotchas

- ⚠️ This protocol operates at the THINKING level. Phases 0-2 are invisible to the Director. Only Phase 3 echo-back produces visible output.
- ⚠️ Do NOT convert this into a visible checklist in every response. The 4-layer decode is a mental discipline, not an output template.
- ⚠️ When echo-back triggers, keep it concise (1-3 bullet points). Do NOT echo the entire 4-layer analysis.
- ⚠️ `// turbo` annotated workflow steps: skip echo-back even if confidence is LOW.

## Constraints

- SKILL.md is written in English (Instruction Layer) to avoid self-referential tokenization damage
- This skill does NOT change the underlying tokenizer — it mitigates drift at the reasoning level
- This skill does NOT replace workflow-specific constraints — it augments them
- Echo-back is a SAFETY NET, not a default behavior — most interactions should pass silently
