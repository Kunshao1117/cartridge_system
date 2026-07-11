import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CartridgeIndexManager } from "./index-manager.js";

const INDEX_RELATIVE_PATH = ".cartridge/index.json";
const LOCK_RELATIVE_PATH = ".cartridge/index.lock";
const OWNER_FILENAME = "owner.json";

interface LockOwner {
  pid: number;
  hostname: string;
  token: string;
  createdAt: number;
}

export interface ProjectIndexTransactionTiming {
  lockTimeoutMs: number;
  localStaleMs: number;
  remoteStaleMs: number;
  heartbeatMs: number;
  retryMinMs: number;
  retryMaxMs: number;
  replaceRetryCount: number;
  replaceRetryMs: number;
  now: () => number;
  random: () => number;
  sleep: (ms: number) => Promise<void>;
}

export interface ProjectIndexTransactionOptions<T> {
  projectRoot: string;
  indexManager: CartridgeIndexManager;
  mutation: () => Promise<T>;
  allowInvalidRepair?: boolean;
  persist?: boolean;
  timing?: Partial<ProjectIndexTransactionTiming>;
}

export interface ProjectIndexTransactionResult<T> {
  value: T;
  repairedInvalidIndex: boolean;
  fingerprint: string | null;
}

export type ExternalIndexReloadResult =
  | { status: "reloaded"; fingerprint: string }
  | { status: "self-write"; fingerprint: string }
  | { status: "missing" | "invalid"; warning: string };

export class ProjectIndexLockTimeoutError extends Error {
  constructor(projectRoot: string) {
    super(`Timed out waiting for project index lock: ${projectRoot}`);
    this.name = "ProjectIndexLockTimeoutError";
  }
}

export class ProjectIndexInvalidError extends Error {
  constructor(projectRoot: string) {
    super(
      `Canonical project index is invalid; an authoritative reindex is required: ${projectRoot}`,
    );
    this.name = "ProjectIndexInvalidError";
  }
}

export class ProjectIndexMissingError extends Error {
  constructor(projectRoot: string) {
    super(
      `Canonical project index was removed; retained the last committed state: ${projectRoot}`,
    );
    this.name = "ProjectIndexMissingError";
  }
}

