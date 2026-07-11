---
name: mcp-tools.server
scopePath: null
dependencies:
  - mcp-tools.dispatcher
  - mcp-tools.tool-registry
description: >
  專案記憶：MCP SDK stdio server、CLI 入口與公開版本 metadata。Use when: 修改 server 啟動、工具公開、CLI
  參數或版本契約時載入。
last_updated: '2026-07-11T14:53:17+08:00'
status: stable
staleness: 0
memory_schema_version: 2
memory_quality_version: 1
memory_kind: source_fact
verification_status: verified
last_verified: '2026-07-11T14:40:20+08:00'
valid_scope: current-project
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 7
cycle_event_limit: 30
size_limit_bytes: 16384
line_limit: 120
archive_policy: volume
compaction_status: ready
metadata:
  author: antigravity
  version: '1.1'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
    - 'filesystem:write'
---
# mcp-tools.server — Module Memory

## Current Truth

- `MCP_SERVER_VERSION`, SDK server metadata, CLI version output, and server tests are synchronized to 5.5.3.
- The server is a thin stdio transport that obtains public tool definitions from `mcp-tools.tool-registry`.
- Tool calls are delegated to `mcp-tools.dispatcher`; the server does not duplicate handler, safety, or confirmation logic.
- The CLI keeps `--workspace` as an optional absolute default project root for downstream calls.
- List-tools and call-tool behavior remain registry-driven so MCP packaging and runtime expose one contract.

## Active Constraints

- Server, CLI, tests, package identity, and registry manifest assertions must carry the same release version.
- Do not duplicate registry metadata or dispatcher authorization logic in the transport layer.
- Keep stdio output protocol-safe; diagnostics belong on the supported error channel.

## Cycle Events

- 01: Migrated the legacy card into schema v2 and preserved old content in archive volumes.
- 02: Synchronized server and CLI coverage to 5.5.0.
- 03: Standardized the active memory main file and evidence sections.
- 04: Standardized ownership for the 5.5.1 governance repair.
- 05: Synchronized server metadata and CLI version to 5.5.1.
- 06: Synchronized server metadata and CLI version to 5.5.2.
- 07: Synchronized `MCP_SERVER_VERSION`, metadata, CLI, and tests to 5.5.3.

## Archive Index

- archive-001.md — Legacy card content before schema v2 migration on 2026-06-04.

## Evidence Base

- source:src/mcp-server.ts
- source:src/tests/mcp-server.test.ts
- source:src/tool-registry.ts
- source:src/mcp-dispatcher.ts
- validation:VD-03 — 5.5.3 server and CLI validation provenance.
- review:RD-03 — independent 5.5.3 review provenance.

## Read Contract

- Read this card before changing MCP server metadata, stdio transport, CLI workspace defaults, or version output.
- Do not use this card as the owner of public tool metadata or handler behavior.

## Conflicts and Supersession

- None.

## 中文摘要

- MCP server metadata、CLI 版本與測試已同步為 5.5.3。
- Server 維持薄層設計，工具清單由 registry 提供，呼叫授權由 dispatcher 處理。
- `--workspace` 仍可指定預設專案根目錄，不另建狀態來源。

## Tracked Files

- src/mcp-server.ts
- src/tests/mcp-server.test.ts

## Relations

- mcp-tools（parent overview）
- _system（package version source）
- release-packaging（npm runtime release target）

## Applicable Skills

- memory-ops — Use for governed updates and staleness repair of this card.
