import fs from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { build } from "tsup";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StalenessAnalyzer } from "../analyzer.js";
import { createConfig } from "../config.js";
import { CartridgeIndexManager, memoryContentFingerprint } from "../index-manager.js";
import { MemoryWriter } from "../writer.js";
import { handleProjectFileEvent } from "../monitoring/project-event-handler.js";
import type { GitignoreFilter } from "../gitignore-filter.js";
import type { FileEventType } from "../types.js";

const roots: string[] = [];
const execFile = promisify(execFileCallback);
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

const main = ".agents/memory/A/MEMORY.md";
function card(tracked = ["src/a.ts", "src/b.ts"], prose = "Source claims need comparison."): string {
  return ["---", "name: A", "description: fixture", "dependencies: []", "staleness: 0",
    "status: stable", "last_updated: '2026-01-01T00:00:00Z'", "---", "",
    "## Current Truth", `- ${prose}`, "", "## Tracked Files", ...tracked.map((file) => `- ${file}`), "",
  ].join("\n");
}

function monitor(root: string) {
  const config = createConfig(root, { scoring: { fileChanged: 10, fileDeleted: 20, fileAdded: 5, dailyDecay: 0 } });
  const indexManager = new CartridgeIndexManager(config);
  const writer = new MemoryWriter(config);
  const analyzer = new StalenessAnalyzer(config, indexManager, writer);
  const gitignoreFilter = {
    reload: vi.fn(),
    checkIgnored: vi.fn(async () => ({ ignored: false, mode: "git-standard", diagnostics: [] })),
    discoverProjectFiles: vi.fn(async () => ({ files: ["src/a.ts", "src/b.ts"], mode: "git-standard", diagnostics: [] })),
  } as unknown as GitignoreFilter;
  return {
    indexManager, writer,
    event: (filePath: string, eventType: FileEventType = "change") => handleProjectFileEvent({
      config, indexManager, writer, analyzer, gitignoreFilter, eventType, absFilePath: path.join(root, filePath),
    }),
  };
}

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-review-monitor-"));
  roots.push(root);
  await fs.mkdir(path.dirname(path.join(root, main)), { recursive: true });
  await fs.mkdir(path.join(root, "src"));
  await fs.writeFile(path.join(root, "src/a.ts"), "export const a = 1;\n");
  await fs.writeFile(path.join(root, "src/b.ts"), "export const b = 1;\n");
  await fs.writeFile(path.join(root, main), card());
  const first = monitor(root);
  await first.indexManager.scan();
  first.indexManager.markDirty();
  await first.indexManager.persist();
  return { root, first };
}

