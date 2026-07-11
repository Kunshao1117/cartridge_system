import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createConfig } from "../config.js";
import { CartridgeIndexManager } from "../index-manager.js";
import {
  fingerprintContent,
  ProjectIndexInvalidError,
  ProjectIndexLockTimeoutError,
  ProjectIndexMissingError,
  reloadProjectIndexFromDisk,
  runProjectIndexTransaction,
} from "../project-index-transaction.js";
import { refreshMemoryIndex } from "../memory-reindex.js";
import type { CartridgeIndex } from "../types.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("project index transaction", () => {
  it("preserves concurrent mutations from independent manager instances", async () => {
    const root = await createRoot();
    const first = new CartridgeIndexManager(createConfig(root));
    const second = new CartridgeIndexManager(createConfig(root));

    await Promise.all([
      runProjectIndexTransaction({
        projectRoot: root,
        indexManager: first,
        mutation: async () => {
          first.addUntrackedFile("src/first.ts", "add");
          first.markDirty();
        },
      }),
      runProjectIndexTransaction({
        projectRoot: root,
        indexManager: second,
        mutation: async () => {
          second.addUntrackedFile("src/second.ts", "add");
          second.markDirty();
        },
      }),
    ]);

    const persisted = await readIndex(root);
    expect(persisted.untrackedFiles?.map((entry) => entry.filePath).sort()).toEqual([
      "src/first.ts",
      "src/second.ts",
    ]);
  });

  it("leaves the previous canonical JSON intact when mutation throws", async () => {
    const root = await createRoot();
    const indexPath = path.join(root, ".cartridge", "index.json");
    const before = await fs.readFile(indexPath, "utf8");
    const manager = new CartridgeIndexManager(createConfig(root));

    await expect(
      runProjectIndexTransaction({
        projectRoot: root,
        indexManager: manager,
        mutation: async () => {
          manager.addUntrackedFile("src/not-committed.ts", "add");
          manager.markDirty();
          throw new Error("crash before replace");
        },
      }),
    ).rejects.toThrow("crash before replace");

    expect(await fs.readFile(indexPath, "utf8")).toBe(before);
    expect(manager.getUntrackedFiles()).toEqual([]);
    expect(manager.hasDirtyChanges()).toBe(false);
    expect(manager.getCommittedFingerprint()).toBe(fingerprintContent(before));
    expect(manager.getSyncWarning()).toMatch(/retained the last committed state/);

    await manager.flushIfDirty();
    expect(await fs.readFile(indexPath, "utf8")).toBe(before);
  });

  it("does not repair an invalid canonical index from a partial refresh", async () => {
    const root = await createRoot();
    const indexPath = path.join(root, ".cartridge", "index.json");
    const manager = new CartridgeIndexManager(createConfig(root));
    await manager.load();
    const committed = manager.getVisibleIndex();
    await fs.writeFile(indexPath, "{ invalid json", "utf8");

    await expect(
      refreshMemoryIndex({
        projectRoot: root,
        indexManager: manager,
        includeProjectFiles: false,
        persist: true,
      }),
    ).rejects.toBeInstanceOf(ProjectIndexInvalidError);

    expect(await fs.readFile(indexPath, "utf8")).toBe("{ invalid json");
    expect(manager.getVisibleIndex()).toEqual(committed);
    expect(manager.getSyncWarning()).toMatch(/invalid/);
  });

  it("bootstraps a never-existing canonical index without writing it when persist is false", async () => {
    const root = await createRoot();
    const indexPath = path.join(root, ".cartridge", "index.json");
    await fs.mkdir(path.join(root, ".agents", "memory"), { recursive: true });
    await fs.rm(indexPath);
    const manager = new CartridgeIndexManager(createConfig(root));

    const result = await refreshMemoryIndex({
      projectRoot: root,
      indexManager: manager,
      detectMissedChanges: false,
      includeProjectFiles: false,
      persist: false,
    });

    expect(result.index.cartridges).toEqual({});
    await expect(fs.stat(indexPath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(manager.getCommittedFingerprint()).toBeNull();
  });

  it("fails closed when a previously loaded canonical index is deleted", async () => {
    const root = await createRoot();
    const indexPath = path.join(root, ".cartridge", "index.json");
    const manager = new CartridgeIndexManager(createConfig(root));
    await expect(manager.load()).resolves.toBe(true);
    const visibleBefore = manager.getVisibleIndex();
    const committedBefore = manager.captureCommittedState().index;
    const fingerprintBefore = manager.getCommittedFingerprint();
    await fs.rm(indexPath);

    await expect(
      refreshMemoryIndex({
        projectRoot: root,
        indexManager: manager,
        detectMissedChanges: false,
        includeProjectFiles: false,
        persist: false,
      }),
    ).rejects.toBeInstanceOf(ProjectIndexMissingError);

    await expect(fs.stat(indexPath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(manager.getVisibleIndex()).toEqual(visibleBefore);
    expect(manager.captureCommittedState().index).toEqual(committedBefore);
    expect(manager.hasDirtyChanges()).toBe(false);
    expect(manager.getCommittedFingerprint()).toBe(fingerprintBefore);
    expect(manager.getSyncWarning()).toMatch(/removed/);
  });

  it("does not let a stale manager flush overwrite a newer committed state", async () => {
    const root = await createRoot();
    const newer = new CartridgeIndexManager(createConfig(root));
    const stale = new CartridgeIndexManager(createConfig(root));
    await Promise.all([newer.load(), stale.load()]);

    await runProjectIndexTransaction({
      projectRoot: root,
      indexManager: newer,
      mutation: async () => {
        newer.addUntrackedFile("src/newer.ts", "add");
        newer.markDirty();
      },
    });
    stale.addUntrackedFile("src/stale.ts", "add");
    stale.markDirty();
    await stale.flushIfDirty();

    const persisted = await readIndex(root);
    expect(persisted.untrackedFiles?.map((entry) => entry.filePath)).toEqual([
      "src/newer.ts",
    ]);
    expect(stale.getUntrackedFiles().map((entry) => entry.filePath)).toEqual([
      "src/newer.ts",
    ]);
  });

  it("recovers a stale local lock but times out on a live lock", async () => {
    const root = await createRoot();
    const lockPath = path.join(root, ".cartridge", "index.lock");
    await fs.mkdir(lockPath);
    await fs.writeFile(
      path.join(lockPath, "owner.json"),
      JSON.stringify({
        pid: 999_999_999,
        hostname: os.hostname(),
        token: "stale",
        createdAt: 0,
      }),
    );
    const manager = new CartridgeIndexManager(createConfig(root));
    await expect(
      runProjectIndexTransaction({
        projectRoot: root,
        indexManager: manager,
        timing: { localStaleMs: 0 },
        mutation: async () => {
          manager.addUntrackedFile("src/recovered.ts", "add");
          manager.markDirty();
        },
      }),
    ).resolves.toBeDefined();

    await fs.mkdir(lockPath);
    await fs.writeFile(
      path.join(lockPath, "owner.json"),
      JSON.stringify({
        pid: process.pid,
        hostname: os.hostname(),
        token: "live",
        createdAt: Date.now(),
      }),
    );
    await expect(
      runProjectIndexTransaction({
        projectRoot: root,
        indexManager: manager,
        timing: {
          lockTimeoutMs: 5,
          retryMinMs: 1,
          retryMaxMs: 2,
        },
        mutation: async () => undefined,
      }),
    ).rejects.toBeInstanceOf(ProjectIndexLockTimeoutError);
  });

  it("refreshes the held lock heartbeat and respects a fresh remote lease", async () => {
    const root = await createRoot();
    const lockPath = path.join(root, ".cartridge", "index.lock");
    const ownerPath = path.join(lockPath, "owner.json");
    const manager = new CartridgeIndexManager(createConfig(root));
    let releaseMutation!: () => void;
    let mutationStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      mutationStarted = resolve;
    });
    const hold = new Promise<void>((resolve) => {
      releaseMutation = resolve;
    });
    const transaction = runProjectIndexTransaction({
      projectRoot: root,
      indexManager: manager,
      timing: { heartbeatMs: 5 },
      mutation: async () => {
        mutationStarted();
        await hold;
      },
    });
    await started;
    const initialMtime = (await fs.stat(ownerPath)).mtimeMs;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect((await fs.stat(ownerPath)).mtimeMs).toBeGreaterThan(initialMtime);
    releaseMutation();
    await transaction;

    await fs.mkdir(lockPath);
    await fs.writeFile(
      ownerPath,
      JSON.stringify({
        pid: 1,
        hostname: "remote-host.example",
        token: "remote-live",
        createdAt: 0,
      }),
    );
    await expect(
      runProjectIndexTransaction({
        projectRoot: root,
        indexManager: manager,
        timing: {
          lockTimeoutMs: 5,
          remoteStaleMs: 1_000,
          retryMinMs: 1,
          retryMaxMs: 2,
        },
        mutation: async () => undefined,
      }),
    ).rejects.toBeInstanceOf(ProjectIndexLockTimeoutError);

    const stale = new Date(Date.now() - 2_000);
    await fs.utimes(ownerPath, stale, stale);
    await expect(
      runProjectIndexTransaction({
        projectRoot: root,
        indexManager: manager,
        timing: { remoteStaleMs: 1_000 },
        mutation: async () => undefined,
      }),
    ).resolves.toBeDefined();
  });

  it("atomically replaces an existing canonical index on two successive commits", async () => {
    const root = await createRoot();
    const manager = new CartridgeIndexManager(createConfig(root));

    for (const filePath of ["src/windows-first.ts", "src/windows-second.ts"]) {
      await runProjectIndexTransaction({
        projectRoot: root,
        indexManager: manager,
        mutation: async () => {
          manager.addUntrackedFile(filePath, "add");
          manager.markDirty();
        },
      });
      const content = await fs.readFile(
        path.join(root, ".cartridge", "index.json"),
        "utf8",
      );
      expect(() => JSON.parse(content)).not.toThrow();
    }

    expect(
      (await readIndex(root)).untrackedFiles?.map((entry) => entry.filePath),
    ).toEqual(["src/windows-first.ts", "src/windows-second.ts"]);
  });

  it("fences a writer whose owner token changes before replacement", async () => {
    const root = await createRoot();
    const before = await fs.readFile(
      path.join(root, ".cartridge", "index.json"),
      "utf8",
    );
    const manager = new CartridgeIndexManager(createConfig(root));

    await expect(
      runProjectIndexTransaction({
        projectRoot: root,
        indexManager: manager,
        mutation: async () => {
          manager.addUntrackedFile("src/fenced.ts", "add");
          manager.markDirty();
          const ownerPath = path.join(
            root,
            ".cartridge",
            "index.lock",
            "owner.json",
          );
          const owner = JSON.parse(await fs.readFile(ownerPath, "utf8"));
          await fs.writeFile(ownerPath, JSON.stringify({ ...owner, token: "replaced" }));
        },
      }),
    ).rejects.toThrow(/fencing token|ownership was lost/);
    expect(
      await fs.readFile(path.join(root, ".cartridge", "index.json"), "utf8"),
    ).toBe(before);
    expect(manager.getUntrackedFiles()).toEqual([]);
    expect(manager.hasDirtyChanges()).toBe(false);
    await manager.flushIfDirty();
    expect(
      await fs.readFile(path.join(root, ".cartridge", "index.json"), "utf8"),
    ).toBe(before);
  });

  it("reloads an external atomic replacement once and suppresses self writes", async () => {
    const root = await createRoot();
    const manager = new CartridgeIndexManager(createConfig(root));
    await manager.load();
    const changed = vi.fn();
    manager.onChanged = changed;
    const replacement = emptyIndex();
    replacement.lastScanned = "external";
    replacement.untrackedFiles = [
      {
        filePath: "src/external.ts",
        suggestedOwner: null,
        detectedAt: "now",
        lastEvent: "add",
      },
    ];
    await fs.writeFile(
      path.join(root, ".cartridge", "index.json"),
      JSON.stringify(replacement, null, 2),
    );

    await expect(reloadProjectIndexFromDisk(root, manager)).resolves.toMatchObject({
      status: "reloaded",
    });
    expect(changed).toHaveBeenCalledTimes(1);
    await expect(reloadProjectIndexFromDisk(root, manager)).resolves.toMatchObject({
      status: "self-write",
    });
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("retains the last committed cache when the canonical index is deleted", async () => {
    const root = await createRoot();
    const manager = new CartridgeIndexManager(createConfig(root));
    await manager.load();
    const before = manager.getIndex();
    await fs.rm(path.join(root, ".cartridge", "index.json"));

    await expect(
      reloadProjectIndexFromDisk(root, manager, { retries: 0 }),
    ).resolves.toMatchObject({ status: "missing" });
    expect(manager.getIndex()).toBe(before);
    expect(manager.getSyncWarning()).toMatch(/removed/);
  });
});

async function createRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-index-tx-"));
  roots.push(root);
  await fs.mkdir(path.join(root, ".cartridge"), { recursive: true });
  await fs.writeFile(
    path.join(root, ".cartridge", "index.json"),
    JSON.stringify(emptyIndex(), null, 2),
  );
  return root;
}

async function readIndex(root: string): Promise<CartridgeIndex> {
  return JSON.parse(
    await fs.readFile(path.join(root, ".cartridge", "index.json"), "utf8"),
  ) as CartridgeIndex;
}

function emptyIndex(): CartridgeIndex {
  return {
    version: 1,
    lastScanned: "initial",
    cartridges: {},
    fileMap: {},
    untrackedFiles: [],
  };
}
