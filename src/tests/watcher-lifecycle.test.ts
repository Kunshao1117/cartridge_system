import { afterEach, expect, it, vi } from "vitest";
import { deferred } from "./surface-regression-fixtures.js";
import { createConfig } from "../config.js";
import type { CartridgeIndexManager } from "../index-manager.js";
import type { StalenessAnalyzer } from "../analyzer.js";
import type { GitignoreFilter } from "../gitignore-filter.js";
import type { MemoryWriter } from "../writer.js";
const mocks = vi.hoisted(() => ({ change: undefined as undefined | ((uri: { fsPath: string }) => void), handle: vi.fn(), reload: vi.fn() }));
vi.mock("../monitoring/project-event-handler.js", () => ({ handleProjectFileEvent: mocks.handle }));
vi.mock("../project-index-transaction.js", () => ({ reloadProjectIndexFromDisk: mocks.reload }));
vi.mock("vscode", () => ({ workspace: { createFileSystemWatcher: () => ({
  onDidChange: (cb: typeof mocks.change) => { mocks.change = cb; return { dispose() {} }; },
  onDidCreate: () => ({ dispose() {} }), onDidDelete: () => ({ dispose() {} }), dispose() {},
}) } }));
import { CartridgeWatcher } from "../watcher.js";
afterEach(() => { vi.useRealTimers(); mocks.handle.mockReset(); mocks.reload.mockReset(); });
function watcher() { return new CartridgeWatcher(createConfig("/demo"), {} as CartridgeIndexManager, {} as StalenessAnalyzer, {} as GitignoreFilter, {} as MemoryWriter); }
it("stop cancels pending debounce and drain waits for already-started handlers", async () => {
  vi.useFakeTimers(); const pending = deferred<void>(); mocks.handle.mockReturnValue(pending.promise);
  const w = watcher(); await w.start(); mocks.change!({ fsPath: "/demo/a.ts" });
  await vi.advanceTimersByTimeAsync(300); expect(mocks.handle).toHaveBeenCalledTimes(1);
  mocks.change!({ fsPath: "/demo/b.ts" }); w.stop();
  let drained = false; const drain = w.drain().then(() => { drained = true; });
  await vi.advanceTimersByTimeAsync(500); expect(drained).toBe(false); expect(mocks.handle).toHaveBeenCalledTimes(1);
  pending.resolve(); await drain; expect(drained).toBe(true);
});
it("drains an in-flight index reload without firing disposed UI callbacks", async () => {
  vi.useFakeTimers(); const pending = deferred<{ status: string; warning: string }>(); mocks.reload.mockReturnValue(pending.promise);
  const w = watcher(); await w.start(); mocks.change!({ fsPath: "/demo/.cartridge/index.json" }); await vi.advanceTimersByTimeAsync(150);
  w.stop(); let drained = false; const drain = w.drain().then(() => { drained = true; });
  await Promise.resolve(); expect(drained).toBe(false);
  pending.resolve({ status: "invalid", warning: "bad index" }); await drain; expect(drained).toBe(true);
});

it("ignores v2 lock candidate and owner artifacts even without configured excludes", async () => {
  vi.useFakeTimers();
  const w = new CartridgeWatcher(createConfig("/demo", { excludeDirs: [] }), {} as CartridgeIndexManager, {} as StalenessAnalyzer, {} as GitignoreFilter, {} as MemoryWriter);
  await w.start();
  for (const relative of [".cartridge/index.lock.candidate-123-uuid", ".cartridge/index.lock.candidate-123-uuid/owner-uuid.json", ".cartridge/index.lock/owner-uuid.json"]) mocks.change!({ fsPath: `/demo/${relative}` });
  await vi.advanceTimersByTimeAsync(500);
  expect(mocks.handle).not.toHaveBeenCalled();
  expect(mocks.reload).not.toHaveBeenCalled();
  w.stop(); await w.drain();
});
