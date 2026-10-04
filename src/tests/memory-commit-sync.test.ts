import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import matter from "../safe-frontmatter.js";
import { handleMemoryCommit, handleMemoryRead, handleMemoryStatus } from "../mcp-handlers.js";
import * as transactions from "../project-index-transaction.js";
import * as dependencies from "../dependency-propagator.js";
import type { CartridgeEntry, CartridgeIndex } from "../types.js";

let root: string;
function write(relative: string, text: string) {
  const full = path.join(root, relative);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
  return full;
}
function card(name: string, deps: string[] = [], legacy = false) {
  const relative = `.agents/memory/${name}/${legacy ? "SKILL.md" : "MEMORY.md"}`;
  write(relative, `---\nname: ${name}\ndescription: 中文摘要\ncustom:\n  nested: [keep, unknown]\nlast_updated: '2026-01-01T00:00:00Z'\nstaleness: 10\ndependencies: ${JSON.stringify(deps)}\n---\n# Retain original body\n\n## Key Decisions\n- Dependency ${deps.join(", ")} is required by this contract.\n## Tracked Files\n- src/${name}.ts\n`);
  return relative;
}
function entry(skillPath: string, overrides: Partial<CartridgeEntry> = {}): CartridgeEntry {
  return { skillPath, description: "", trackedFiles: [], staleness: 0, lastUpdated: "2026-01-01T00:00:00Z", pendingChanges: [], depth: 1, parent: null, ghostFiles: [], dependencies: [], declaredDependencies: [], engineeringDependencies: [], indirectStaleness: 0, ...overrides };
}
function persist(cartridges: Record<string, CartridgeEntry>) {
  const index: CartridgeIndex = { version: 1, lastScanned: "before", cartridges, fileMap: {}, untrackedFiles: [] };
  for (const [id, value] of Object.entries(cartridges)) {
    for (const file of value.trackedFiles) (index.fileMap[file] ??= []).push(id);
  }
  write(".cartridge/index.json", JSON.stringify(index));
}
function current(): CartridgeIndex {
  return JSON.parse(fs.readFileSync(path.join(root, ".cartridge/index.json"), "utf8"));
}
function envelope(result: Awaited<ReturnType<typeof handleMemoryCommit>>) {
  return JSON.parse(result.content[0].text);
}
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "cartridge-commit-sync-")); });
afterEach(() => { vi.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true }); });

