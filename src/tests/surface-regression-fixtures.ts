import type { CartridgeEntry, CartridgeIndex } from "../types.js";

export function surfaceEntry(patch: Partial<CartridgeEntry> = {}): CartridgeEntry {
  return {
    skillPath: ".agents/memory/core/MEMORY.md", mainFileType: "MEMORY.md",
    contentQualityStatus: "complete", description: "core", trackedFiles: ["src/core.ts"],
    staleness: 0, lastUpdated: "2026-01-01T00:00:00Z", pendingChanges: [],
    depth: 1, parent: null, ghostFiles: [], dependencies: [], indirectStaleness: 0,
    ...patch,
  };
}
export function surfaceIndex(cartridges: Record<string, CartridgeEntry> = { core: surfaceEntry() }): CartridgeIndex {
  return { version: 1, lastScanned: "2026-01-01T00:00:00Z", cartridges, fileMap: {}, untrackedFiles: [] };
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
