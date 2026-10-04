import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemoryReindexOptions } from "../memory-reindex.js";
import type * as MemoryReindexModule from "../memory-reindex.js";

const barrier = vi.hoisted(() => ({
  reached: undefined as (() => void) | undefined,
  resume: undefined as Promise<void> | undefined,
  staleScore: 0,
  pending: 0,
}));

vi.mock("../memory-reindex.js", async importOriginal => {
  const actual = await importOriginal<typeof MemoryReindexModule>();
  return {
    ...actual,
    refreshMemoryIndex: async (options: MemoryReindexOptions) => {
      const result = await actual.refreshMemoryIndex(options);
      if (barrier.reached) {
        const reached = barrier.reached;
        barrier.reached = undefined;
        barrier.staleScore = result.index.cartridges.main.staleness;
        barrier.pending = result.index.cartridges.main.pendingChanges.length;
        reached();
        await barrier.resume;
      }
      return result;
    },
  };
});

vi.mock("../monitoring/node-project-watcher.js", () => ({
  NodeProjectWatcher: class { start() {} stop() {} },
}));

import { CartridgeProjectMonitor } from "../monitoring/project-monitor.js";
import { refreshMemoryIndex } from "../memory-reindex.js";
import { handleMemoryCommit } from "../mcp-handlers.js";

let root: string | undefined;
let monitor: CartridgeProjectMonitor | undefined;
let releaseScan: (() => void) | undefined;
let pendingStartup: Promise<unknown> | undefined;
let fixtureLock: { lockPath: string; ownerPath: string } | undefined;

async function holdFixtureLock(lockPath: string) {
  await fs.mkdir(lockPath);
  const token = randomUUID();
  fixtureLock = { lockPath, ownerPath: path.join(lockPath, `owner-${token}.json`) };
  await fs.writeFile(fixtureLock.ownerPath, JSON.stringify({
    protocolVersion: 2, pid: process.pid, hostname: os.hostname(), token, createdAt: Date.now(),
  }));
  return fixtureLock;
}

async function releaseFixtureLock() {
  if (!fixtureLock) return;
  const { lockPath, ownerPath } = fixtureLock;
  // Release only the fixture's UUID. A waiting transaction may already have
  // replaced the empty canonical directory with its own complete lock.
  await fs.unlink(ownerPath).catch(error => {
    if (error.code !== "ENOENT") throw error;
  });
  await fs.rmdir(lockPath).catch(async error => {
    if (["ENOENT", "ENOTEMPTY", "EEXIST"].includes(error.code)) return;
    if (["EACCES", "EPERM"].includes(error.code)) {
      try {
        if ((await fs.readdir(lockPath)).length > 0) return;
      } catch (readError) {
        if ((readError as NodeJS.ErrnoException).code === "ENOENT") return;
      }
    }
    throw error;
  });
  fixtureLock = undefined;
}

afterEach(async () => {
  const stopping = monitor?.stop();
  releaseScan?.();
  await releaseFixtureLock();
  const settled = await Promise.allSettled([pendingStartup, stopping]);
  // Recursive cleanup is safe only once every fixture operation has drained.
  if (root) await fs.rm(root, { recursive: true, force: true });
  root = undefined;
  monitor = undefined;
  releaseScan = undefined;
  pendingStartup = undefined;
  barrier.reached = undefined;
  barrier.resume = undefined;
  for (const result of settled) {
    if (result.status === "rejected") throw result.reason;
  }
});

async function prepareStaleStartup() {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "startup-warning-transaction-"));
  const cardPath = path.join(root, ".agents/memory/main/MEMORY.md");
  const sourcePath = path.join(root, "src/main.ts");
  const indexPath = path.join(root, ".cartridge/index.json");
  await fs.mkdir(path.dirname(cardPath), { recursive: true });
  await fs.mkdir(path.dirname(sourcePath), { recursive: true });
  await fs.writeFile(path.join(root, "package.json"), '{"name":"startup-transaction-fixture"}');
  await fs.writeFile(cardPath, [
    "---", "name: main", "description: Startup warning transaction fixture", "staleness: 0",
    `last_updated: '${new Date().toISOString()}'`, "---", "# Current module", "",
    "## Tracked Files", "- src/main.ts", "",
  ].join("\n"));
  await fs.writeFile(sourcePath, "export const current = 1;\n");
  await refreshMemoryIndex({ projectRoot: root, detectMissedChanges: true });
  await fs.writeFile(sourcePath, "export const current = 2;\n");
  const reached = new Promise<void>(resolve => { barrier.reached = resolve; });
  barrier.resume = new Promise<void>(resolve => { releaseScan = resolve; });
  monitor = new CartridgeProjectMonitor(root);
  const startup = monitor.start();
  pendingStartup = startup;
  await reached;
  return { projectRoot: root, cardPath, indexPath, startup };
}

