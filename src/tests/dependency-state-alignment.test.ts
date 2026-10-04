import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createConfig } from "../config.js";
import { CartridgeIndexManager } from "../index-manager.js";
import { MemoryWriter } from "../writer.js";
import { refreshMemoryIndex } from "../memory-reindex.js";
import {
  buildDependencyGraph,
  buildPropagationGraph,
  propagateStaleness,
  recomputeDependencyState,
} from "../dependency-propagator.js";
import * as imports from "../import-resolver.js";
import type { CartridgeEntry, CartridgeIndex } from "../types.js";

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

function entry(dependencies: string[] = [], staleness = 0): CartridgeEntry {
  return {
    skillPath: ".agents/memory/test/MEMORY.md", description: "", trackedFiles: [],
    staleness, lastUpdated: "", pendingChanges: [], ghostFiles: [], dependencies,
    declaredDependencies: dependencies, indirectStaleness: 0, depth: 1, parent: null,
  };
}

function index(cartridges: Record<string, CartridgeEntry>): CartridgeIndex {
  return { version: 1, lastScanned: "", cartridges, fileMap: {}, untrackedFiles: [] };
}

async function fixture(): Promise<{ root: string; manager: CartridgeIndexManager }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-dependency-state-"));
  roots.push(root);
  await fs.mkdir(path.join(root, "src"), { recursive: true });
  await fs.writeFile(path.join(root, "src/a.ts"), "export const a = 1;\n");
  await card(root, "A", [], ["src/a.ts"]);
  await card(root, "B", ["A"]);
  const manager = new CartridgeIndexManager(createConfig(root, {
    scoring: { fileChanged: 10, fileDeleted: 20, fileAdded: 5, dailyDecay: 0 },
  }));
  return { root, manager };
}

async function card(root: string, id: string, deps: string[], tracked: string[] = [], stale = 0, extra = ""): Promise<void> {
  const dir = path.join(root, ".agents/memory", id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "MEMORY.md"), [
    "---", `name: ${id}`, "description: fixture", `dependencies: ${JSON.stringify(deps)}`,
    `staleness: ${stale}`, "last_updated: '2026-01-01T00:00:00Z'", "---", "",
    "## Current Truth", ...deps.map((dep) => `- Depends on upstream ${dep} for its contract.`),
    "", "## Tracked Files", ...tracked.map((file) => `- ${file}`), "", extra,
  ].join("\n"));
}

