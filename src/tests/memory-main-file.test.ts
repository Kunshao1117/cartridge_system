import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  analyzeMemoryContentQuality,
  isActiveMemoryMainFilePath,
  resolveMemoryMainFileInDirectory,
} from "../memory-main-file.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => fs.rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

async function createCardDir(): Promise<{ root: string; cardDir: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "memory-main-file-"));
  tempRoots.push(root);
  const cardDir = path.join(root, ".agents", "memory", "core");
  await fs.mkdir(cardDir, { recursive: true });
  return { root, cardDir };
}

function completeMemory(): string {
  return [
    "---",
    "name: core",
    "description: core memory",
    "memory_schema_version: 2",
    "memory_quality_version: 1",
    "memory_kind: implementation",
    "verification_status: verified",
    "last_verified: '2026-06-14T00:00:00+08:00'",
    "valid_scope:",
    "  - src/index.ts",
    "---",
    "",
    "## Current Truth",
    "- True.",
    "## Active Constraints",
    "- Constraint.",
    "## Cycle Events",
    "- Event.",
    "## Archive Index",
    "- None.",
    "## Evidence Base",
    "- src/index.ts",
    "## Read Contract",
    "- Read before edit.",
    "## Conflicts and Supersession",
    "- None.",
    "## 中文摘要",
    "- 摘要。",
    "## Tracked Files",
    "- src/index.ts",
    "",
  ].join("\n");
}

describe("memory-main-file", () => {
  it("prefers MEMORY.md as current main file", async () => {
    const { root, cardDir } = await createCardDir();
    await fs.writeFile(path.join(cardDir, "MEMORY.md"), completeMemory());

    const result = await resolveMemoryMainFileInDirectory(root, cardDir);

    expect(result.mainFile.type).toBe("MEMORY.md");
    expect(result.mainFile.activePath).toBe(".agents/memory/core/MEMORY.md");
  });

  it("keeps SKILL.md readable as legacy compatibility", async () => {
    const { root, cardDir } = await createCardDir();
    await fs.writeFile(path.join(cardDir, "SKILL.md"), completeMemory());

    const result = await resolveMemoryMainFileInDirectory(root, cardDir);

    expect(result.mainFile.type).toBe("legacy SKILL.md");
    expect(result.mainFile.legacyCompatibility).toBe(true);
    expect(result.mainFile.migrationRequired).toBe(true);
  });

  it("reports conflict when MEMORY.md and SKILL.md both exist", async () => {
    const { root, cardDir } = await createCardDir();
    await fs.writeFile(path.join(cardDir, "MEMORY.md"), completeMemory());
    await fs.writeFile(path.join(cardDir, "SKILL.md"), completeMemory());

    const result = await resolveMemoryMainFileInDirectory(root, cardDir);

    expect(result.mainFile.type).toBe("conflict");
    expect(result.mainFile.activePath).toBeNull();
    expect(result.mainFile.candidatePaths).toEqual([
      ".agents/memory/core/MEMORY.md",
      ".agents/memory/core/SKILL.md",
    ]);
  });

  it("does not treat archive files as active main files", () => {
    expect(
      isActiveMemoryMainFilePath(".agents/memory/core/archive-001.md"),
    ).toBe(false);
    expect(
      isActiveMemoryMainFilePath(".agents/memory/core/archive/001/SKILL.md"),
    ).toBe(false);
  });

  it("marks quality complete only when fields, sections and verification are complete", () => {
    const mainFile = {
      type: "MEMORY.md" as const,
      activePath: ".agents/memory/core/MEMORY.md",
      activeFileName: "MEMORY.md",
      candidates: { memory: ".agents/memory/core/MEMORY.md" },
      candidatePaths: [".agents/memory/core/MEMORY.md"],
      legacyCompatibility: false,
      migrationRequired: false,
      conflict: false,
    };

    expect(analyzeMemoryContentQuality(completeMemory(), mainFile).status).toBe(
      "complete",
    );
    expect(
      analyzeMemoryContentQuality("---\nname: core\n---\n## Tracked Files\n", mainFile)
        .status,
    ).toBe("missing_fields");
  });

  it("does not mark verified cards complete without actionable evidence", () => {
    const mainFile = {
      type: "MEMORY.md" as const,
      activePath: ".agents/memory/core/MEMORY.md",
      activeFileName: "MEMORY.md",
      candidates: { memory: ".agents/memory/core/MEMORY.md" },
      candidatePaths: [".agents/memory/core/MEMORY.md"],
      legacyCompatibility: false,
      migrationRequired: false,
      conflict: false,
    };
    const quality = analyzeMemoryContentQuality(
      completeMemory().replace("## Evidence Base\n- src/index.ts", "## Evidence Base\n- None."),
      mainFile,
    );

    expect(quality.status).toBe("pending_review");
    expect(quality.evidenceBaseStatus).toBe("placeholder");
    expect(quality.evidenceWarnings).toHaveLength(1);
  });

  it("requires exact MEMORY.md and SKILL.md casing", async () => {
    const { root, cardDir } = await createCardDir();
    await fs.writeFile(path.join(cardDir, "memory.md"), completeMemory());

    const result = await resolveMemoryMainFileInDirectory(root, cardDir);

    expect(result.mainFile.type).toBe("missing");
  });
});
