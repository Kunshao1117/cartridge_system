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

describe("memory_audit — 專案記憶卡完整健檢", () => {
  it("現代格式專案應回傳 ready", async () => {
    const skill = `---
name: mcp-tools
description: test
last_updated: '2026-05-15T00:00:00+08:00'
staleness: 0
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
`;
    await writeFile(".agents/memory/mcp-tools/SKILL.md", skill);
    await writeFile(
      ".cartridge/index.json",
      JSON.stringify({
        cartridges: {
          "mcp-tools": {
            skillPath: ".agents/memory/mcp-tools/SKILL.md",
            staleness: 0,
            trackedFiles: ["src/mcp-server.ts"],
            ghostFiles: [],
            dependencies: [],
            indirectStaleness: 0,
          },
        },
        fileMap: { "src/mcp-server.ts": ["mcp-tools"] },
        untrackedFiles: [],
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
    expect(envelope.findings).toEqual([]);
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

  it("缺索引時不視為工具錯誤，應回報相容模式", async () => {
    await writeFile(
      ".agents/memory/_system/SKILL.md",
      `---
name: _system
description: test
last_updated: '2026-05-15T00:00:00+08:00'
staleness: 0
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
        `.agents/memory/${moduleName}/SKILL.md`,
        `---
name: ${moduleName}
description: test
last_updated: '2026-05-15T00:00:00+08:00'
staleness: 0
metadata:
  author: test
---

## Tracked Files

- src/${moduleName}.ts

## Key Decisions

- D01: test.
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
            dependencies: ["b"],
            indirectStaleness: 0,
          },
          b: {
            skillPath: ".agents/memory/b/SKILL.md",
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
});