describe("P1 dependency propagation alignment (T09–T12)", () => {
  it("T09 propagates a declared edge without inventing an engineering import", async () => {
    const { root, manager } = await fixture();
    await card(root, "A", [], ["src/a.ts"], 20);
    await manager.scan();
    expect(buildDependencyGraph(manager.getIndex(), root).get("B")).toEqual([]);
    expect(manager.getIndex().cartridges.B.declaredDependencies).toEqual(["A"]);
    expect(manager.getIndex().cartridges.B.engineeringDependencies).toEqual([]);
    expect(manager.getIndex().cartridges.B.indirectStaleness).toBe(20);
  });

  it("T09 a removed declaration immediately clears its old edge and score", async () => {
    const { root, manager } = await fixture();
    await card(root, "A", [], ["src/a.ts"], 20);
    await manager.scan();
    await card(root, "B", []);
    await manager.scan();
    expect(manager.getIndex().cartridges.B.dependencies).toEqual([]);
    expect(manager.getIndex().cartridges.B.indirectStaleness).toBe(0);
    await card(root, "B", ["A"]);
    await manager.scan();
    expect(manager.getIndex().cartridges.B.indirectStaleness).toBe(20);
  });

  it("T10 Relations, Applicable Skills and parent navigation create no edge", async () => {
    const { root, manager } = await fixture();
    await card(root, "A", [], ["src/a.ts"], 20);
    await card(root, "B", [], [], 0, "## Relations\n- A\n\n## Applicable Skills\n- memory-ops\n");
    await manager.scan();
    manager.getIndex().cartridges.B.parent = "A";
    recomputeDependencyState(manager.getIndex(), root, 2);
    expect(manager.getIndex().cartridges.B.dependencies).toEqual([]);
    expect(manager.getIndex().cartridges.B.indirectStaleness).toBe(0);
  });

  it("T11 cycles, self/duplicate edges, unknown targets and depth are bounded and diagnosed", () => {
    const state = index({ A: entry(["C", "A"], 20), B: entry(["A", "A", "missing"]), C: entry(["B"]), D: entry(["C"]) });
    const { propagationGraph, diagnostics } = buildPropagationGraph(state, new Map());
    expect(diagnostics.map((item) => item.code)).toEqual(expect.arrayContaining([
      "DEPENDENCY_SELF", "DEPENDENCY_DUPLICATE", "DEPENDENCY_TARGET_UNKNOWN", "DEPENDENCY_CYCLE",
    ]));
    expect(propagationGraph.get("B")).toEqual(["A"]);
    const scores = propagateStaleness(state, propagationGraph, 2);
    expect(scores.get("B")).toBe(20);
    expect(scores.get("C")).toBe(5);
    expect(scores.has("A")).toBe(false);
    expect(scores.has("D")).toBe(false);
    expect(propagateStaleness(state, propagationGraph, 1).has("C")).toBe(false);
  });

  it("T11 unknown declarations stay visible and missing rationale does not drop a real edge", async () => {
    const { root, manager } = await fixture();
    await card(root, "A", [], ["src/a.ts"], 10);
    await card(root, "B", ["A", "unknown"]);
    const bPath = path.join(root, ".agents/memory/B/MEMORY.md");
    await fs.writeFile(bPath, (await fs.readFile(bPath, "utf8")).replace(/- Depends on upstream[^\n]*\n/g, ""));
    await manager.scan();
    const b = manager.getIndex().cartridges.B;
    expect(b.dependencies).toContain("unknown");
    expect(b.indirectStaleness).toBe(10);
    expect(b.dependencyDiagnostics?.map((item) => item.code)).toEqual(expect.arrayContaining([
      "DEPENDENCY_TARGET_UNKNOWN", "DEPENDENCY_REASON_MISSING",
    ]));
  });

  it("T11 fresh commit declaration overrides do not reuse the old combined index field", () => {
    const state = index({ A: entry([], 10), B: entry(["A"]) });
    recomputeDependencyState(state, "/unused", 2, new Map(Object.entries(state.cartridges).map(([id, card]) => [id, card.declaredDependencies ?? []])));
    expect(state.cartridges.B.indirectStaleness).toBe(10);
    recomputeDependencyState(state, "/unused", 2, new Map([["A", []], ["B", []]]));
    expect(state.cartridges.B.dependencies).toEqual([]);
    expect(state.cartridges.B.indirectStaleness).toBe(0);
    recomputeDependencyState(state, "/unused", 2, new Map([["A", []], ["B", ["A"]]]));
    expect(state.cartridges.B.indirectStaleness).toBe(10);
  });

  it("T11 a failed recomputation preserves trusted scores and exposes a diagnostic", async () => {
    const { root, manager } = await fixture();
    await card(root, "A", [], ["src/a.ts"], 20);
    await manager.scan();
    const before = manager.getIndex().cartridges.B.indirectStaleness;
    vi.spyOn(imports, "scanFileImports").mockImplementation(() => { throw new Error("injected graph failure"); });
    await manager.scan();
    expect(manager.getIndex().cartridges.B.indirectStaleness).toBe(before);
    expect(manager.getIndex().cartridges.B.dependencies).toEqual(["A"]);
    expect(manager.getIndex().cartridges.B.dependencySyncWarning).toContain("injected graph failure");
  });

  it("T11 malformed optional diagnostics cannot half-publish derived fields", () => {
    const state = index({ A: entry([], 10), B: entry(["A"]) });
    state.cartridges.A.indirectStaleness = 11;
    state.cartridges.B.indirectStaleness = 22;
    Object.assign(state.cartridges.B, { dependencyDiagnostics: { invalid: true } });
    expect(() => recomputeDependencyState(state, "/unused", 2, new Map([["A", []], ["B", ["A"]]]))).toThrow("Invalid dependency diagnostics");
    expect(state.cartridges.A.indirectStaleness).toBe(11);
    expect(state.cartridges.B.indirectStaleness).toBe(22);
  });

  it("T09 recomputation reads a changed declaration before its card watcher fires", async () => {
    const { root, manager } = await fixture();
    await card(root, "A", [], ["src/a.ts"], 20);
    await manager.scan();
    await card(root, "B", []);
    expect(manager.getIndex().cartridges.B.declaredDependencies).toEqual(["A"]);
    recomputeDependencyState(manager.getIndex(), root, 2);
    expect(manager.getIndex().cartridges.B.dependencies).toEqual([]);
    expect(manager.getIndex().cartridges.B.indirectStaleness).toBe(0);
  });

  it("persisted optional propagation and monitor fields reject malformed values", async () => {
    const { root, manager } = await fixture();
    await manager.scan();
    await fs.mkdir(path.join(root, ".cartridge"), { recursive: true });
    for (const invalid of [
      { dependencyDiagnostics: {} }, { dependencyDiagnostics: [null] },
      { sourceFingerprints: { "src/a.ts": 12 } }, { declaredDependencies: "A" },
      { engineeringDependencies: [null] }, { dependencySyncWarning: 42 }, { memoryContentFingerprint: [] },
      { memoryFileFingerprint: [] }, { trackingReconciliation: { fileFingerprint: "x", staleness: "0" } },
    ]) {
      const state = JSON.parse(JSON.stringify(manager.getIndex())) as CartridgeIndex;
      Object.assign(state.cartridges.A, invalid);
      await fs.writeFile(path.join(root, ".cartridge/index.json"), JSON.stringify(state));
      expect(await manager.readPersistedIndex()).toEqual({ status: "invalid" });
    }
  });

  it("T11 a successful recomputation clears every old indirect score", () => {
    const state = index({ A: entry(), B: entry(["A"]) });
    state.cartridges.B.indirectStaleness = 500;
    recomputeDependencyState(state, "/unused", 2, new Map(Object.entries(state.cartridges).map(([id, card]) => [id, card.declaredDependencies ?? []])));
    expect(state.cartridges.B.indirectStaleness).toBe(0);
  });

  it("T12 one offline reindex publishes new direct and indirect states together", async () => {
    const { root, manager } = await fixture();
    await refreshMemoryIndex({ projectRoot: root, indexManager: manager, detectMissedChanges: false, includeProjectFiles: false });
    await fs.writeFile(path.join(root, "src/a.ts"), "export const a = 2;\n");
    const result = await refreshMemoryIndex({ projectRoot: root, indexManager: manager, includeProjectFiles: false });
    expect(result.index.cartridges.A.staleness).toBe(10);
    expect(result.index.cartridges.B.indirectStaleness).toBe(10);
    const disk = JSON.parse(await fs.readFile(path.join(root, ".cartridge/index.json"), "utf8")) as CartridgeIndex;
    expect(disk.cartridges.A.staleness).toBe(10);
    expect(disk.cartridges.B.indirectStaleness).toBe(10);
  });

  it("T12 unchanged warning metadata cannot resurrect resolved tracking on a second offline reindex", async () => {
    const { root, manager } = await fixture();
    await fs.unlink(path.join(root, "src/a.ts"));
    await refreshMemoryIndex({ projectRoot: root, indexManager: manager, includeProjectFiles: false });
    const config = createConfig(root);
    await new MemoryWriter(config).injectWarning(".agents/memory/A/MEMORY.md", ["src/a.ts"], 20);
    const aPath = path.join(root, ".agents/memory/A/MEMORY.md");
    const raw = await fs.readFile(aPath, "utf8");
    const repairedTracking = raw.replace("- src/a.ts\n", "");
    expect(repairedTracking).toMatch(/staleness: 20/);
    await fs.writeFile(aPath, repairedTracking);
    for (let pass = 0; pass < 2; pass += 1) {
      // A newly constructed manager proves reconciliation was persisted, not a
      // process-local suppression flag or just the first returned snapshot.
      const result = await refreshMemoryIndex({ projectRoot: root, includeProjectFiles: false });
      expect(result.index.cartridges.A.pendingChanges).toEqual([]);
      expect(result.index.cartridges.A.ghostFiles).toEqual([]);
      expect(result.index.cartridges.A.staleness).toBe(0);
      expect(result.index.cartridges.B.indirectStaleness).toBe(0);
      expect(await fs.readFile(aPath, "utf8")).toBe(repairedTracking);
    }
  });

  it("T12 tracking repair clears direct and downstream state in that same reindex", async () => {
    const { root, manager } = await fixture();
    await refreshMemoryIndex({ projectRoot: root, indexManager: manager, includeProjectFiles: false });
    expect(manager.getIndex().cartridges.B.indirectStaleness).toBe(10);
    await card(root, "A", []);
    const result = await refreshMemoryIndex({ projectRoot: root, indexManager: manager, includeProjectFiles: false });
    expect(result.index.cartridges.A.pendingChanges).toEqual([]);
    expect(result.index.cartridges.A.staleness).toBe(0);
    expect(result.index.cartridges.B.indirectStaleness).toBe(0);
  });
});
