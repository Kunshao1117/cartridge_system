import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createConfig } from "../config.js";
import { CartridgeIndexManager } from "../index-manager.js";
import {
  ProjectIndexLockCompatibilityError,
  ProjectIndexLockTimeoutError,
  runProjectIndexTransaction,
} from "../project-index-transaction.js";

const roots: string[] = [];
const deadPid = 999_999_999;
const shortTiming = { lockTimeoutMs: 500, retryMinMs: 1, retryMaxMs: 2, heartbeatMs: 0, localStaleMs: 0, remoteStaleMs: 1_000 };
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

async function createRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "index-lock-v2-"));
  roots.push(root);
  await fs.mkdir(path.join(root, ".cartridge"));
  await fs.writeFile(path.join(root, ".cartridge/index.json"), JSON.stringify({ version: 1, lastScanned: "initial", cartridges: {}, fileMap: {}, untrackedFiles: [] }));
  return root;
}

function owner(overrides: Partial<{ protocolVersion: number; pid: number; hostname: string; token: string; createdAt: number }> = {}) {
  return { protocolVersion: 2, pid: process.pid, hostname: os.hostname(), token: randomUUID(), createdAt: 0, ...overrides };
}

async function writeOwner(directory: string, data: ReturnType<typeof owner>, legacy = false) {
  await fs.mkdir(directory, { recursive: true });
  const ownerPath = path.join(directory, legacy ? "owner.json" : `owner-${data.token}.json`);
  const persisted = legacy ? { pid: data.pid, hostname: data.hostname, token: data.token, createdAt: data.createdAt } : data;
  await fs.writeFile(ownerPath, JSON.stringify(persisted));
  return ownerPath;
}

async function contents(directory: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const children = await contents(path.join(directory, entry.name));
      result[`${entry.name}/`] = "directory";
      for (const [name, raw] of Object.entries(children)) result[`${entry.name}/${name}`] = raw;
    } else result[entry.name] = await fs.readFile(path.join(directory, entry.name), "utf8");
  }
  return result;
}

function transact(root: string, mutation: () => Promise<void> = async () => undefined, timing = shortTiming) {
  return runProjectIndexTransaction({ projectRoot: root, indexManager: new CartridgeIndexManager(createConfig(root)), mutation, timing });
}

