import { assertPathInsideProject } from "./file-containment.js";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CartridgeIndexManager } from "./index-manager.js";

const INDEX_RELATIVE_PATH = ".cartridge/index.json";
const LOCK_RELATIVE_PATH = ".cartridge/index.lock";
const LEGACY_OWNER_FILENAME = "owner.json";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OWNER_FILENAME_PATTERN = /^owner-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.json$/i;

interface LockOwner {
  protocolVersion: 2;
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

/** Unsafe/unknown generations are never guessed stale or removed automatically. */
export class ProjectIndexLockCompatibilityError extends Error {
  constructor(projectRoot: string, reason: string) {
    super(`Project index lock requires coordinated restart or recovery: ${reason}. Stop all VS Code, Desktop and MCP clients before inspecting/removing an abandoned lock; do not mix old and new versions. Project: ${projectRoot}`);
    this.name = "ProjectIndexLockCompatibilityError";
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

type ObservedLock =
  | { kind: "missing" }
  | { kind: "empty" }
  | { kind: "legacy"; owner: Omit<LockOwner, "protocolVersion">; ownerMtime: number }
  | { kind: "current"; owner: LockOwner; ownerPath: string; ownerMtime: number };

function ownerFilename(token: string): string {
  return `owner-${token}.json`;
}

async function acquireLock(
  projectRoot: string,
  timing: ProjectIndexTransactionTiming,
): Promise<HeldLock> {
  const cartridgeDir = path.resolve(projectRoot, ".cartridge");
  const lockPath = path.resolve(projectRoot, LOCK_RELATIVE_PATH);
  assertInsideProject(projectRoot, lockPath);
  await fs.mkdir(assertPathInsideProject(projectRoot, cartridgeDir), { recursive: true });
  await cleanupStaleLockCandidates(projectRoot, timing);
  const owner: LockOwner = {
    protocolVersion: 2, pid: process.pid, hostname: os.hostname(), token: randomUUID(), createdAt: timing.now(),
  };
  const candidatePath = `${lockPath}.candidate-${owner.pid}-${owner.token}`;
  const candidateOwnerPath = path.join(candidatePath, ownerFilename(owner.token));
  let candidateCreated = false;
  try {
    // Publish only complete nonempty directories. Other v2 contenders can never
    // mistake an initializing owner for an empty abandoned canonical lock.
    await fs.mkdir(assertPathInsideProject(projectRoot, candidatePath));
    candidateCreated = true;
    const handle = await fs.open(assertPathInsideProject(projectRoot, candidateOwnerPath), "wx", 0o600);
    try {
      await handle.writeFile(JSON.stringify(owner), "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    const deadline = timing.now() + timing.lockTimeoutMs;
    let attempted = false;
    while (true) {
      if (attempted && timing.now() >= deadline) throw new ProjectIndexLockTimeoutError(projectRoot);
      attempted = true;
      try {
        await fs.rename(assertPathInsideProject(projectRoot, candidatePath), assertPathInsideProject(projectRoot, lockPath));
        candidateCreated = false;
        const lock: HeldLock = {
          projectRoot, lockPath, ownerPath: path.join(lockPath, ownerFilename(owner.token)), owner,
          heartbeatTimer: null, heartbeatInFlight: Promise.resolve(), released: false,
        };
        startLockHeartbeat(lock, timing);
        return lock;
      } catch (error) {
        // Windows reports existing directories as EPERM/EACCES on some versions.
        // Distinguish actual contention from a filesystem failure on a free path.
        if (!isLockContention(error)) throw error;
        const observed = await observeLock(projectRoot, lockPath);
        if (observed.kind === "missing") {
          await timing.sleep(timing.retryMinMs);
          continue;
        }
        if (observed.kind === "empty") {
          await removeEmptyLockDirectory(projectRoot, lockPath);
          continue;
        }
        const age = timing.now() - Math.max(observed.owner.createdAt, observed.ownerMtime);
        if (observed.owner.hostname !== os.hostname()) {
          if (age >= timing.remoteStaleMs) {
            throw new ProjectIndexLockCompatibilityError(projectRoot, "remote owner liveness cannot be proven; automatic lease expiry is disabled");
          }
        } else if (!isProcessAlive(observed.owner.pid)) {
          if (observed.kind === "legacy") {
            throw new ProjectIndexLockCompatibilityError(projectRoot, "abandoned legacy owner.json cannot be safely reclaimed by this protocol");
          }
          if (age >= timing.localStaleMs) {
            await recoverStaleLock(projectRoot, lockPath, observed.ownerPath);
            continue;
          }
        }
        if (timing.now() >= deadline) throw new ProjectIndexLockTimeoutError(projectRoot);
        const spread = Math.max(0, timing.retryMaxMs - timing.retryMinMs);
        await timing.sleep(timing.retryMinMs + Math.floor(timing.random() * spread));
      }
    }
  } finally {
    if (candidateCreated) {
      // Only our never-published, UUID-specific staging location is cleaned.
      await fs.unlink(assertPathInsideProject(projectRoot, candidateOwnerPath)).catch(() => undefined);
      await fs.rmdir(assertPathInsideProject(projectRoot, candidatePath)).catch(() => undefined);
    }
  }
}

async function observeLock(projectRoot: string, lockPath: string): Promise<ObservedLock> {
  try {
    const stat = await fs.lstat(assertPathInsideProject(projectRoot, lockPath));
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new ProjectIndexLockCompatibilityError(projectRoot, "canonical lock is not an ordinary directory");
    }
    const names = await fs.readdir(assertPathInsideProject(projectRoot, lockPath));
    if (names.length === 0) return { kind: "empty" };
    if (names.length !== 1) throw new ProjectIndexLockCompatibilityError(projectRoot, "lock contains unknown or multiple owner files");
    const name = names[0];
    const match = name.match(OWNER_FILENAME_PATTERN);
    if (!match && name !== LEGACY_OWNER_FILENAME) {
      throw new ProjectIndexLockCompatibilityError(projectRoot, "unrecognized lock ownership format");
    }
    const ownerPath = path.join(lockPath, name);
    const ownerStat = await fs.lstat(assertPathInsideProject(projectRoot, ownerPath));
    if (!ownerStat.isFile() || ownerStat.isSymbolicLink()) {
      throw new ProjectIndexLockCompatibilityError(projectRoot, "owner marker is not an ordinary file");
    }
    let owner: unknown;
    try {
      owner = JSON.parse(await fs.readFile(assertPathInsideProject(projectRoot, ownerPath), "utf8"));
    } catch (error) {
      if (isErrorCode(error, "ENOENT")) return { kind: "missing" };
      throw new ProjectIndexLockCompatibilityError(projectRoot, "incomplete or unreadable owner metadata");
    }
    if (name === LEGACY_OWNER_FILENAME && isOwnerMetadata(owner) && !("protocolVersion" in owner)) {
      return { kind: "legacy", owner, ownerMtime: ownerStat.mtimeMs };
    }
    if (!isLockOwner(owner) || owner.token !== match?.[1]) {
      throw new ProjectIndexLockCompatibilityError(projectRoot, "owner token does not match its generation-specific filename");
    }
    return { kind: "current", owner, ownerPath, ownerMtime: ownerStat.mtimeMs };
  } catch (error) {
    if (isErrorCode(error, "ENOENT")) return { kind: "missing" };
    throw error;
  }
}

async function recoverStaleLock(projectRoot: string, lockPath: string, observedOwnerPath: string): Promise<void> {
  try {
    // No common filename or directory rename: a delayed reaper's exact marker
    // can never identify a later owner's UUID, even after its stale check pauses.
    await fs.unlink(assertPathInsideProject(projectRoot, observedOwnerPath));
  } catch (error) {
    if (isErrorCode(error, "ENOENT")) return;
    throw error;
  }
  await removeEmptyLockDirectory(projectRoot, lockPath);
}

async function removeEmptyLockDirectory(projectRoot: string, lockPath: string): Promise<void> {
  try {
    await fs.rmdir(assertPathInsideProject(projectRoot, lockPath));
  } catch (error) {
    if (isErrorCode(error, "ENOENT") || isErrorCode(error, "ENOTEMPTY") || isErrorCode(error, "EEXIST")) return;
    // A populated replacement may produce EACCES/EPERM on Windows. Verify it
    // exists and keep it; never turn a failed rmdir into recursive cleanup.
    if (isErrorCode(error, "EACCES") || isErrorCode(error, "EPERM")) {
      try {
        if ((await fs.readdir(assertPathInsideProject(projectRoot, lockPath))).length > 0) return;
      } catch (readError) { if (isErrorCode(readError, "ENOENT")) return; }
    }
    throw error;
  }
}

async function cleanupStaleLockCandidates(projectRoot: string, timing: ProjectIndexTransactionTiming): Promise<void> {
  const directory = path.resolve(projectRoot, ".cartridge");
  const names = await fs.readdir(assertPathInsideProject(projectRoot, directory));
  for (const name of names) {
    const match = name.match(/^index\.lock\.candidate-(\d+)-([0-9a-f-]+)$/i);
    if (!match || !UUID_PATTERN.test(match[2])) continue;
    const candidate = path.join(directory, name);
    try {
      const observed = await observeLock(projectRoot, candidate);
      // Partial staging metadata proves neither host nor process ownership.
      // Preserve it rather than guessing that an initializing contender died.
      if (observed.kind !== "current" || observed.owner.token !== match[2] || observed.owner.pid !== Number(match[1]) ||
          observed.owner.hostname !== os.hostname() || isProcessAlive(observed.owner.pid) ||
          timing.now() - Math.max(observed.owner.createdAt, observed.ownerMtime) < timing.localStaleMs) continue;
      await recoverStaleLock(projectRoot, candidate, observed.ownerPath);
    } catch {
      // Unknown staging debris does not grant ownership and must remain inert.
    }
  }
}

function isLockContention(error: unknown): boolean {
  return isErrorCode(error, "EEXIST") || isErrorCode(error, "ENOTEMPTY") ||
    isErrorCode(error, "ENOTDIR") || isErrorCode(error, "EISDIR") ||
    isErrorCode(error, "EACCES") || isErrorCode(error, "EPERM");
}

async function assertLockOwnership(lock: HeldLock): Promise<void> {
  let current: LockOwner;
  try {
    current = JSON.parse(await fs.readFile(assertPathInsideProject(lock.projectRoot, lock.ownerPath), "utf8")) as LockOwner;
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
  // A newer generation has a different marker. Even a delayed release cannot
  // delete it; nonrecursive rmdir preserves any populated replacement directory.
  await recoverStaleLock(lock.projectRoot, lock.lockPath, lock.ownerPath);
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
        await fs.utimes(assertPathInsideProject(lock.projectRoot, lock.ownerPath), heartbeat, heartbeat);
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
        await fs.rename(assertPathInsideProject(projectRoot, tempPath), assertPathInsideProject(projectRoot, indexPath));
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
    await fs.rm(assertPathInsideProject(projectRoot, tempPath), { force: true }).catch(() => undefined);
  }
}

async function cleanupStaleTemps(
  projectRoot: string,
  timing: ProjectIndexTransactionTiming,
): Promise<void> {
  const cartridgeDir = path.resolve(projectRoot, ".cartridge");
  let names: string[];
  try {
    names = await fs.readdir(assertPathInsideProject(projectRoot, cartridgeDir));
  } catch {
    return;
  }
  for (const name of names) {
    if (!/^index\.\d+\.[0-9a-f-]+\.tmp$/i.test(name)) continue;
    const candidate = path.join(cartridgeDir, name);
    try {
      const stat = await fs.stat(assertPathInsideProject(projectRoot, candidate));
      if (timing.now() - stat.mtimeMs < timing.remoteStaleMs) continue;
      await fs.rm(assertPathInsideProject(projectRoot, candidate), { force: true });
    } catch {
      // A stale temp is diagnostic debris only; never fail the canonical commit.
    }
  }
}

function isOwnerMetadata(value: unknown): value is Omit<LockOwner, "protocolVersion"> {
  if (!value || typeof value !== "object") return false;
  const owner = value as Partial<LockOwner>;
  return Number.isInteger(owner.pid) && (owner.pid ?? 0) > 0 &&
    typeof owner.hostname === "string" && owner.hostname.length > 0 &&
    typeof owner.token === "string" && owner.token.length > 0 &&
    typeof owner.createdAt === "number" && Number.isFinite(owner.createdAt);
}

function isLockOwner(value: unknown): value is LockOwner {
  return isOwnerMetadata(value) && "protocolVersion" in value && value.protocolVersion === 2 && UUID_PATTERN.test(value.token);
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // Only ESRCH proves death. Permission, range and platform errors fail closed.
    return !isErrorCode(error, "ESRCH");
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
  assertPathInsideProject(projectRoot, candidate);
}