describe("startup warnings use the locked canonical revision", () => {
  it("does not restore stale warnings after a real memory_commit between scan and warning acquisition", async () => {
    const { projectRoot, cardPath, indexPath, startup } = await prepareStaleStartup();
    try {
      const committed = JSON.parse((await handleMemoryCommit({ projectRoot, moduleName: "main", confirm: true })).content[0].text);
      const committedCard = await fs.readFile(cardPath, "utf8");
      const committedIndex = await fs.readFile(indexPath, "utf8");
      releaseScan!();
      await startup;
      // Compare real persisted bytes before metadata checks can hide a rewrite.
      expect.soft(await fs.readFile(cardPath, "utf8")).toBe(committedCard);
      expect.soft(await fs.readFile(indexPath, "utf8")).toBe(committedIndex);
      expect(committed.summary.cardWritten).toBe(true);
      expect(committed.summary.synchronizationComplete).toBe(true);
      expect(barrier.staleScore).toBeGreaterThanOrEqual(10);
      expect(barrier.pending).toBeGreaterThan(0);
      expect(committedCard).not.toContain("CARTRIDGE_SYSTEM_WARNING_START");
      expect(JSON.parse(committedIndex).cartridges.main.pendingChanges).toEqual([]);
    } finally {
      releaseScan!();
      await startup;
    }
  });

  it("does not write startup warnings when stop invalidates a generation waiting for the warning lock", async () => {
    const { projectRoot, cardPath, indexPath, startup } = await prepareStaleStartup();
    const lockPath = path.join(projectRoot, ".cartridge/index.lock");
    const initialCard = await fs.readFile(cardPath, "utf8");
    const initialIndex = await fs.readFile(indexPath, "utf8");
    await holdFixtureLock(lockPath);
    releaseScan!();
    await new Promise(resolve => setTimeout(resolve, 150));
    const stopping = monitor!.stop();
    try {
      await releaseFixtureLock();
      await Promise.all([startup, stopping]);
      expect.soft(await fs.readFile(cardPath, "utf8")).toBe(initialCard);
      expect.soft(await fs.readFile(indexPath, "utf8")).toBe(initialIndex);
      expect(barrier.staleScore).toBeGreaterThanOrEqual(10);
      expect(barrier.pending).toBeGreaterThan(0);
    } finally {
      await releaseFixtureLock();
      await Promise.allSettled([startup, stopping]);
    }
  });

  it("preserves a replacement owner published while the fixture releases its lock", async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "startup-warning-transaction-"));
    const lockPath = path.join(root, ".cartridge/index.lock");
    await fs.mkdir(path.dirname(lockPath), { recursive: true });
    const held = await holdFixtureLock(lockPath);
    const replacementToken = randomUUID();
    const candidatePath = `${lockPath}.candidate-${process.pid}-${replacementToken}`;
    const replacementName = `owner-${replacementToken}.json`;
    const replacementContent = JSON.stringify({
      protocolVersion: 2, pid: process.pid, hostname: os.hostname(), token: replacementToken, createdAt: Date.now(),
    });
    await fs.mkdir(candidatePath);
    await fs.writeFile(path.join(candidatePath, replacementName), replacementContent);
    const unlink = fs.unlink.bind(fs);
    const release = vi.spyOn(fs, "unlink").mockImplementationOnce(async ownerPath => {
      expect(ownerPath).toBe(held.ownerPath);
      await unlink(ownerPath);
      // Force the valid interleaving: another contender reaps the now-empty
      // directory and publishes its prepared owner before our delayed rmdir.
      await fs.rmdir(lockPath);
      await fs.rename(candidatePath, lockPath);
    });
    try {
      await releaseFixtureLock();
      await releaseFixtureLock();
      expect(release).toHaveBeenCalledTimes(1);
      expect(await fs.readdir(lockPath)).toEqual([replacementName]);
      expect(await fs.readFile(path.join(lockPath, replacementName), "utf8")).toBe(replacementContent);
    } finally {
      release.mockRestore();
    }
  });
});