const defaultTiming: ProjectIndexTransactionTiming = {
  lockTimeoutMs: 15_000,
  localStaleMs: 30_000,
  remoteStaleMs: 300_000,
  heartbeatMs: 5_000,
  retryMinMs: 40,
  retryMaxMs: 120,
  replaceRetryCount: 8,
  replaceRetryMs: 40,
  now: () => Date.now(),
  random: () => Math.random(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

const mutationContext = new AsyncLocalStorage<ReadonlySet<string>>();
const mutationTails = new Map<string, Promise<void>>();

export async function serializeProjectIndexMutation<T>(
  projectRoot: string,
  mutation: () => Promise<T>,
): Promise<T> {
  const key = normalizeProjectKey(projectRoot);
  const activeKeys = mutationContext.getStore();
  if (activeKeys?.has(key)) return mutation();

  const previous = mutationTails.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.catch(() => undefined).then(() => current);
  mutationTails.set(key, tail);

  await previous.catch(() => undefined);
  const nextKeys = new Set(activeKeys ?? []);
  nextKeys.add(key);
  try {
    return await mutationContext.run(nextKeys, mutation);
  } finally {
    release();
    if (mutationTails.get(key) === tail) mutationTails.delete(key);
  }
}

export async function runProjectIndexTransaction<T>(
  options: ProjectIndexTransactionOptions<T>,
): Promise<ProjectIndexTransactionResult<T>> {
  const projectRoot = path.resolve(options.projectRoot);
  const key = normalizeProjectKey(projectRoot);
  if (mutationContext.getStore()?.has(key)) {
    return {
      value: await options.mutation(),
      repairedInvalidIndex: false,
      fingerprint: options.indexManager.getCommittedFingerprint(),
    };
  }

  return serializeProjectIndexMutation(projectRoot, async () => {
    const timing = resolveTiming(options.timing);
    const lock = await acquireLock(projectRoot, timing);
    try {
      await cleanupStaleTemps(projectRoot, timing);
      const loaded = await options.indexManager.readPersistedIndex();
      const repairedInvalidIndex = loaded.status === "invalid";
      if (repairedInvalidIndex && !options.allowInvalidRepair) {
        options.indexManager.setSyncWarning(
          "Canonical project index is invalid; retained the last committed state.",
        );
        throw new ProjectIndexInvalidError(projectRoot);
      }
      if (loaded.status === "loaded") {
        options.indexManager.replaceCommittedIndex(
          loaded.index,
          loaded.fingerprint,
          false,
        );
      } else if (
        loaded.status === "missing" &&
        options.indexManager.getCommittedFingerprint() !== null &&
        !options.allowInvalidRepair
      ) {
        options.indexManager.setSyncWarning(
          "Canonical project index was removed; retained the last committed state.",
        );
        throw new ProjectIndexMissingError(projectRoot);
      } else if (loaded.status === "missing") {
        options.indexManager.setCommittedFingerprint(null);
      }

      const checkpoint = options.indexManager.captureTransactionState();
      try {
        const value = await options.mutation();
        let fingerprint = options.indexManager.getCommittedFingerprint();
        if ((options.persist ?? true) && options.indexManager.hasDirtyChanges()) {
          await assertLockOwnership(lock);
          const content = options.indexManager.serializeForPersistence();
          await atomicReplaceIndex(projectRoot, lock, content, timing);
          fingerprint = fingerprintContent(content);
          options.indexManager.acceptCommittedPersistence(fingerprint);
        }
        if (options.persist ?? true) {
          options.indexManager.clearSyncWarning();
          options.indexManager.notifyCommittedChange();
        }
        return { value, repairedInvalidIndex, fingerprint };
      } catch (error) {
        options.indexManager.restoreTransactionState(
          checkpoint,
          transactionFailureWarning(error),
        );
        options.indexManager.notifyCommittedChange();
        throw error;
      }
    } finally {
      await releaseLock(lock);
    }
  });
}

/**
 * Persist an already-mutated manager without allowing a stale cache to overwrite
 * a newer canonical file. Newer disk state wins and replaces the stale cache.
 */
export async function persistProjectIndexManager(
  projectRoot: string,
  indexManager: CartridgeIndexManager,
  timingOverrides?: Partial<ProjectIndexTransactionTiming>,
): Promise<boolean> {
  const root = path.resolve(projectRoot);
  const key = normalizeProjectKey(root);
  if (mutationContext.getStore()?.has(key)) return true;

  return serializeProjectIndexMutation(root, async () => {
    const timing = resolveTiming(timingOverrides);
    const rollback = indexManager.captureCommittedState();
    let lock: HeldLock | null = null;
    try {
      lock = await acquireLock(root, timing);
      const loaded = await indexManager.readPersistedIndex();
      if (loaded.status === "invalid") throw new ProjectIndexInvalidError(root);
      const baseFingerprint = indexManager.getCommittedFingerprint();
      if (
        loaded.status === "loaded" &&
        loaded.fingerprint !== baseFingerprint
      ) {
        indexManager.replaceCommittedIndex(
          loaded.index,
          loaded.fingerprint,
          true,
        );
        return false;
      }
      if (loaded.status === "missing" && baseFingerprint !== null) {
        indexManager.setSyncWarning(
          "Canonical project index was removed; retained the last committed state.",
        );
        indexManager.notifyCommittedChange();
        return false;
      }

      await assertLockOwnership(lock);
      const content = indexManager.serializeForPersistence();
      await atomicReplaceIndex(root, lock, content, timing);
      indexManager.acceptCommittedPersistence(fingerprintContent(content));
      indexManager.clearSyncWarning();
      indexManager.notifyCommittedChange();
      return true;
    } catch (error) {
      indexManager.restoreTransactionState(
        rollback,
        transactionFailureWarning(error),
      );
      indexManager.notifyCommittedChange();
      throw error;
    } finally {
      if (lock) await releaseLock(lock);
    }
  });
}

export async function reloadProjectIndexFromDisk(
  projectRoot: string,
  indexManager: CartridgeIndexManager,
  options: { retries?: number; retryMs?: number } = {},
): Promise<ExternalIndexReloadResult> {
  const retries = options.retries ?? 5;
  const retryMs = options.retryMs ?? 50;
  return serializeProjectIndexMutation(projectRoot, async () => {
    let loaded = await indexManager.readPersistedIndex();
    for (let attempt = 0; attempt < retries && loaded.status !== "loaded"; attempt += 1) {
      await defaultTiming.sleep(retryMs);
      loaded = await indexManager.readPersistedIndex();
    }

    if (loaded.status === "loaded") {
      if (loaded.fingerprint === indexManager.getCommittedFingerprint()) {
        return { status: "self-write", fingerprint: loaded.fingerprint };
      }
      indexManager.replaceCommittedIndex(loaded.index, loaded.fingerprint, true);
      indexManager.clearSyncWarning();
      return { status: "reloaded", fingerprint: loaded.fingerprint };
    }

    const warning =
      loaded.status === "missing"
        ? "Canonical project index was removed; retained the last committed state."
        : "Canonical project index is temporarily invalid; retained the last committed state.";
    indexManager.setSyncWarning(warning);
    indexManager.notifyCommittedChange();
    return { status: loaded.status, warning };
  });
}

export function fingerprintContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function resolveTiming(
  overrides?: Partial<ProjectIndexTransactionTiming>,
): ProjectIndexTransactionTiming {
  return { ...defaultTiming, ...overrides };
}

function normalizeProjectKey(projectRoot: string): string {
  const resolved = path.resolve(projectRoot);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

interface HeldLock {
  projectRoot: string;
  lockPath: string;
  ownerPath: string;
  owner: LockOwner;
  heartbeatTimer: NodeJS.Timeout | null;
  heartbeatInFlight: Promise<void>;
  released: boolean;
}

async function acquireLock(
  projectRoot: string,
  timing: ProjectIndexTransactionTiming,
): Promise<HeldLock> {
  const cartridgeDir = path.resolve(projectRoot, ".cartridge");
  const lockPath = path.resolve(projectRoot, LOCK_RELATIVE_PATH);
  assertInsideProject(projectRoot, lockPath);
  await fs.mkdir(cartridgeDir, { recursive: true });
  const deadline = timing.now() + timing.lockTimeoutMs;

  while (true) {
    const owner: LockOwner = {
      pid: process.pid,
      hostname: os.hostname(),
      token: randomUUID(),
      createdAt: timing.now(),
    };
    let created = false;
    try {
      await fs.mkdir(lockPath);
      created = true;
      const ownerPath = path.join(lockPath, OWNER_FILENAME);
      await fs.writeFile(ownerPath, JSON.stringify(owner), {
        encoding: "utf8",
        flag: "wx",
      });
      const lock: HeldLock = {
        projectRoot,
        lockPath,
        ownerPath,
        owner,
        heartbeatTimer: null,
        heartbeatInFlight: Promise.resolve(),
        released: false,
      };
      startLockHeartbeat(lock, timing);
      return lock;
    } catch (error) {
      if (created) {
        await fs.rm(lockPath, { recursive: true, force: true }).catch(() => undefined);
        throw error;
      }
      if (!isErrorCode(error, "EEXIST")) throw error;
      if (await canRecoverStaleLock(lockPath, timing)) {
        await recoverStaleLock(projectRoot, lockPath);
        continue;
      }
      if (timing.now() >= deadline) {
        throw new ProjectIndexLockTimeoutError(projectRoot);
      }
      const spread = timing.retryMaxMs - timing.retryMinMs;
      await timing.sleep(timing.retryMinMs + Math.floor(timing.random() * spread));
    }
  }
}

async function canRecoverStaleLock(
  lockPath: string,
  timing: ProjectIndexTransactionTiming,
): Promise<boolean> {
  let owner: LockOwner | null = null;
  try {
    owner = JSON.parse(
      await fs.readFile(path.join(lockPath, OWNER_FILENAME), "utf8"),
    ) as LockOwner;
  } catch {
    try {
      const stat = await fs.stat(lockPath);
      return timing.now() - stat.mtimeMs >= timing.remoteStaleMs;
    } catch {
      return false;
    }
  }
  if (!isLockOwner(owner)) return false;
  let ownerMtime = owner.createdAt;
  try {
    ownerMtime = (await fs.stat(path.join(lockPath, OWNER_FILENAME))).mtimeMs;
  } catch {
    return false;
  }
  const age = timing.now() - Math.max(owner.createdAt, ownerMtime);
  if (owner.hostname !== os.hostname()) return age >= timing.remoteStaleMs;
  if (isProcessAlive(owner.pid)) return false;
  return age >= timing.localStaleMs;
}

async function recoverStaleLock(
  projectRoot: string,
  lockPath: string,
): Promise<void> {
  const stalePath = `${lockPath}.stale-${process.pid}-${randomUUID()}`;
  assertInsideProject(projectRoot, stalePath);
  try {
    await fs.rename(lockPath, stalePath);
  } catch (error) {
    if (isErrorCode(error, "ENOENT")) return;
    throw error;
  }
  await fs.rm(stalePath, { recursive: true, force: true });
}

async function assertLockOwnership(lock: HeldLock): Promise<void> {
  let current: LockOwner;
  try {
    current = JSON.parse(await fs.readFile(lock.ownerPath, "utf8")) as LockOwner;
  } catch {
    throw new Error("Project index lock ownership was lost before commit.");
  }
  if (!isLockOwner(current) || current.token !== lock.owner.token) {
    throw new Error("Project index lock fencing token no longer matches.");
  }
}

async function releaseLock(lock: HeldLock): Promise<void> {
  await stopLockHeartbeat(lock);
  try {
    await assertLockOwnership(lock);
  } catch {
    return;
  }
  assertInsideProject(lock.projectRoot, lock.lockPath);
  await fs.rm(lock.lockPath, { recursive: true, force: true });
}

function startLockHeartbeat(
  lock: HeldLock,
  timing: ProjectIndexTransactionTiming,
): void {
  if (timing.heartbeatMs <= 0) return;
  lock.heartbeatTimer = setInterval(() => {
    lock.heartbeatInFlight = lock.heartbeatInFlight
      .then(async () => {
        if (lock.released) return;
        await assertLockOwnership(lock);
        const heartbeat = new Date(timing.now());
        await fs.utimes(lock.ownerPath, heartbeat, heartbeat);
      })
      .catch(() => undefined);
  }, timing.heartbeatMs);
  lock.heartbeatTimer.unref?.();
}

async function stopLockHeartbeat(lock: HeldLock): Promise<void> {
  lock.released = true;
  if (lock.heartbeatTimer) {
    clearInterval(lock.heartbeatTimer);
    lock.heartbeatTimer = null;
  }
  await lock.heartbeatInFlight;
}

async function atomicReplaceIndex(
  projectRoot: string,
  lock: HeldLock,
  content: string,
  timing: ProjectIndexTransactionTiming,
): Promise<void> {
  const indexPath = path.resolve(projectRoot, INDEX_RELATIVE_PATH);
  const tempPath = path.join(
    path.dirname(indexPath),
    `index.${process.pid}.${lock.owner.token}.tmp`,
  );
  assertInsideProject(projectRoot, tempPath);
  const handle = await fs.open(tempPath, "wx", 0o600);
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }

  try {
    for (let attempt = 0; ; attempt += 1) {
      await assertLockOwnership(lock);
      try {
        await fs.rename(tempPath, indexPath);
        return;
      } catch (error) {
        if (
          attempt >= timing.replaceRetryCount ||
          !isReplaceRetryable(error)
        ) {
          throw error;
        }
        await timing.sleep(timing.replaceRetryMs * (attempt + 1));
      }
    }
  } finally {
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
  }
}

async function cleanupStaleTemps(
  projectRoot: string,
  timing: ProjectIndexTransactionTiming,
): Promise<void> {
  const cartridgeDir = path.resolve(projectRoot, ".cartridge");
  let names: string[];
  try {
    names = await fs.readdir(cartridgeDir);
  } catch {
    return;
  }
  for (const name of names) {
    if (!/^index\.\d+\.[0-9a-f-]+\.tmp$/i.test(name)) continue;
    const candidate = path.join(cartridgeDir, name);
    try {
      const stat = await fs.stat(candidate);
      if (timing.now() - stat.mtimeMs < timing.remoteStaleMs) continue;
      await fs.rm(candidate, { force: true });
    } catch {
      // A stale temp is diagnostic debris only; never fail the canonical commit.
    }
  }
}

function isLockOwner(value: unknown): value is LockOwner {
  if (!value || typeof value !== "object") return false;
  const owner = value as Partial<LockOwner>;
  return (
    typeof owner.pid === "number" &&
    typeof owner.hostname === "string" &&
    typeof owner.token === "string" &&
    typeof owner.createdAt === "number"
  );
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return isErrorCode(error, "EPERM");
  }
}

function isReplaceRetryable(error: unknown): boolean {
  return (
    isErrorCode(error, "EACCES") ||
    isErrorCode(error, "EBUSY") ||
    isErrorCode(error, "EPERM") ||
    isErrorCode(error, "EEXIST")
  );
}

function isErrorCode(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}

function transactionFailureWarning(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `Project index synchronization failed; retained the last committed state: ${message}`;
}

function assertInsideProject(projectRoot: string, candidate: string): void {
  const root = path.resolve(projectRoot);
  const resolved = path.resolve(candidate);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Project index path escaped project root: ${resolved}`);
  }
}
