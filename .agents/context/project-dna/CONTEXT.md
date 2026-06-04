---
name: project-dna
description: Cartridge System product, governance, and release DNA for long-lived project decisions.
context_type: design_dna
scope: project
status: approved
confidence: high
last_reviewed: 2026-06-04
approval: GO DNA MEMORY
sources:
  - README.md
  - CHANGELOG.md
  - package.json
  - .codex/AGENTS.md
---

# Project DNA

## Approved Context

- Cartridge System is a three-surface product: VS Code extension, MCP runtime, and Desktop Console.
- Release triggers are intentionally split: VSIX uses vX.Y.Z, npm runtime uses npm-vX.Y.Z, and Desktop Console uses desktop-vX.Y.Z.
- Source memory and project context are separate layers. Source ownership belongs in .agents/memory; long-lived preferences and product DNA belong in .agents/context.
- Schema v2 memory cards keep current truth in the main card and move historical detail into flat archive volumes such as archive-001.md.
- Desktop Console is an operational monitoring surface, not a marketing site. It should stay dense, readable, and action-oriented.
- MCP tools must keep read-only discovery separate from write operations; write operations require explicit confirmation.
- The Director expects Traditional Chinese communication, concrete file/status evidence, and current local verification before release or governance claims.

## Candidate Context

- None.

## Deprecated Context

- Legacy memory cards with Key Decisions and Module Lessons are deprecated as main-card format; their content is preserved in archive volumes after migration.

## Conflicts

- None.

## Evidence

- README documents the three product surfaces and split release model.
- CHANGELOG records schema v2 compaction governance and Desktop Console operation repair in version 5.4.2.
- CHANGELOG records the 5.4.3 archive-untracked repair across VS Code extension, MCP runtime, and Desktop Console.
- Project governance requires Traditional Chinese Director-facing reports and read-before-write behavior.
- Memory audit on 2026-06-04 reported all 31 source memory cards as legacy before this migration.

## Relations

- _map: Project context card registry.
- .agents/memory/: source memory root, separate from project context.
- .codex/AGENTS.md: Codex governance source.

## Promotion Notes

- Promote to a project skill only if these DNA rules become executable repeatable workflow steps, not merely project preferences.
