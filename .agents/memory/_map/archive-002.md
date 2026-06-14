# MEMORY.md Main-File Migration Report — 2026-06-15

## Scope

- Project: cartridge_system
- Previous committed source checkpoint: fbcfaf3d0f6410ba743b9205910c227ee36ba845
- Operation: renamed active memory main files from legacy SKILL.md to canonical MEMORY.md.
- Existing archive-*.md volumes were not rewritten.
- Active cards were supplemented with memory_quality_version, memory_kind, verification_status, last_verified, valid_scope, Evidence Base, Read Contract, and Conflicts and Supersession.

## Migrated Cards

- _assets: .agents/memory/_assets/SKILL.md -> .agents/memory/_assets/MEMORY.md
- _map: .agents/memory/_map/SKILL.md -> .agents/memory/_map/MEMORY.md
- _system: .agents/memory/_system/SKILL.md -> .agents/memory/_system/MEMORY.md
- core-types: .agents/memory/core-types/SKILL.md -> .agents/memory/core-types/MEMORY.md
- desktop-console: .agents/memory/desktop-console/SKILL.md -> .agents/memory/desktop-console/MEMORY.md
- desktop-console.app: .agents/memory/desktop-console/app/SKILL.md -> .agents/memory/desktop-console/app/MEMORY.md
- desktop-console.monitoring: .agents/memory/desktop-console/monitoring/SKILL.md -> .agents/memory/desktop-console/monitoring/MEMORY.md
- desktop-console.renderer: .agents/memory/desktop-console/renderer/SKILL.md -> .agents/memory/desktop-console/renderer/MEMORY.md
- extension: .agents/memory/extension/SKILL.md -> .agents/memory/extension/MEMORY.md
- extension.analyzer: .agents/memory/extension/analyzer/SKILL.md -> .agents/memory/extension/analyzer/MEMORY.md
- extension.cabinet-workbench: .agents/memory/extension/cabinet-workbench/SKILL.md -> .agents/memory/extension/cabinet-workbench/MEMORY.md
- extension.cabinet-workbench.graph-viewport: .agents/memory/extension/cabinet-workbench/graph-viewport/SKILL.md -> .agents/memory/extension/cabinet-workbench/graph-viewport/MEMORY.md
- extension.governance-sidebar: .agents/memory/extension/governance-sidebar/SKILL.md -> .agents/memory/extension/governance-sidebar/MEMORY.md
- extension.injector: .agents/memory/extension/injector/SKILL.md -> .agents/memory/extension/injector/MEMORY.md
- extension.watcher: .agents/memory/extension/watcher/SKILL.md -> .agents/memory/extension/watcher/MEMORY.md
- extension.writer: .agents/memory/extension/writer/SKILL.md -> .agents/memory/extension/writer/MEMORY.md
- gitignore-filter: .agents/memory/gitignore-filter/SKILL.md -> .agents/memory/gitignore-filter/MEMORY.md
- index-manager: .agents/memory/index-manager/SKILL.md -> .agents/memory/index-manager/MEMORY.md
- index-manager.dep-engine: .agents/memory/index-manager/dep-engine/SKILL.md -> .agents/memory/index-manager/dep-engine/MEMORY.md
- mcp-tools: .agents/memory/mcp-tools/SKILL.md -> .agents/memory/mcp-tools/MEMORY.md
- mcp-tools.commit-preflight: .agents/memory/mcp-tools/commit-preflight/SKILL.md -> .agents/memory/mcp-tools/commit-preflight/MEMORY.md
- mcp-tools.context-governance: .agents/memory/mcp-tools/context-governance/SKILL.md -> .agents/memory/mcp-tools/context-governance/MEMORY.md
- mcp-tools.dispatcher: .agents/memory/mcp-tools/dispatcher/SKILL.md -> .agents/memory/mcp-tools/dispatcher/MEMORY.md
- mcp-tools.handlers: .agents/memory/mcp-tools/handlers/SKILL.md -> .agents/memory/mcp-tools/handlers/MEMORY.md
- mcp-tools.memory-audit: .agents/memory/mcp-tools/memory-audit/SKILL.md -> .agents/memory/mcp-tools/memory-audit/MEMORY.md
- mcp-tools.memory-graph: .agents/memory/mcp-tools/memory-graph/SKILL.md -> .agents/memory/mcp-tools/memory-graph/MEMORY.md
- mcp-tools.project-context: .agents/memory/mcp-tools/project-context/SKILL.md -> .agents/memory/mcp-tools/project-context/MEMORY.md
- mcp-tools.server: .agents/memory/mcp-tools/server/SKILL.md -> .agents/memory/mcp-tools/server/MEMORY.md
- mcp-tools.tool-registry: .agents/memory/mcp-tools/tool-registry/SKILL.md -> .agents/memory/mcp-tools/tool-registry/MEMORY.md
- mcp-tools.workspace-brief: .agents/memory/mcp-tools/workspace-brief/SKILL.md -> .agents/memory/mcp-tools/workspace-brief/MEMORY.md
- release-packaging: .agents/memory/release-packaging/SKILL.md -> .agents/memory/release-packaging/MEMORY.md

## Notes

- This report preserves the migration mapping; full pre-migration active card bodies remain recoverable from git checkpoint fbcfaf3d0f6410ba743b9205910c227ee36ba845.
- Quality evidence points to tracked source files or card directories for navigation/static cards.
