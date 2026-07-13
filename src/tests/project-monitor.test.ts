import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refreshMemoryIndex: vi.fn(),
  flushIfDirty: vi.fn(),
  getVisibleIndex: vi.fn(),
  getSyncWarning: vi.fn(),
  injectWarning: vi.fn(),
  handleProjectFileEvent: vi.fn(),
  reloadProjectIndexFromDisk: vi.fn(),
  buildDesktopProjectSnapshot: vi.fn(),
  watcherInstances: [] as Array<{
    options: unknown;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("../config.js", () => ({
  createConfig: () => ({ thresholds: { significant: 50 } }),
}));

vi.mock("../gitignore-filter.js", () => ({
  GitignoreFilter: class {},
}));

vi.mock("../index-manager.js", () => ({
  CartridgeIndexManager: class {
    flushIfDirty = mocks.flushIfDirty;
    getVisibleIndex = mocks.getVisibleIndex;
    getSyncWarning = mocks.getSyncWarning;
  },
}));

vi.mock("../memory-reindex.js", () => ({
  refreshMemoryIndex: mocks.refreshMemoryIndex,
}));

vi.mock("../analyzer.js", () => ({
  StalenessAnalyzer: class {},
}));

vi.mock("../writer.js", () => ({
  MemoryWriter: class {
    injectWarning = mocks.injectWarning;
  },
}));

vi.mock("../monitoring/project-event-handler.js", () => ({
  handleProjectFileEvent: mocks.handleProjectFileEvent,
}));

vi.mock("../monitoring/node-project-watcher.js", () => ({
  NodeProjectWatcher: class {
    readonly start = vi.fn();
    readonly stop = vi.fn();

    constructor(readonly options: unknown) {
      mocks.watcherInstances.push(this);
    }
  },
}));

vi.mock("../project-index-transaction.js", () => ({
  reloadProjectIndexFromDisk: mocks.reloadProjectIndexFromDisk,
}));

vi.mock("../monitoring/project-snapshot.js", () => ({
  createProjectId: () => "project-id",
  buildDesktopProjectSnapshot: mocks.buildDesktopProjectSnapshot,
}));

import { CartridgeProjectMonitor } from "../monitoring/project-monitor.js";

const BACKGROUND_RESCAN_INTERVAL_MS = 15 * 60 * 1_000;

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

interface SnapshotLike {
  enabled: boolean;
  error: string | null;
  syncWarning: string | null;
}

interface MonitorInternals {
  heartbeat: NodeJS.Timeout | undefined;
  rescanTimer: NodeJS.Timeout | undefined;
  activeRescan: Promise<unknown> | undefined;
  trailingRescan: unknown;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function scanResult(cartridges = {}) {
  return { index: { cartridges } };
}

function staleCartridgeResult() {
  return scanResult({
    stale: {
      staleness: 50,
      pendingChanges: [{ filePath: "src/changed.ts" }],
      skillPath: "C:/project/.agents/skills/stale/SKILL.md",
      mainFile: { activePath: "C:/project/src/stale.ts" },
    },
  });
}

async function settlePromises(): Promise<void> {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

describe("CartridgeProjectMonitor lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.watcherInstances.length = 0;
    mocks.refreshMemoryIndex.mockReset().mockResolvedValue(scanResult());
    mocks.flushIfDirty.mockReset().mockResolvedValue(undefined);
    mocks.getVisibleIndex.mockReset().mockReturnValue({ cartridges: {} });
    mocks.getSyncWarning.mockReset().mockReturnValue(null);
    mocks.injectWarning.mockReset().mockResolvedValue(undefined);
    mocks.handleProjectFileEvent.mockReset().mockResolvedValue(undefined);
    mocks.reloadProjectIndexFromDisk
      .mockReset()
      .mockResolvedValue({ status: "self-write" });
    mocks.buildDesktopProjectSnapshot
      .mockReset()
      .mockImplementation((input: SnapshotLike) => ({
        id: "project-id",
        ...input,
      }));
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("should not regress: repeated and concurrent start create one resource set", async () => {
    const startupScan = deferred<ReturnType<typeof scanResult>>();
    mocks.refreshMemoryIndex.mockReturnValueOnce(startupScan.promise);
    const monitor = new CartridgeProjectMonitor("C:/project");

    const firstStart = monitor.start();
    const concurrentStart = monitor.start();

    expect(firstStart).toBe(concurrentStart);
    expect(mocks.refreshMemoryIndex).toHaveBeenCalledTimes(1);
    startupScan.resolve(scanResult());
    await Promise.all([firstStart, concurrentStart]);

    expect(mocks.watcherInstances).toHaveLength(1);
    expect(mocks.watcherInstances[0].start).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(2);

    await monitor.start();

    expect(mocks.refreshMemoryIndex).toHaveBeenCalledTimes(2);
    expect(mocks.watcherInstances).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(2);
  });

  it("injects startup warnings exactly once for each successful generation", async () => {
    mocks.refreshMemoryIndex.mockResolvedValue(staleCartridgeResult());
    const monitor = new CartridgeProjectMonitor("C:/project");

    await monitor.start();
    await monitor.rescan();

    expect(mocks.injectWarning).toHaveBeenCalledTimes(1);

    await monitor.stop();
    await monitor.start();

    expect(mocks.injectWarning).toHaveBeenCalledTimes(2);
  });

  it("does not inject startup warnings during manual or periodic rescans", async () => {
    mocks.refreshMemoryIndex.mockResolvedValue(staleCartridgeResult());
    const monitor = new CartridgeProjectMonitor("C:/project");
    await monitor.start();

    await monitor.rescan();
    await vi.advanceTimersByTimeAsync(BACKGROUND_RESCAN_INTERVAL_MS);
    await settlePromises();

    expect(mocks.injectWarning).toHaveBeenCalledTimes(1);
  });

  it("does not run a background rescan before 15 minutes and runs one at 15 minutes", async () => {
    const monitor = new CartridgeProjectMonitor("C:/project");
    await monitor.start();
    const scansAfterStartup = mocks.refreshMemoryIndex.mock.calls.length;

    await vi.advanceTimersByTimeAsync(BACKGROUND_RESCAN_INTERVAL_MS - 1);
    await settlePromises();
    expect(mocks.refreshMemoryIndex).toHaveBeenCalledTimes(scansAfterStartup);

    await vi.advanceTimersByTimeAsync(1);
    await settlePromises();
    expect(mocks.refreshMemoryIndex).toHaveBeenCalledTimes(scansAfterStartup + 1);
  });

  it("should not regress: stop clears timer handles and stale callbacks do nothing", async () => {
    const monitor = new CartridgeProjectMonitor("C:/project");
    await monitor.start();
    const watcherOptions = mocks.watcherInstances[0].options as {
      onRescan: () => void;
    };

    await monitor.stop();
    const scansAfterStop = mocks.refreshMemoryIndex.mock.calls.length;
    const flushesAfterStop = mocks.flushIfDirty.mock.calls.length;
    const internals = monitor as unknown as MonitorInternals;

    expect(internals.heartbeat).toBeUndefined();
    expect(internals.rescanTimer).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);

    watcherOptions.onRescan();
    await vi.advanceTimersByTimeAsync(600_000);
    await settlePromises();

    expect(mocks.refreshMemoryIndex).toHaveBeenCalledTimes(scansAfterStop);
    expect(mocks.flushIfDirty).toHaveBeenCalledTimes(flushesAfterStop);
  });

  it("should not regress: manual rescan after stop refreshes without restarting resources", async () => {
    const monitor = new CartridgeProjectMonitor("C:/project");
    const listener = vi.fn();
    monitor.subscribe(listener);
    await monitor.start();
    await monitor.stop();

    const scansBeforeRescan = mocks.refreshMemoryIndex.mock.calls.length;
    const notificationsBeforeRescan = listener.mock.calls.length;
    const watcherCount = mocks.watcherInstances.length;
    const internals = monitor as unknown as MonitorInternals;

    const snapshot = (await monitor.rescan()) as unknown as SnapshotLike;

    expect(mocks.refreshMemoryIndex).toHaveBeenCalledTimes(scansBeforeRescan + 1);
    expect(listener).toHaveBeenCalledTimes(notificationsBeforeRescan + 1);
    expect(snapshot.enabled).toBe(false);
    expect(snapshot.error).toBeNull();
    expect((monitor.getSnapshot() as unknown as SnapshotLike).enabled).toBe(false);
    expect(mocks.watcherInstances).toHaveLength(watcherCount);
    expect(internals.heartbeat).toBeUndefined();
    expect(internals.rescanTimer).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("should not regress: stop invalidates an in-flight startup scan", async () => {
    const pendingScan = deferred<ReturnType<typeof scanResult>>();
    mocks.refreshMemoryIndex.mockReturnValueOnce(pendingScan.promise);
    const monitor = new CartridgeProjectMonitor("C:/project");
    const listener = vi.fn();
    monitor.subscribe(listener);

    const startup = monitor.start();
    const stop = monitor.stop();
    await settlePromises();
    expect(mocks.flushIfDirty).not.toHaveBeenCalled();
    const notificationsAfterStop = listener.mock.calls.length;

    pendingScan.resolve(scanResult());
    await Promise.all([startup, stop]);
    await settlePromises();

    expect(listener).toHaveBeenCalledTimes(notificationsAfterStop + 1);
    expect(mocks.watcherInstances).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("waits for an old scan before stop flushes and returns", async () => {
    const pendingScan = deferred<ReturnType<typeof scanResult>>();
    mocks.refreshMemoryIndex.mockReturnValueOnce(pendingScan.promise);
    const monitor = new CartridgeProjectMonitor("C:/project");

    void monitor.start();
    const stop = monitor.stop();
    await settlePromises();

    expect(mocks.flushIfDirty).not.toHaveBeenCalled();
    pendingScan.resolve(scanResult());
    await stop;

    expect(mocks.flushIfDirty).toHaveBeenCalledTimes(1);
  });

  it("should not regress: concurrent rescans stay single-flight with one trailing scan", async () => {
    const monitor = new CartridgeProjectMonitor("C:/project");
    await monitor.start();
    const firstScan = deferred<ReturnType<typeof scanResult>>();
    const trailingScan = deferred<ReturnType<typeof scanResult>>();
    const pendingScans = [firstScan, trailingScan];
    let activeScans = 0;
    let maximumActiveScans = 0;

    mocks.refreshMemoryIndex.mockReset().mockImplementation(() => {
      const pending = pendingScans.shift();
      if (!pending) throw new Error("unexpected extra scan");
      activeScans += 1;
      maximumActiveScans = Math.max(maximumActiveScans, activeScans);
      return pending.promise.finally(() => {
        activeScans -= 1;
      });
    });

    const first = monitor.rescan();
    const second = monitor.rescan();
    const third = monitor.rescan();
    expect(mocks.refreshMemoryIndex).toHaveBeenCalledTimes(1);

    firstScan.resolve(scanResult());
    await settlePromises();
    expect(mocks.refreshMemoryIndex).toHaveBeenCalledTimes(2);

    trailingScan.resolve(scanResult());
    await Promise.all([first, second, third]);

    expect(maximumActiveScans).toBe(1);
    expect(mocks.refreshMemoryIndex).toHaveBeenCalledTimes(2);
  });

  it("does not queue a third rescan when requests arrive during trailing work", async () => {
    const monitor = new CartridgeProjectMonitor("C:/project");
    await monitor.start();
    const firstScan = deferred<ReturnType<typeof scanResult>>();
    const trailingScan = deferred<ReturnType<typeof scanResult>>();
    const pendingScans = [firstScan, trailingScan];
    mocks.refreshMemoryIndex.mockReset().mockImplementation(() => {
      const pending = pendingScans.shift();
      if (!pending) throw new Error("unexpected extra scan");
      return pending.promise;
    });

    const first = monitor.rescan();
    const queued = monitor.rescan();
    firstScan.resolve(scanResult());
    await settlePromises();
    expect(mocks.refreshMemoryIndex).toHaveBeenCalledTimes(2);

    const duringTrailing = monitor.rescan();
    const internals = monitor as unknown as MonitorInternals;
    expect(internals.activeRescan).toBeDefined();
    expect(internals.trailingRescan).toBeUndefined();
    trailingScan.resolve(scanResult());
    await Promise.all([first, queued, duringTrailing]);

    expect(mocks.refreshMemoryIndex).toHaveBeenCalledTimes(2);
  });

  it("queues a newer startup behind an old generation trailing rescan", async () => {
    const monitor = new CartridgeProjectMonitor("C:/project");
    await monitor.start();
    const firstScan = deferred<ReturnType<typeof scanResult>>();
    const oldTrailingScan = deferred<ReturnType<typeof scanResult>>();
    const newStartupScan = deferred<ReturnType<typeof scanResult>>();
    const pendingScans = [firstScan, oldTrailingScan, newStartupScan];
    mocks.refreshMemoryIndex.mockReset().mockImplementation(() => {
      const pending = pendingScans.shift();
      if (!pending) throw new Error("unexpected extra scan");
      return pending.promise;
    });

    const oldCycle = monitor.rescan();
    const oldTrailing = monitor.rescan();
    firstScan.resolve(scanResult());
    await settlePromises();
    expect(mocks.refreshMemoryIndex).toHaveBeenCalledTimes(2);

    const stop = monitor.stop();
    const newStartup = monitor.start();
    const sameGenerationRequest = monitor.rescan();
    oldTrailingScan.resolve(scanResult());
    await settlePromises();

    expect(mocks.refreshMemoryIndex).toHaveBeenCalledTimes(3);
    expect(mocks.watcherInstances).toHaveLength(1);
    newStartupScan.resolve(staleCartridgeResult());
    await Promise.all([
      oldCycle,
      oldTrailing,
      stop,
      newStartup,
      sameGenerationRequest,
    ]);

    expect(mocks.refreshMemoryIndex).toHaveBeenCalledTimes(3);
    expect(mocks.injectWarning).toHaveBeenCalledTimes(1);
    expect(mocks.watcherInstances).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(2);
  });

  it("keeps a 15-minute background rescan single-flight with one trailing rescan", async () => {
    const monitor = new CartridgeProjectMonitor("C:/project");
    await monitor.start();
    const firstScan = deferred<ReturnType<typeof scanResult>>();
    const trailingScan = deferred<ReturnType<typeof scanResult>>();
    const pendingScans = [firstScan, trailingScan];
    let activeScans = 0;
    let maximumActiveScans = 0;

    mocks.refreshMemoryIndex.mockReset().mockImplementation(() => {
      const pending = pendingScans.shift();
      if (!pending) throw new Error("unexpected extra scan");
      activeScans += 1;
      maximumActiveScans = Math.max(maximumActiveScans, activeScans);
      return pending.promise.finally(() => {
        activeScans -= 1;
      });
    });

    await vi.advanceTimersByTimeAsync(BACKGROUND_RESCAN_INTERVAL_MS);
    const manualRescan = monitor.rescan();
    expect(mocks.refreshMemoryIndex).toHaveBeenCalledTimes(1);

    firstScan.resolve(scanResult());
    await settlePromises();
    expect(mocks.refreshMemoryIndex).toHaveBeenCalledTimes(2);

    trailingScan.resolve(scanResult());
    await manualRescan;

    expect(maximumActiveScans).toBe(1);
    expect(mocks.refreshMemoryIndex).toHaveBeenCalledTimes(2);
  });

  it("should not regress: a failed scan unlocks the next rescan", async () => {
    const monitor = new CartridgeProjectMonitor("C:/project");
    await monitor.start();
    mocks.refreshMemoryIndex
      .mockReset()
      .mockRejectedValueOnce(new Error("scan failed"))
      .mockResolvedValueOnce(scanResult());

    const failed = (await monitor.rescan()) as unknown as SnapshotLike;
    const recovered = (await monitor.rescan()) as unknown as SnapshotLike;

    expect(failed.error).toBe("scan failed");
    expect(recovered.error).toBeNull();
    expect(mocks.refreshMemoryIndex).toHaveBeenCalledTimes(2);
  });

  it("should not regress: listener failures stay isolated from scan state", async () => {
    const monitor = new CartridgeProjectMonitor("C:/project");
    let shouldThrow = false;
    const throwingListener = vi.fn(() => {
      if (shouldThrow) throw new Error("listener failed");
    });
    const healthyListener = vi.fn();
    monitor.subscribe(throwingListener);
    monitor.subscribe(healthyListener);
    shouldThrow = true;

    await expect(monitor.rescan()).resolves.toMatchObject({
      error: null,
    });
    await settlePromises();

    expect(throwingListener).toHaveBeenCalledTimes(2);
    expect(healthyListener).toHaveBeenCalledTimes(2);
    expect((monitor.getSnapshot() as unknown as SnapshotLike).error).toBeNull();
  });

  it("removes a listener that throws during its synchronous initial snapshot", async () => {
    const monitor = new CartridgeProjectMonitor("C:/project");
    const poisonedListener = vi.fn(() => {
      throw new Error("initial listener failed");
    });
    const healthyListener = vi.fn();

    expect(() => monitor.subscribe(poisonedListener)).not.toThrow();
    monitor.subscribe(healthyListener);
    await monitor.rescan();

    expect(poisonedListener).toHaveBeenCalledTimes(1);
    expect(healthyListener).toHaveBeenCalledTimes(2);
  });

  it("should not regress: start-stop-start rejects stale generation state", async () => {
    const staleScan = deferred<ReturnType<typeof scanResult>>();
    const freshScan = deferred<ReturnType<typeof scanResult>>();
    mocks.refreshMemoryIndex
      .mockReturnValueOnce(staleScan.promise)
      .mockReturnValueOnce(freshScan.promise);
    const monitor = new CartridgeProjectMonitor("C:/project");
    const listener = vi.fn();
    monitor.subscribe(listener);

    const staleStartup = monitor.start();
    const stop = monitor.stop();
    staleScan.reject(new Error("stale generation failure"));
    await Promise.all([staleStartup, stop]);

    const freshStartup = monitor.start();
    expect(mocks.refreshMemoryIndex).toHaveBeenCalledTimes(2);

    freshScan.resolve(scanResult());
    await Promise.all([staleStartup, freshStartup]);

    const snapshots = listener.mock.calls.map(
      ([snapshot]) => snapshot as SnapshotLike,
    );
    expect(snapshots.some((snapshot) => snapshot.error === "stale generation failure"))
      .toBe(false);
    expect((monitor.getSnapshot() as unknown as SnapshotLike).error).toBeNull();
    expect(mocks.watcherInstances).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(2);
  });

  it("should not regress: restart queues startup warnings behind an active stale scan", async () => {
    const oldGenerationScan = deferred<ReturnType<typeof scanResult>>();
    const newGenerationScan = deferred<ReturnType<typeof scanResult>>();
    mocks.refreshMemoryIndex
      .mockReturnValueOnce(oldGenerationScan.promise)
      .mockReturnValueOnce(newGenerationScan.promise);
    const monitor = new CartridgeProjectMonitor("C:/project");

    const oldStartup = monitor.start();
    const stop = monitor.stop();
    oldGenerationScan.resolve(scanResult());
    await Promise.all([oldStartup, stop]);

    const newStartup = monitor.start();
    expect(mocks.refreshMemoryIndex).toHaveBeenCalledTimes(2);

    newGenerationScan.resolve(staleCartridgeResult());
    await newStartup;

    expect(mocks.injectWarning).toHaveBeenCalledTimes(1);
  });
});
