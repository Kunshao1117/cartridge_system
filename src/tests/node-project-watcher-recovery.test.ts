import fs, { type FSWatcher } from "node:fs";
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NodeProjectWatcher } from "../monitoring/node-project-watcher.js";

afterEach(() => { vi.restoreAllMocks(); });

function fakeWatcher() {
  return Object.assign(new EventEmitter(), { close: vi.fn() });
}

describe("CORE-R3 NodeProjectWatcher failure recovery", () => {
  it("surfaces fs.watch startup failure and can retry the real start method", () => {
    const native = fakeWatcher();
    const watch = vi.spyOn(fs, "watch")
      .mockImplementationOnce(() => { throw new Error("watch unavailable"); })
      .mockReturnValue(native as unknown as FSWatcher);
    const onError = vi.fn();
    const watcher = new NodeProjectWatcher({ projectRoot: "/project", onEvent: vi.fn(), onRescan: vi.fn(), onError });
    expect(() => watcher.start()).toThrow("watch unavailable");
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "watch unavailable" }));
    watcher.start();
    expect(watch).toHaveBeenCalledTimes(2);
    watcher.stop();
    expect(native.close).toHaveBeenCalledTimes(1);
  });

  it("closes failed native watcher before reporting a runtime error and can reopen", () => {
    const native = fakeWatcher();
    const replacement = fakeWatcher();
    vi.spyOn(fs, "watch").mockReturnValueOnce(native as unknown as FSWatcher).mockReturnValueOnce(replacement as unknown as FSWatcher);
    const onError = vi.fn(() => { expect(native.close).toHaveBeenCalledTimes(1); });
    const watcher = new NodeProjectWatcher({ projectRoot: "/project", onEvent: vi.fn(), onRescan: vi.fn(), onError });
    watcher.start();
    native.emit("error", new Error("resource exhausted"));
    expect(onError).toHaveBeenCalledTimes(1);
    watcher.start();
    native.emit("error", new Error("late old error"));
    expect(onError).toHaveBeenCalledTimes(1);
    watcher.stop();
    expect(replacement.close).toHaveBeenCalledTimes(1);
  });
  it("filters v2 candidate artifact callbacks while keeping canonical index reloads", () => {
    const native = fakeWatcher();
    let callback!: (eventType: "change" | "rename", filename: string) => void;
    vi.spyOn(fs, "watch").mockImplementation((...args: Parameters<typeof fs.watch>) => {
      callback = (args as unknown as [unknown, unknown, typeof callback])[2];
      return native as unknown as FSWatcher;
    });
    const onEvent = vi.fn(); const onIndexChanged = vi.fn();
    const watcher = new NodeProjectWatcher({ projectRoot: "/project", onEvent, onRescan: vi.fn(), onIndexChanged });
    vi.useFakeTimers();
    try {
      watcher.start();
      callback("change", ".cartridge/index.lock.candidate-42-token/owner-token.json");
      callback("change", ".cartridge/index.json");
      vi.runAllTimers();
      expect(onEvent).not.toHaveBeenCalled();
      expect(onIndexChanged).toHaveBeenCalledOnce();
    } finally { watcher.stop(); vi.useRealTimers(); }
  });

});