describe("truthful card, index, tracking and derived synchronization", () => {
  it("does not silently discard malformed declaration data during commit", async () => {
    const main = card("a");
    const before = fs.readFileSync(path.join(root, main), "utf8").replace("dependencies: []", "dependencies: invalid-scalar");
    write(main, before);
    write("src/a.ts", "export const a = 1;");
    persist({ a: entry(main, { trackedFiles: ["src/a.ts"], indirectStaleness: 17 }) });
    const result = envelope(await handleMemoryCommit({ projectRoot: root, moduleName: "a", confirm: true }));
    expect(result.status).toBe("error");
    expect(result.summary.error).toContain("dependencies must be an array");
    expect(fs.readFileSync(path.join(root, main), "utf8")).toBe(before);
    expect(current().cartridges.a.indirectStaleness).toBe(17);
  });

  it("T19 keeps successful card write separate from a failed index transaction", async () => {
    const main = card("a");
    write("src/a.ts", "export const a = 1;");
    persist({ a: entry(main, { trackedFiles: ["src/a.ts"], indirectStaleness: 17 }) });
    const before = fs.readFileSync(path.join(root, ".cartridge/index.json"), "utf8");
    vi.spyOn(transactions, "runProjectIndexTransaction").mockRejectedValueOnce(new Error("injected index failure"));
    const result = envelope(await handleMemoryCommit({ projectRoot: root, moduleName: "a", confirm: true }));
    expect(result.summary).toMatchObject({ status: "success", cardWritten: true, indexSynchronized: false, indexRegistered: false, trackingSynchronized: false, derivedSynchronized: false, synchronizationComplete: false });
    expect(result.findings.some((item: { code: string }) => item.code === "INDEX_SYNC_PARTIAL")).toBe(true);
    expect(fs.readFileSync(path.join(root, ".cartridge/index.json"), "utf8")).toBe(before);
    expect(matter(fs.readFileSync(path.join(root, main), "utf8")).data.last_updated).not.toBe("2026-01-01T00:00:00Z");
  });

  it("T20 retains last trusted indirect scores when derived recomputation fails", async () => {
    const main = card("a");
    write("src/a.ts", "export const a = 1;");
    persist({ a: entry(main, { trackedFiles: ["src/a.ts"], indirectStaleness: 17 }) });
    vi.spyOn(dependencies, "recomputeDependencyState").mockImplementationOnce(() => { throw new Error("injected derived failure"); });
    const result = envelope(await handleMemoryCommit({ projectRoot: root, moduleName: "a", confirm: true }));
    expect(result.summary).toMatchObject({ cardWritten: true, indexSynchronized: true, indexRegistered: true, trackingSynchronized: true, derivedSynchronized: false, synchronizationComplete: false });
    expect(result.findings.some((item: { code: string }) => item.code === "DERIVED_SYNC_PARTIAL")).toBe(true);
    expect(current().cartridges.a.indirectStaleness).toBe(17);
    expect(current().cartridges.a.dependencySyncWarning).toContain("injected derived failure");
    const status = envelope(await handleMemoryStatus({ projectRoot: root, moduleName: "a" }));
    expect(status.findings.some((item: { code: string }) => item.code === "DERIVED_SYNC_PARTIAL")).toBe(true);
  });

  it("T21 does not claim an unregistered existing card was registered", async () => {
    card("a");
    write("src/a.ts", "export const a = 1;");
    persist({});
    const result = envelope(await handleMemoryCommit({ projectRoot: root, moduleName: "a", confirm: true }));
    expect(result.summary).toMatchObject({ cardWritten: true, indexSynchronized: false, indexRegistered: false, synchronizationComplete: false });
    expect(current().cartridges.a).toBeUndefined();
  });

  it("keeps still-tracked missing sources pending and stale until restored", async () => {
    const main = card("a");
    persist({ a: entry(main, { trackedFiles: ["src/a.ts"], staleness: 20, ghostFiles: ["src/a.ts"], pendingChanges: [{ filePath: "src/a.ts", eventType: "unlink", timestamp: "before" }] }) });
    const result = envelope(await handleMemoryCommit({ projectRoot: root, moduleName: "a", confirm: true }));
    expect(result.summary).toMatchObject({ cardWritten: true, indexSynchronized: true, trackingSynchronized: false, synchronizationComplete: false });
    expect(result.findings.some((item: { code: string }) => item.code === "TRACKING_SYNC_PARTIAL")).toBe(true);
    expect(current().cartridges.a.ghostFiles).toEqual(["src/a.ts"]);
    expect(current().cartridges.a.pendingChanges).toHaveLength(1);
    expect(current().cartridges.a.staleness).toBeGreaterThan(0);
    expect(matter(fs.readFileSync(path.join(root, main), "utf8")).data.staleness).toBeGreaterThan(0);
    write("src/a.ts", "export const a = 1;");
    const restored = envelope(await handleMemoryCommit({ projectRoot: root, moduleName: "a", confirm: true }));
    expect(restored.summary.synchronizationComplete).toBe(true);
    expect(current().cartridges.a.ghostFiles).toEqual([]);
    expect(current().cartridges.a.pendingChanges).toEqual([]);
  });

  it("T09/T17 commits fresh declared edges and removes deleted edges immediately", async () => {
    const a = card("a");
    const b = card("b", ["a"]);
    write("src/a.ts", "export const a = 1;");
    write("src/b.ts", "export const b = 1;");
    persist({ a: entry(a, { trackedFiles: ["src/a.ts"], staleness: 20 }), b: entry(b, { trackedFiles: ["src/b.ts"] }) });
    await handleMemoryCommit({ projectRoot: root, moduleName: "b", confirm: true });
    expect(current().cartridges.b.indirectStaleness).toBe(20);
    expect(current().cartridges.b.declaredDependencies).toEqual(["a"]);
    expect(current().cartridges.b.engineeringDependencies).toEqual([]);
    card("b", []);
    await handleMemoryCommit({ projectRoot: root, moduleName: "b", confirm: true });
    expect(current().cartridges.b.indirectStaleness).toBe(0);
    expect(current().cartridges.b.declaredDependencies).toEqual([]);
  });

  it("T23 preserves legacy name, unknown fields, original prose and archive on minimal sync", async () => {
    const main = card("a", [], true);
    write(main, fs.readFileSync(path.join(root, main), "utf8").replace("staleness: 10", "staleness: 10\nstatus: deprecated"));
    write("src/a.ts", "export const a = 1;");
    const archive = write(".agents/memory/a/archive-001.md", "# History\nUnchanged legacy notes\n");
    const before = matter(fs.readFileSync(path.join(root, main), "utf8"));
    persist({ a: entry(main, { trackedFiles: ["src/a.ts"] }) });
    await handleMemoryCommit({ projectRoot: root, moduleName: "a", confirm: true });
    const after = matter(fs.readFileSync(path.join(root, main), "utf8"));
    expect(after.content.trim()).toBe(before.content.trim());
    expect(after.data.custom).toEqual(before.data.custom);
    expect(after.data.status).toBe("deprecated");
    expect(after.data.memory_schema_version).toBeUndefined();
    expect(fs.existsSync(path.join(root, ".agents/memory/a/MEMORY.md"))).toBe(false);
    expect(fs.readFileSync(archive, "utf8")).toBe("# History\nUnchanged legacy notes\n");
  });

  it("T16 read-only review supplies evidence without altering card or stale/index state", async () => {
    const main = card("a");
    write("src/a.ts", "export const a = 1;");
    persist({ a: entry(main, { trackedFiles: ["src/a.ts"], staleness: 10, pendingChanges: [{ filePath: "src/a.ts", eventType: "change", timestamp: "before" }] }) });
    const files = [main, "src/a.ts", ".cartridge/index.json"];
    const before = files.map((file) => fs.readFileSync(path.join(root, file), "utf8"));
    const read = envelope(await handleMemoryRead({ projectRoot: root, moduleName: "a" }));
    const status = envelope(await handleMemoryStatus({ projectRoot: root, moduleName: "a" }));
    expect(read.metadata.readOnly).toBe(true);
    expect(status.summary.actionRequired).toContain("memory-attributed-no-write");
    expect(status.summary.actionRequired).not.toMatch(/memory_update|view_file/);
    expect(files.map((file) => fs.readFileSync(path.join(root, file), "utf8"))).toEqual(before);
  });
});