describe("CORE-R1 generation-specific lock protocol", () => {
  it("publishes a fully populated UUID owner using a sibling candidate rename", async () => {
    const root = await createRoot();
    const lockPath = path.join(root, ".cartridge/index.lock");
    const rename = fs.rename;
    let published = false;
    vi.spyOn(fs, "rename").mockImplementation(async (from, to) => {
      if (to === lockPath) {
        expect(path.basename(String(from))).toMatch(new RegExp(`^index\\.lock\\.candidate-${process.pid}-${uuid}$`, "i"));
        const names = await fs.readdir(from);
        expect(names).toHaveLength(1);
        expect(names[0]).toMatch(new RegExp(`^owner-${uuid}\\.json$`, "i"));
        const data = JSON.parse(await fs.readFile(path.join(String(from), names[0]), "utf8"));
        expect(data).toMatchObject({ protocolVersion: 2, pid: process.pid, hostname: os.hostname() });
        expect(names[0]).toBe(`owner-${data.token}.json`);
        await expect(fs.stat(lockPath)).rejects.toMatchObject({ code: "ENOENT" });
        published = true;
      }
      return rename(from, to);
    });
    await transact(root, async () => {
      expect(published).toBe(true);
      expect(await fs.readdir(lockPath)).toHaveLength(1);
      expect(await fs.readdir(lockPath)).not.toContain("owner.json");
    });
    await expect(fs.stat(lockPath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await fs.readdir(path.join(root, ".cartridge"))).toEqual(["index.json"]);
  });

  it.each([false, true])("never expires a live local PID even when its %s legacy lease is old", async legacy => {
    const root = await createRoot();
    const marker = await writeOwner(path.join(root, ".cartridge/index.lock"), owner(), legacy);
    await fs.utimes(marker, new Date(0), new Date(0));
    const before = await contents(path.join(root, ".cartridge"));
    const mutation = vi.fn(async () => undefined);
    await expect(transact(root, mutation)).rejects.toBeInstanceOf(ProjectIndexLockTimeoutError);
    expect(await contents(path.join(root, ".cartridge"))).toEqual(before);
    expect(mutation).not.toHaveBeenCalled();
  });

  it.each(["EPERM", "EINVAL"])("treats process liveness error %s as indeterminate, never proof of death", async code => {
    const root = await createRoot();
    const marker = await writeOwner(path.join(root, ".cartridge/index.lock"), owner({ pid: deadPid }));
    await fs.utimes(marker, new Date(0), new Date(0));
    const kill = process.kill.bind(process);
    vi.spyOn(process, "kill").mockImplementation((pid, signal) => {
      if (pid === deadPid) throw Object.assign(new Error(code), { code });
      return kill(pid, signal);
    });
    const before = await contents(path.join(root, ".cartridge"));
    await expect(transact(root)).rejects.toBeInstanceOf(ProjectIndexLockTimeoutError);
    expect(await contents(path.join(root, ".cartridge"))).toEqual(before);
  });

  it("waits for the grace period even when the local owner is demonstrably dead", async () => {
    const root = await createRoot();
    await writeOwner(path.join(root, ".cartridge/index.lock"), owner({ pid: deadPid, createdAt: Date.now() }));
    const before = await contents(path.join(root, ".cartridge"));
    await expect(transact(root, undefined, { ...shortTiming, localStaleMs: 60_000 })).rejects.toBeInstanceOf(ProjectIndexLockTimeoutError);
    expect(await contents(path.join(root, ".cartridge"))).toEqual(before);
  });

  it.each([false, true])("waits on a fresh remote %s legacy lease without changing any files", async legacy => {
    const root = await createRoot();
    await writeOwner(path.join(root, ".cartridge/index.lock"), owner({ hostname: "different-host", pid: deadPid, createdAt: Date.now() }), legacy);
    const before = await contents(path.join(root, ".cartridge"));
    await expect(transact(root)).rejects.toBeInstanceOf(ProjectIndexLockTimeoutError);
    expect(await contents(path.join(root, ".cartridge"))).toEqual(before);
  });

  it.each([false, true])("blocks stale remote %s legacy lease recovery without changing any files", async legacy => {
    const root = await createRoot();
    const marker = await writeOwner(path.join(root, ".cartridge/index.lock"), owner({ hostname: "different-host", pid: deadPid }), legacy);
    await fs.utimes(marker, new Date(0), new Date(0));
    const before = await contents(path.join(root, ".cartridge"));
    const mutation = vi.fn(async () => undefined);
    await expect(transact(root, mutation)).rejects.toBeInstanceOf(ProjectIndexLockCompatibilityError);
    expect(await contents(path.join(root, ".cartridge"))).toEqual(before);
    expect(mutation).not.toHaveBeenCalled();
  });

  it.each(["legacy-dead", "malformed", "unknown", "two-owners", "token-mismatch", "unsupported-version", "invalid-pid"])("fails closed on %s ownership with unchanged lock and canonical bytes", async kind => {
    const root = await createRoot();
    const lockPath = path.join(root, ".cartridge/index.lock");
    await fs.mkdir(lockPath);
    if (kind === "legacy-dead") await writeOwner(lockPath, owner({ pid: deadPid }), true);
    if (kind === "malformed") await fs.writeFile(path.join(lockPath, `owner-${randomUUID()}.json`), "{invalid json");
    if (kind === "unknown") await fs.writeFile(path.join(lockPath, "operator-notes.txt"), "Do not delete this file.");
    if (kind === "two-owners") { await writeOwner(lockPath, owner()); await writeOwner(lockPath, owner()); }
    if (kind === "token-mismatch") await fs.writeFile(path.join(lockPath, `owner-${randomUUID()}.json`), JSON.stringify(owner()));
    if (kind === "unsupported-version") await writeOwner(lockPath, owner({ protocolVersion: 3 }));
    if (kind === "invalid-pid") await writeOwner(lockPath, owner({ pid: -1 }));
    const before = await contents(path.join(root, ".cartridge"));
    const mutation = vi.fn(async () => undefined);
    await expect(transact(root, mutation)).rejects.toBeInstanceOf(ProjectIndexLockCompatibilityError);
    expect(await contents(path.join(root, ".cartridge"))).toEqual(before);
    expect(mutation).not.toHaveBeenCalled();
  });

  it("can follow a live legacy writer's natural release without claiming mixed-version recovery", async () => {
    const root = await createRoot();
    const lockPath = path.join(root, ".cartridge/index.lock");
    const marker = await writeOwner(lockPath, owner(), true);
    let released = false;
    const manager = new CartridgeIndexManager(createConfig(root));
    await runProjectIndexTransaction({ projectRoot: root, indexManager: manager, mutation: async () => { expect(released).toBe(true); }, timing: {
      ...shortTiming,
      lockTimeoutMs: 1_000,
      sleep: async () => { if (!released) { await fs.unlink(marker); await fs.rmdir(lockPath); released = true; } },
    } });
  });

  it("safely reclaims only an empty canonical lock left after unlink", async () => {
    const root = await createRoot();
    await fs.mkdir(path.join(root, ".cartridge/index.lock"));
    await expect(transact(root)).resolves.toBeDefined();
    expect(await fs.readdir(path.join(root, ".cartridge"))).toEqual(["index.json"]);
  });

  it("a stale recoverer cannot remove a newer owner installed before its exact unlink", async () => {
    const root = await createRoot();
    const lockPath = path.join(root, ".cartridge/index.lock");
    const stalePath = await writeOwner(lockPath, owner({ pid: deadPid }));
    await fs.utimes(stalePath, new Date(0), new Date(0));
    const replacement = owner();
    const unlink = fs.unlink;
    let replaced = false;
    vi.spyOn(fs, "unlink").mockImplementation(async candidate => {
      if (!replaced && candidate === stalePath) {
        replaced = true;
        await unlink(stalePath);
        await fs.rmdir(lockPath);
        await writeOwner(lockPath, replacement);
      }
      return unlink(candidate);
    });
    await expect(transact(root)).rejects.toBeInstanceOf(ProjectIndexLockTimeoutError);
    expect(replaced).toBe(true);
    expect(await fs.readdir(lockPath)).toEqual([`owner-${replacement.token}.json`]);
    expect(JSON.parse(await fs.readFile(path.join(lockPath, `owner-${replacement.token}.json`), "utf8"))).toEqual(replacement);
  });

  it("fences a lost generation and never releases or overwrites the replacement owner's data", async () => {
    const root = await createRoot();
    const lockPath = path.join(root, ".cartridge/index.lock");
    const indexPath = path.join(root, ".cartridge/index.json");
    const replacementIndex = JSON.stringify({ version: 1, lastScanned: "replacement-owner", cartridges: {}, fileMap: {}, untrackedFiles: [] });
    const replacement = owner();
    const manager = new CartridgeIndexManager(createConfig(root));
    await expect(runProjectIndexTransaction({ projectRoot: root, indexManager: manager, timing: shortTiming, mutation: async () => {
      manager.addUntrackedFile("src/fenced.ts", "add");
      manager.markDirty();
      const [name] = await fs.readdir(lockPath);
      await fs.unlink(path.join(lockPath, name));
      await fs.rmdir(lockPath);
      await writeOwner(lockPath, replacement);
      await fs.writeFile(indexPath, replacementIndex);
    } })).rejects.toThrow(/fencing|ownership was lost/);
    expect.soft(await fs.readFile(indexPath, "utf8")).toBe(replacementIndex);
    expect.soft(await fs.readdir(lockPath)).toEqual([`owner-${replacement.token}.json`]);
    expect(manager.hasDirtyChanges()).toBe(false);
    await manager.flushIfDirty();
    expect(await fs.readFile(indexPath, "utf8")).toBe(replacementIndex);
  });

  it("cleans only complete dead-local staging generations, leaving live and incomplete candidates inert", async () => {
    const root = await createRoot();
    const directory = path.join(root, ".cartridge");
    const dead = owner({ pid: deadPid });
    const live = owner();
    const remote = owner({ pid: deadPid, hostname: "different-host" });
    const stages = [dead, live, remote].map(data => ({ data, dir: path.join(directory, `index.lock.candidate-${data.pid}-${data.token}`) }));
    for (const { data, dir } of stages) {
      const marker = await writeOwner(dir, data);
      await fs.utimes(marker, new Date(0), new Date(0));
      await fs.utimes(dir, new Date(0), new Date(0));
    }
    const incomplete = path.join(directory, `index.lock.candidate-${deadPid}-${randomUUID()}`);
    await fs.mkdir(incomplete);
    await fs.utimes(incomplete, new Date(0), new Date(0));
    const partialToken = randomUUID();
    const partial = path.join(directory, `index.lock.candidate-${deadPid}-${partialToken}`);
    await fs.mkdir(partial);
    await fs.writeFile(path.join(partial, `owner-${partialToken}.json`), '{"protocolVersion":2');
    await fs.utimes(partial, new Date(0), new Date(0));
    const unknown = path.join(directory, "index.lock.candidate-not-a-generation");
    await fs.mkdir(unknown);
    await fs.writeFile(path.join(unknown, "notes.txt"), "Keep unrelated data.");
    const preservedDirectories = [stages[1].dir, stages[2].dir, incomplete, partial, unknown];
    const preserved = await Promise.all(preservedDirectories.map(contents));
    await transact(root);
    await expect(fs.stat(stages[0].dir)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await Promise.all(preservedDirectories.map(contents))).toEqual(preserved);
  });

  it("cleans its own interrupted staging without publishing an empty lock or changing the index", async () => {
    const root = await createRoot();
    const lockPath = path.join(root, ".cartridge/index.lock");
    const before = await contents(path.join(root, ".cartridge"));
    const rename = fs.rename;
    vi.spyOn(fs, "rename").mockImplementation(async (from, to) => {
      if (to === lockPath) throw Object.assign(new Error("interrupted publication"), { code: "EIO" });
      return rename(from, to);
    });
    await expect(transact(root)).rejects.toThrow("interrupted publication");
    expect(await contents(path.join(root, ".cartridge"))).toEqual(before);
  });
  it("a lost-generation heartbeat never recreates its owner marker in the replacement lock", async () => {
    const root = await createRoot();
    const lockPath = path.join(root, ".cartridge/index.lock");
    const replacement = owner();
    const manager = new CartridgeIndexManager(createConfig(root));
    await expect(runProjectIndexTransaction({ projectRoot: root, indexManager: manager,
      timing: { ...shortTiming, heartbeatMs: 5 }, mutation: async () => {
        manager.addUntrackedFile("heartbeat-lost.ts", "add"); manager.markDirty();
        const [oldName] = await fs.readdir(lockPath);
        await fs.unlink(path.join(lockPath, oldName)); await fs.rmdir(lockPath);
        await writeOwner(lockPath, replacement);
        await new Promise(resolve => setTimeout(resolve, 30));
        expect(await fs.readdir(lockPath)).toEqual([`owner-${replacement.token}.json`]);
      },
    })).rejects.toThrow(/fencing|ownership was lost/);
    expect(await fs.readdir(lockPath)).toEqual([`owner-${replacement.token}.json`]);
  });

  it("rejects a non-directory canonical lock without replacing it", async () => {
    const root = await createRoot();
    const lockPath = path.join(root, ".cartridge/index.lock");
    await fs.writeFile(lockPath, "unknown lock artifact");
    const before = await contents(path.join(root, ".cartridge"));
    const rename = vi.spyOn(fs, "rename");
    const mutation = vi.fn(async () => undefined);
    await expect.soft(transact(root, mutation)).rejects.toBeInstanceOf(ProjectIndexLockCompatibilityError);
    expect.soft(rename).not.toHaveBeenCalled();
    expect.soft(mutation).not.toHaveBeenCalled();
    expect.soft(await contents(path.join(root, ".cartridge"))).toEqual(before);
  });

});