describe("P1 monitor reconciliation (T13–T15)", () => {
  it("T13 source → warning → main-file event preserves pending review", async () => {
    const { root, first } = await fixture();
    const before = await fs.readFile(path.join(root, main), "utf8");
    await fs.writeFile(path.join(root, "src/a.ts"), "export const a = 2;\n");
    await first.event("src/a.ts");
    const warned = await fs.readFile(path.join(root, main), "utf8");
    expect(warned).toContain("CARTRIDGE_SYSTEM_WARNING_START");
    expect(memoryContentFingerprint(warned)).toBe(memoryContentFingerprint(before));
    await first.event(main);
    expect(first.indexManager.getIndex().cartridges.A.pendingChanges).toHaveLength(1);
    expect(first.indexManager.getIndex().cartridges.A.staleness).toBe(10);
    expect(await fs.readFile(path.join(root, main), "utf8")).toBe(warned);
  });

  it("T13 unrelated content and staleness reset edits are not review evidence", async () => {
    const { root, first } = await fixture();
    await first.event("src/a.ts");
    await fs.writeFile(path.join(root, main), card(undefined, "Edited prose alone does not resolve pending sources."));
    await first.event(main);
    expect(first.indexManager.getIndex().cartridges.A.pendingChanges).toHaveLength(1);
    expect(first.indexManager.getIndex().cartridges.A.staleness).toBe(10);
    expect(await fs.readFile(path.join(root, main), "utf8")).toContain("CARTRIDGE_SYSTEM_WARNING_START");
  });

  it("T14 deletion and warning feedback preserve the ghost and update change → unlink severity", async () => {
    const { root, first } = await fixture();
    await first.event("src/a.ts");
    await fs.unlink(path.join(root, "src/a.ts"));
    await first.event("src/a.ts", "unlink");
    await first.event(main);
    const a = first.indexManager.getIndex().cartridges.A;
    expect(a.pendingChanges).toHaveLength(1);
    expect(a.pendingChanges[0].eventType).toBe("unlink");
    expect(a.ghostFiles).toEqual(["src/a.ts"]);
    expect(a.staleness).toBe(20);
  });

  it("T14 only removed tracking is resolved; other pending and missing entries remain", async () => {
    const { root, first } = await fixture();
    await fs.unlink(path.join(root, "src/a.ts"));
    await fs.unlink(path.join(root, "src/b.ts"));
    await first.event("src/a.ts", "unlink");
    await first.event("src/b.ts", "unlink");
    await fs.writeFile(path.join(root, main), card(["src/b.ts"]));
    await first.event(main);
    const a = first.indexManager.getIndex().cartridges.A;
    expect(a.pendingChanges.map((change) => change.filePath)).toEqual(["src/b.ts"]);
    expect(a.ghostFiles).toEqual(["src/b.ts"]);
    expect(a.staleness).toBe(20);
  });

  it("T14 restoration clears its ghost while retaining review for restored content", async () => {
    const { root, first } = await fixture();
    await fs.unlink(path.join(root, "src/a.ts"));
    await first.event("src/a.ts", "unlink");
    await fs.writeFile(path.join(root, "src/a.ts"), "export const restored = true;\n");
    await first.event("src/a.ts", "add");
    expect(first.indexManager.getIndex().cartridges.A.ghostFiles).toEqual([]);
    expect(first.indexManager.getIndex().cartridges.A.pendingChanges).toHaveLength(1);
  });

  it("T15 independent monitors share durable suppression and reconciliation through the real canonical index", async () => {
    const { root, first } = await fixture();
    // Faithful shared-index monitor simulation: separate manager/analyzer/writer
    // instances, canonical reload on every transaction, no shared RAM flags.
    // This test does not claim that two OS processes were launched.
    const second = monitor(root);
    expect(await second.indexManager.load()).toBe(true);
    await fs.writeFile(path.join(root, "src/a.ts"), "export const a = 2;\n");
    await Promise.all([first.event("src/a.ts"), second.event("src/a.ts")]);
    const bytes = await fs.readFile(path.join(root, main), "utf8");
    const timestamp = first.indexManager.getIndex().cartridges.A.pendingChanges[0].timestamp;
    await Promise.all([first.event(main), second.event(main)]);
    await second.event("src/a.ts");
    expect(second.indexManager.getIndex().cartridges.A.pendingChanges).toHaveLength(1);
    expect(second.indexManager.getIndex().cartridges.A.pendingChanges[0].timestamp).toBe(timestamp);
    expect(second.indexManager.getIndex().cartridges.A.staleness).toBe(10);
    expect(await fs.readFile(path.join(root, main), "utf8")).toBe(bytes);

    // Recreate a monitor to prove that duplicate suppression survives restart.
    const restarted = monitor(root);
    await restarted.indexManager.load();
    await restarted.event(main);
    await restarted.event("src/a.ts");
    expect(restarted.indexManager.getIndex().cartridges.A.pendingChanges).toHaveLength(1);
    expect(await fs.readFile(path.join(root, main), "utf8")).toBe(bytes);

    await fs.unlink(path.join(root, "src/a.ts"));
    await Promise.all([first.event("src/a.ts", "unlink"), second.event("src/a.ts", "unlink")]);
    await Promise.all([first.event(main), second.event(main)]);
    expect(second.indexManager.getIndex().cartridges.A.ghostFiles).toEqual(["src/a.ts"]);
    expect(second.indexManager.getIndex().cartridges.A.staleness).toBe(20);
  });

  it("T15 two real OS processes preserve pending/ghost state and never rewrite duplicate warnings", async () => {
    const { root } = await fixture();
    const bundleDir = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-monitor-bundle-"));
    roots.push(bundleDir);
    await build({
      entry: { monitor: path.resolve("src/tests/fixtures/monitor-process-entry.ts") },
      outDir: bundleDir, config: false, format: ["cjs"], platform: "node",
      noExternal: [/./], bundle: true, splitting: false, dts: false, silent: true,
      sourcemap: false, clean: true,
    });
    const runPair = async (eventType: FileEventType) => Promise.all([0, 1].map(async () => {
      const result = await execFile(process.execPath, [path.join(bundleDir, "monitor.js"), root, "src/a.ts", eventType], {
        timeout: 20_000, windowsHide: true,
      });
      return JSON.parse(result.stdout) as { pid: number; pending: Array<{ filePath: string; eventType: string; timestamp: string }>; ghosts: string[]; staleness: number };
    }));
    await fs.writeFile(path.join(root, "src/a.ts"), "export const a = 2;\n");
    const first = await runPair("change");
    expect(new Set(first.map((result) => result.pid)).size).toBe(2);
    for (const result of first) {
      expect(result.pending).toHaveLength(1);
      expect(result.staleness).toBe(10);
    }
    const warning = await fs.readFile(path.join(root, main), "utf8");
    const second = await runPair("change");
    expect(await fs.readFile(path.join(root, main), "utf8")).toBe(warning);
    for (const result of second) expect(result.pending[0].timestamp).toBe(first[0].pending[0].timestamp);

    await fs.unlink(path.join(root, "src/a.ts"));
    const deleted = await runPair("unlink");
    for (const result of deleted) {
      expect(result.pending).toHaveLength(1);
      expect(result.pending[0].eventType).toBe("unlink");
      expect(result.ghosts).toEqual(["src/a.ts"]);
      expect(result.staleness).toBe(20);
    }
    const deletedWarning = await fs.readFile(path.join(root, main), "utf8");
    await runPair("unlink");
    expect(await fs.readFile(path.join(root, main), "utf8")).toBe(deletedWarning);
  }, 60_000);

  it("resolved tracking and lower scores converge across subsequent main events and scans", async () => {
    const { root, first } = await fixture();
    await first.event("src/a.ts");
    await first.event("src/b.ts", "add");
    const withWarning = await fs.readFile(path.join(root, main), "utf8");
    // Preserve all generated metadata while making a real tracking-only repair.
    await fs.writeFile(path.join(root, main), withWarning.replace("- src/a.ts\n", ""));
    await first.event(main);
    expect(first.indexManager.getIndex().cartridges.A.staleness).toBe(5);
    expect(await fs.readFile(path.join(root, main), "utf8")).not.toContain("CARTRIDGE_SYSTEM_WARNING_START");
    const mild = await fs.readFile(path.join(root, main), "utf8");
    await fs.writeFile(path.join(root, main), mild.replace("- src/b.ts\n", ""));
    await first.event(main);
    await first.event(main);
    await first.indexManager.scan();
    await first.indexManager.scan();
    expect(first.indexManager.getIndex().cartridges.A.pendingChanges).toEqual([]);
    expect(first.indexManager.getIndex().cartridges.A.staleness).toBe(0);
    const resolved = await fs.readFile(path.join(root, main), "utf8");
    expect(resolved).not.toContain("CARTRIDGE_SYSTEM_WARNING_START");
    expect(resolved).toMatch(/staleness: 0/);
  });

  it("editing one card never rewrites an unrelated healthy legacy/deprecated card", async () => {
    const { root, first } = await fixture();
    const other = path.join(root, ".agents/memory/B/SKILL.md");
    const untouched = "---\nname: B\nstatus: deprecated # user lifecycle state\ncustom: preserve\n---\n\nHistorical prose stays byte-identical.\n";
    await fs.mkdir(path.dirname(other), { recursive: true });
    await fs.writeFile(other, untouched);
    await first.indexManager.scan();
    first.indexManager.markDirty();
    await first.indexManager.persist();
    await fs.writeFile(path.join(root, main), card(undefined, "One narrow prose correction."));
    await first.event(main);
    expect(await fs.readFile(other, "utf8")).toBe(untouched);
  });

  it("duplicate add/change notifications for the same bytes do not oscillate severity", async () => {
    const { first } = await fixture();
    await first.event("src/a.ts");
    await first.event("src/a.ts", "add");
    await first.event("src/a.ts");
    expect(first.indexManager.getIndex().cartridges.A.pendingChanges).toHaveLength(1);
    expect(first.indexManager.getIndex().cartridges.A.staleness).toBe(10);
  });

  it("T15 late unlink notifications cannot resurrect a ghost for an existing source", async () => {
    const { root, first } = await fixture();
    await first.event("src/a.ts");
    await first.event("src/a.ts", "unlink");
    expect(await fs.readFile(path.join(root, "src/a.ts"), "utf8")).toContain("a = 1");
    expect(first.indexManager.getIndex().cartridges.A.ghostFiles).toEqual([]);
    expect(first.indexManager.getIndex().cartridges.A.pendingChanges[0].eventType).toBe("change");
    expect(first.indexManager.getIndex().cartridges.A.staleness).toBe(10);
  });
});
