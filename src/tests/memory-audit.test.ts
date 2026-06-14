import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleMemoryAudit } from "../memory-audit.js";

let projectRoot: string;

beforeEach(async () => {
  projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "memory-audit-"));
});

afterEach(async () => {
  await fs.rm(projectRoot, { recursive: true, force: true });
});

async function writeFile(relativePath: string, content: string) {
  const fullPath = path.join(projectRoot, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf-8");
}

function parseEnvelope(result: Awaited<ReturnType<typeof handleMemoryAudit>>) {
  return JSON.parse(result.content[0].text);
}

function qualityMemoryCard(moduleName: string, evidenceLine: string): string {
  return `---
name: ${moduleName}
description: test
last_updated: '2026-05-15T00:00:00+08:00'
staleness: 0
memory_schema_version: 2
memory_quality_version: 1
memory_kind: implementation
verification_status: verified
last_verified: '2026-06-14T00:00:00+08:00'
valid_scope:
  - src/${moduleName}.ts
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 1
size_limit_bytes: 16384
archive_policy: volume
compaction_status: ready
metadata:
  author: test
  version: '1.0'
  origin: test
  memory_awareness: full
  tool_scope: []
---

## Current Truth

- The test card is current.

## Active Constraints

- Keep this card compact.

## Cycle Events

- 01: Test event.

## Archive Index

- None.

## Evidence Base

${evidenceLine}

## Read Contract

- Read before editing tracked files.

## Conflicts and Supersession

- None.

## 中文摘要

- 測試摘要。

## Tracked Files

- src/${moduleName}.ts
`;
}

describe("memory_audit — 專案記憶卡完整健檢", () => {
  it("現代格式專案應回傳 ready", async () => {
    const skill = `---
name: mcp-tools
description: test
last_updated: '2026-05-15T00:00:00+08:00'
staleness: 0
memory_schema_version: 2
memory_quality_version: 1
memory_kind: implementation
verification_status: verified
last_verified: '2026-06-14T00:00:00+08:00'
valid_scope:
  - src/mcp-server.ts
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 1
size_limit_bytes: 16384
archive_policy: volume
compaction_status: ready
metadata:
  author: test
  version: '1.0'
  origin: test
  memory_awareness: full
  tool_scope: []
---

## Tracked Files

- src/mcp-server.ts

## Key Decisions

- D01: test.

## Current Truth

- The test card is current.

## Active Constraints

- Keep this card compact.

## Cycle Events

- 01: Test event.

## Archive Index

- None.

## Evidence Base

- src/mcp-server.ts

## Read Contract

- Read before editing tracked files.

## Conflicts and Supersession

- None.

## 中文摘要

- 測試摘要。
`;
    await writeFile(".agents/memory/mcp-tools/MEMORY.md", skill);
    await writeFile(
      ".cartridge/index.json",
      JSON.stringify({
        cartridges: {
          "mcp-tools": {
            skillPath: ".agents/memory/mcp-tools/MEMORY.md",
            mainFile: {
              type: "MEMORY.md",
              activePath: ".agents/memory/mcp-tools/MEMORY.md",
              activeFileName: "MEMORY.md",
              candidates: { memory: ".agents/memory/mcp-tools/MEMORY.md" },
              candidatePaths: [".agents/memory/mcp-tools/MEMORY.md"],
              legacyCompatibility: false,
              migrationRequired: false,
              conflict: false,
            },
            mainFileType: "MEMORY.md",
            contentQualityStatus: "complete",
            migrationRequired: false,
            legacyCompatibility: false,
            staleness: 0,
            trackedFiles: ["src/mcp-server.ts"],
            ghostFiles: [],
            dependencies: [],
            indirectStaleness: 0,
          },
        },
        fileMap: { "src/mcp-server.ts": ["mcp-tools"] },
        untrackedFiles: [
          { filePath: ".agents/memory/mcp-tools/archive-001.md" },
          { filePath: ".agents/memory/mcp-tools" },
        ],
      }),
    );

    const result = await handleMemoryAudit({ projectRoot });
    const envelope = parseEnvelope(result);

    expect(result.isError).toBeUndefined();
    expect(envelope.status).toBe("ready");
    expect(envelope.metadata.tool).toBe("memory_audit");
    expect(envelope.metadata.readOnly).toBe(true);
    expect(envelope.summary.compatibility.mode).toBe("modern");
    expect(envelope.summary.summary.cards).toBe(1);
    expect(envelope.summary.summary.untrackedFiles).toBe(0);
    expect(envelope.findings).toEqual([]);
  });

  it("staleness 歸零但 pendingChanges 未清時應回報索引漂移", async () => {
    const skill = `---
name: _assets
description: test
last_updated: '2026-05-15T00:00:00+08:00'
staleness: 0
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 1
size_limit_bytes: 16384
archive_policy: volume
compaction_status: ready
metadata:
  author: test
  version: '1.0'
  origin: test
  memory_awareness: full
  tool_scope: []
---

## Tracked Files

- README.md

## Key Decisions

- D01: test.

## Current Truth

- The test card is current.

## Active Constraints

- Keep this card compact.

## Cycle Events

- 01: Test event.

## Archive Index

- None.

## 中文摘要

- 測試摘要。
`;
    await writeFile(".agents/memory/_assets/SKILL.md", skill);
    await writeFile(
      ".cartridge/index.json",
      JSON.stringify({
        cartridges: {
          _assets: {
            skillPath: ".agents/memory/_assets/SKILL.md",
            staleness: 0,
            trackedFiles: ["README.md"],
            pendingChanges: [{ filePath: "README.md", eventType: "change" }],
            ghostFiles: [],
            dependencies: [],
            indirectStaleness: 0,
          },
        },
        fileMap: { "README.md": ["_assets"] },
        untrackedFiles: [],
      }),
    );

    const result = await handleMemoryAudit({ projectRoot });
    const envelope = parseEnvelope(result);
    const codes = envelope.findings.map((finding: { code: string }) => finding.code);

    expect(envelope.status).toBe("warning");
    expect(envelope.summary.summary.pendingWithZeroStaleness).toBe(1);
    expect(codes).toContain("INDEX_PENDING_WITH_ZERO_STALENESS");
    expect(
      envelope.recommendedActions.some(
        (action: { action: string }) => action.action === "resync_memory_index",
      ),
    ).toBe(true);
  });

  it("舊格式專案應回傳 compatibility warning", async () => {
    const skill = `---
name: old-card
staleness: 0
dependencies:
  - memory-ops
---

## Tracked FilesD

- /absolute/file.ts
- ../escape.ts

## Relations

- memory-ops
`;
    await writeFile(".agents/memory/old-card/SKILL.md", skill);
    await writeFile(
      ".cartridge/index.json",
      JSON.stringify({
        cartridges: {
          "old-card": {
            skillPath: ".agents/memory/old-card/SKILL.md",
            staleness: 0,
            trackedFiles: ["/absolute/file.ts", "../escape.ts"],
          },
        },
      }),
    );

    const result = await handleMemoryAudit({ projectRoot });
    const envelope = parseEnvelope(result);
    const codes = envelope.findings.map((finding: { code: string }) => finding.code);

    expect(envelope.status).toBe("warning");
    expect(envelope.summary.compatibility.mode).toBe("compatibility");
    expect(codes).toContain("FRONTMATTER_FIELD_MISSING");
    expect(codes).toContain("FRONTMATTER_METADATA_MISSING");
    expect(codes).toContain("TRACKED_FILES_HEADING_TYPO");
    expect(codes).toContain("TRACKED_FILE_ABSOLUTE");
    expect(codes).toContain("TRACKED_FILE_TRAVERSAL");
    expect(codes).toContain("DEPENDENCY_SKILL_NAME_SUSPECT");
    expect(envelope.recommendedActions[0].action).toBe(
      "normalize_legacy_memory_cards",
    );
  });

  it("週期事件滿額時應回報必須彙整", async () => {
    const events = Array.from(
      { length: 30 },
      (_, index) => `- ${String(index + 1).padStart(2, "0")}: Test event.`,
    ).join("\n");
    await writeFile(
      ".agents/memory/full-cycle/SKILL.md",
      `---
name: full-cycle
description: test
last_updated: '2026-06-04T00:00:00+08:00'
staleness: 0
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 30
size_limit_bytes: 16384
archive_policy: volume
compaction_status: ready
metadata:
  author: test
  version: '1.0'
  origin: test
  memory_awareness: full
  tool_scope: []
---

## Current Truth

- The card has reached the cycle event limit.

## Active Constraints

- Compact before adding another event.

## Cycle Events

${events}

## Archive Index

- None.

## 中文摘要

- 週期已滿。

## Tracked Files

- src/full-cycle.ts
`,
    );
    await writeFile(
      ".cartridge/index.json",
      JSON.stringify({
        cartridges: {
          "full-cycle": {
            skillPath: ".agents/memory/full-cycle/SKILL.md",
            staleness: 0,
            trackedFiles: ["src/full-cycle.ts"],
            ghostFiles: [],
            dependencies: [],
            indirectStaleness: 0,
          },
        },
        fileMap: { "src/full-cycle.ts": ["full-cycle"] },
        untrackedFiles: [],
      }),
    );

    const result = await handleMemoryAudit({ projectRoot });
    const envelope = parseEnvelope(result);
    const codes = envelope.findings.map((finding: { code: string }) => finding.code);

    expect(envelope.status).toBe("warning");
    expect(envelope.summary.summary.compactionDue).toBe(1);
    expect(envelope.summary.summary.cycleLimitReached).toBe(1);
    expect(codes).toContain("MEMORY_CYCLE_LIMIT_REACHED");
    expect(codes).toContain("MEMORY_COMPACTION_REQUIRED");
    expect(envelope.recommendedActions).toContainEqual(
      expect.objectContaining({ action: "compact_memory_cards" }),
    );
  });

  it("平面 archive-001.md 歸檔卷超限時應提示開下一卷", async () => {
    await writeFile(
      ".agents/memory/archive-demo/SKILL.md",
      `---
name: archive-demo
description: test
last_updated: '2026-06-04T00:00:00+08:00'
staleness: 0
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 1
size_limit_bytes: 16384
archive_policy: volume
compaction_status: ready
metadata:
  author: test
  version: '1.0'
  origin: test
  memory_awareness: full
  tool_scope: []
---

## Current Truth

- The main card keeps the active state.

## Active Constraints

- Archive volumes use flat filenames.

## Cycle Events

- 01: Created an archive volume.

## Archive Index

- archive-001.md

## 中文摘要

- 歸檔卷測試。

## Tracked Files

- src/archive-demo.ts
`,
    );
    await writeFile(
      ".agents/memory/archive-demo/archive-001.md",
      `# Archive 001\n\n${"Historical detail.\n".repeat(210)}`,
    );
    await writeFile(
      ".cartridge/index.json",
      JSON.stringify({
        cartridges: {
          "archive-demo": {
            skillPath: ".agents/memory/archive-demo/SKILL.md",
            staleness: 0,
            trackedFiles: ["src/archive-demo.ts"],
            ghostFiles: [],
            dependencies: [],
            indirectStaleness: 0,
          },
        },
        fileMap: { "src/archive-demo.ts": ["archive-demo"] },
        untrackedFiles: [],
      }),
    );

    const result = await handleMemoryAudit({ projectRoot });
    const envelope = parseEnvelope(result);
    const codes = envelope.findings.map((finding: { code: string }) => finding.code);

    expect(envelope.status).toBe("warning");
    expect(envelope.summary.summary.archiveVolumeDue).toBe(1);
    expect(codes).toContain("MEMORY_ARCHIVE_VOLUME_LIMIT");
    expect(envelope.recommendedActions).toContainEqual(
      expect.objectContaining({ action: "open_next_archive_volume" }),
    );
  });

  it("舊式 archive/001/SKILL.md 歸檔路徑應提示遷移", async () => {
    await writeFile(
      ".agents/memory/archive-demo/SKILL.md",
      `---
name: archive-demo
description: test
last_updated: '2026-06-04T00:00:00+08:00'
staleness: 0
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 1
size_limit_bytes: 16384
archive_policy: volume
compaction_status: ready
metadata:
  author: test
  version: '1.0'
  origin: test
  memory_awareness: full
  tool_scope: []
---

## Current Truth

- The main card keeps the active state.

## Active Constraints

- Archive volumes should use flat filenames.

## Cycle Events

- 01: Detected a legacy archive path.

## Archive Index

- archive/001/SKILL.md

## 中文摘要

- 舊歸檔路徑測試。

## Tracked Files

- src/archive-demo.ts
`,
    );
    await writeFile(
      ".agents/memory/archive-demo/archive/001/SKILL.md",
      `---
name: archive-demo.archive.001
description: legacy archive
last_updated: '2026-06-04T00:00:00+08:00'
staleness: 0
---

# Legacy archive
`,
    );
    await writeFile(
      ".cartridge/index.json",
      JSON.stringify({
        cartridges: {
          "archive-demo": {
            skillPath: ".agents/memory/archive-demo/SKILL.md",
            staleness: 0,
            trackedFiles: ["src/archive-demo.ts"],
            ghostFiles: [],
            dependencies: [],
            indirectStaleness: 0,
          },
        },
        fileMap: { "src/archive-demo.ts": ["archive-demo"] },
        untrackedFiles: [],
      }),
    );

    const result = await handleMemoryAudit({ projectRoot });
    const envelope = parseEnvelope(result);
    const codes = envelope.findings.map((finding: { code: string }) => finding.code);

    expect(envelope.status).toBe("warning");
    expect(envelope.summary.summary.archiveMigrationWarnings).toBe(1);
    expect(codes).toContain("MEMORY_ARCHIVE_PATH_MIGRATION");
    expect(envelope.recommendedActions).toContainEqual(
      expect.objectContaining({ action: "migrate_archive_paths" }),
    );
  });

  it("缺索引時不視為工具錯誤，應回報相容模式", async () => {
    await writeFile(
      ".agents/memory/_system/SKILL.md",
      `---
name: _system
description: test
last_updated: '2026-05-15T00:00:00+08:00'
staleness: 0
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 0
size_limit_bytes: 16384
archive_policy: volume
compaction_status: ready
metadata:
  author: test
---

## Tracked Files

- README.md
`,
    );

    const result = await handleMemoryAudit({ projectRoot });
    const envelope = parseEnvelope(result);

    expect(result.isError).toBeUndefined();
    expect(envelope.status).toBe("warning");
    expect(envelope.summary.compatibility.mode).toBe("compatibility");
    expect(envelope.findings[0].code).toBe("INDEX_MISSING");
  });

  it("frontmatter dependency cycle 應產生 finding 並標示來源", async () => {
    for (const moduleName of ["a", "b"]) {
      const dependency = moduleName === "a" ? "b" : "a";
      await writeFile(
        `.agents/memory/${moduleName}/SKILL.md`,
        `---
name: ${moduleName}
description: test
last_updated: '2026-05-15T00:00:00+08:00'
staleness: 0
dependencies:
  - ${dependency}
metadata:
  author: test
---

## Tracked Files

- src/${moduleName}.ts

## Key Decisions

- D01: ${moduleName} lists ${dependency} in dependencies because ${moduleName} imports and consumes ${dependency}.
`,
      );
    }
    await writeFile(
      ".cartridge/index.json",
      JSON.stringify({
        cartridges: {
          a: {
            skillPath: ".agents/memory/a/SKILL.md",
            staleness: 0,
            trackedFiles: ["src/a.ts"],
            ghostFiles: [],
            dependencies: [],
            indirectStaleness: 0,
          },
          b: {
            skillPath: ".agents/memory/b/SKILL.md",
            staleness: 0,
            trackedFiles: ["src/b.ts"],
            ghostFiles: [],
            dependencies: [],
            indirectStaleness: 0,
          },
        },
        fileMap: {},
        untrackedFiles: [],
      }),
    );

    const result = await handleMemoryAudit({ projectRoot });
    const envelope = parseEnvelope(result);

    expect(envelope.status).toBe("warning");
    expect(envelope.summary.summary.cycles).toBe(1);
    expect(envelope.summary.cycleDetails[0].source).toBe("frontmatter");
    expect(envelope.summary.summary.dependencySemanticWarnings).toBe(0);
    expect(
      envelope.findings.some(
        (finding: { code: string }) => finding.code === "DEPENDENCY_CYCLE",
      ),
    ).toBe(true);
  });

  it("舊索引 dependencies 循環只作診斷，不應成為主要 cycle", async () => {
    for (const moduleName of ["a", "b"]) {
      await writeFile(
        `.agents/memory/${moduleName}/MEMORY.md`,
        `---
name: ${moduleName}
description: test
last_updated: '2026-05-15T00:00:00+08:00'
staleness: 0
memory_schema_version: 2
memory_quality_version: 1
memory_kind: implementation
verification_status: verified
last_verified: '2026-06-14T00:00:00+08:00'
valid_scope:
  - src/${moduleName}.ts
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: 1
size_limit_bytes: 16384
archive_policy: volume
compaction_status: ready
metadata:
  author: test
---

## Tracked Files

- src/${moduleName}.ts

## Key Decisions

- D01: test.

## Current Truth

- The test card is current.

## Active Constraints

- Keep this card compact.

## Cycle Events

- None.

## Archive Index

- None.

## Evidence Base

- src/${moduleName}.ts

## Read Contract

- Read before editing.

## Conflicts and Supersession

- None.

## 中文摘要

- 測試摘要。
`,
      );
    }
    await writeFile(
      ".cartridge/index.json",
      JSON.stringify({
        cartridges: {
          a: {
            skillPath: ".agents/memory/a/MEMORY.md",
            mainFile: {
              type: "MEMORY.md",
              activePath: ".agents/memory/a/MEMORY.md",
              activeFileName: "MEMORY.md",
              candidates: { memory: ".agents/memory/a/MEMORY.md" },
              candidatePaths: [".agents/memory/a/MEMORY.md"],
              legacyCompatibility: false,
              migrationRequired: false,
              conflict: false,
            },
            mainFileType: "MEMORY.md",
            contentQualityStatus: "complete",
            migrationRequired: false,
            legacyCompatibility: false,
            staleness: 0,
            trackedFiles: ["src/a.ts"],
            ghostFiles: [],
            dependencies: ["b"],
            indirectStaleness: 0,
          },
          b: {
            skillPath: ".agents/memory/b/MEMORY.md",
            mainFile: {
              type: "MEMORY.md",
              activePath: ".agents/memory/b/MEMORY.md",
              activeFileName: "MEMORY.md",
              candidates: { memory: ".agents/memory/b/MEMORY.md" },
              candidatePaths: [".agents/memory/b/MEMORY.md"],
              legacyCompatibility: false,
              migrationRequired: false,
              conflict: false,
            },
            mainFileType: "MEMORY.md",
            contentQualityStatus: "complete",
            migrationRequired: false,
            legacyCompatibility: false,
            staleness: 0,
            trackedFiles: ["src/b.ts"],
            ghostFiles: [],
            dependencies: ["a"],
            indirectStaleness: 0,
          },
        },
        fileMap: {},
        untrackedFiles: [],
      }),
    );

    const result = await handleMemoryAudit({ projectRoot });
    const envelope = parseEnvelope(result);

    expect(envelope.status).toBe("ready");
    expect(envelope.summary.summary.cycles).toBe(0);
    expect(envelope.summary.summary.persistedIndexCycles).toBe(1);
    expect(envelope.summary.persistedIndexCycles).toEqual([["a", "b"]]);
  });

  it("verified card with placeholder Evidence Base should stay pending review", async () => {
    await writeFile(
      ".agents/memory/no-evidence/MEMORY.md",
      qualityMemoryCard("no-evidence", "- None."),
    );
    await writeFile(
      ".cartridge/index.json",
      JSON.stringify({
        cartridges: {},
        fileMap: {},
        untrackedFiles: [],
      }),
    );

    const result = await handleMemoryAudit({ projectRoot });
    const envelope = parseEnvelope(result);
    const codes = envelope.findings.map((finding: { code: string }) => finding.code);

    expect(envelope.status).toBe("warning");
    expect(envelope.summary.summary.evidenceWarnings).toBe(1);
    expect(envelope.summary.summary.pendingQualityReview).toBe(1);
    expect(codes).toContain("MEMORY_QUALITY_EVIDENCE_MISSING");
  });

  it("parent directory with child memory card but no main file should be audited as missing", async () => {
    await writeFile(
      ".agents/memory/domain/child/MEMORY.md",
      qualityMemoryCard("child", "- src/child.ts"),
    );
    await writeFile(
      ".cartridge/index.json",
      JSON.stringify({
        cartridges: {},
        fileMap: {},
        untrackedFiles: [],
      }),
    );

    const result = await handleMemoryAudit({ projectRoot });
    const envelope = parseEnvelope(result);
    const codes = envelope.findings.map((finding: { code: string }) => finding.code);

    expect(envelope.status).toBe("warning");
    expect(envelope.summary.summary.cards).toBe(2);
    expect(envelope.summary.summary.missingMainFiles).toBe(1);
    expect(codes).toContain("MEMORY_MAIN_FILE_MISSING");
  });
});
