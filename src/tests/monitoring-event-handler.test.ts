import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createConfig } from "../config.js";
import { GitignoreFilter } from "../gitignore-filter.js";
import { CartridgeIndexManager } from "../index-manager.js";
import { StalenessAnalyzer } from "../analyzer.js";
import { MemoryWriter } from "../writer.js";
import { handleProjectFileEvent } from "../monitoring/project-event-handler.js";

let tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => fs.rm(root, { recursive: true, force: true })),
  );
  tempRoots = [];
});

describe("handleProjectFileEvent", () => {
  it("updates stale state and injects warnings for tracked files", async () => {
    const root = await createProjectFixture();
    const config = createConfig(root);
    const gitignoreFilter = new GitignoreFilter(root);
    const indexManager = new CartridgeIndexManager(config);
    const writer = new MemoryWriter(config);
    const analyzer = new StalenessAnalyzer(config, indexManager, writer);
    await indexManager.scan();

    await handleProjectFileEvent({
      config,
      indexManager,
      analyzer,
      gitignoreFilter,
      writer,
      absFilePath: path.join(root, "src", "index.ts"),
      eventType: "change",
    });

    const entry = indexManager.getIndex().cartridges.core;
    expect(entry.staleness).toBeGreaterThanOrEqual(10);
    expect(entry.pendingChanges).toHaveLength(1);
    const skill = await fs.readFile(
      path.join(root, ".agents", "memory", "core", "SKILL.md"),
      "utf-8",
    );
    expect(skill).toContain("CARTRIDGE_SYSTEM_WARNING_START");
  });

  it("tracks new unowned files as untracked items", async () => {
    const root = await createProjectFixture();
    const config = createConfig(root);
    const gitignoreFilter = new GitignoreFilter(root);
    const indexManager = new CartridgeIndexManager(config);
    const writer = new MemoryWriter(config);
    const analyzer = new StalenessAnalyzer(config, indexManager, writer);
    await indexManager.scan();

    await fs.writeFile(path.join(root, "src", "new-file.ts"), "export {};\n");
    await handleProjectFileEvent({
      config,
      indexManager,
      analyzer,
      gitignoreFilter,
      writer,
      absFilePath: path.join(root, "src", "new-file.ts"),
      eventType: "add",
    });

    expect(indexManager.getUntrackedFiles()).toEqual([
      expect.objectContaining({ filePath: "src/new-file.ts" }),
    ]);
  });

  it("ignores memory archive files as managed memory artifacts", async () => {
    const root = await createProjectFixture();
    const config = createConfig(root);
    const gitignoreFilter = new GitignoreFilter(root);
    const indexManager = new CartridgeIndexManager(config);
    const writer = new MemoryWriter(config);
    const analyzer = new StalenessAnalyzer(config, indexManager, writer);
    await indexManager.scan();

    const archivePath = path.join(
      root,
      ".agents",
      "memory",
      "core",
      "archive-001.md",
    );
    await fs.writeFile(archivePath, "# Archive\n");
    await handleProjectFileEvent({
      config,
      indexManager,
      analyzer,
      gitignoreFilter,
      writer,
      absFilePath: archivePath,
      eventType: "add",
    });

    expect(indexManager.getUntrackedFiles()).toEqual([]);
  });

  it("refreshes index when MEMORY.md changes", async () => {
    const root = await createProjectFixture();
    const memoryPath = path.join(root, ".agents", "memory", "core", "MEMORY.md");
    await fs.rename(
      path.join(root, ".agents", "memory", "core", "SKILL.md"),
      memoryPath,
    );
    const config = createConfig(root);
    const gitignoreFilter = new GitignoreFilter(root);
    const indexManager = new CartridgeIndexManager(config);
    const writer = new MemoryWriter(config);
    const analyzer = new StalenessAnalyzer(config, indexManager, writer);
    await indexManager.scan();

    await fs.appendFile(memoryPath, "\n## Current Truth\n- Updated.\n");
    await handleProjectFileEvent({
      config,
      indexManager,
      analyzer,
      gitignoreFilter,
      writer,
      absFilePath: memoryPath,
      eventType: "change",
    });

    expect(indexManager.getIndex().cartridges.core.mainFileType).toBe("MEMORY.md");
  });
});

async function createProjectFixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-monitor-"));
  tempRoots.push(root);
  await fs.mkdir(path.join(root, ".agents", "memory", "core"), {
    recursive: true,
  });
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.writeFile(path.join(root, "src", "index.ts"), "export const x = 1;\n");
  await fs.writeFile(
    path.join(root, ".agents", "memory", "core", "SKILL.md"),
    [
      "---",
      "name: core",
      "description: core memory",
      "last_updated: '2026-01-01T00:00:00+08:00'",
      "staleness: 0",
      "status: stable",
      "---",
      "",
      "# Core",
      "",
      "## Tracked Files",
      "",
      "- src/index.ts",
      "",
      "## Key Decisions",
      "",
      "- Fixture.",
      "",
    ].join("\n"),
  );
  return root;
}
