import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConfig } from "../config.js";
import { CartridgeIndexManager, parseTrackedFiles } from "../index-manager.js";
import { StalenessAnalyzer } from "../analyzer.js";
import { MemoryWriter } from "../writer.js";
import { GitignoreFilter } from "../gitignore-filter.js";
import { handleProjectFileEvent } from "../monitoring/project-event-handler.js";
import { refreshMemoryIndex } from "../memory-reindex.js";
import matter from "../safe-frontmatter.js";
import { loadCabinetMemoryMetadata } from "../cabinet-memory-metadata.js";
import { buildCabinetWorkbenchModel } from "../cabinet-workbench-model.js";
import { extractImports } from "../import-resolver.js";

let root: string;
function write(relative: string, content: string): void {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}
function card(directory: string, tracked: string[], fields = "description: safe\nlast_updated: '2026-10-04T00:00:00Z'", base = ".agents/memory"): void {
  write(`${base}/${directory}/${base.endsWith("skills") ? "SKILL" : "MEMORY"}.md`,
    `---\nname: safe\n${fields}\nstaleness: 0\n---\n# Memory\n\n## Tracked Files\n${tracked.map((file) => `- \`${file}\``).join("\n")}\n\n## Key Decisions\n`);
}
function services() {
  const config = createConfig(root);
  const indexManager = new CartridgeIndexManager(config);
  const writer = new MemoryWriter(config);
  return { config, indexManager, writer, analyzer: new StalenessAnalyzer(config, indexManager, writer), gitignoreFilter: new GitignoreFilter(root) };
}
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "cartridge-core-regression-"));
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-04T00:00:00Z"));
});
afterEach(() => { vi.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true }); });

describe("canonical index integrity regressions", () => {
  it.each(["constructor", "__proto__", "toString"])("CORE-01 scans, persists and monitors prototype-named card/source %s", async (name) => {
    write(name, "source"); card(name, [name]);
    const deps = services();
    await deps.indexManager.scan();
    expect(deps.indexManager.getAffectedCartridges(name)).toEqual([name]);
    await deps.indexManager.persist();
    expect(await new CartridgeIndexManager(deps.config).load()).toBe(true);
    await handleProjectFileEvent({ ...deps, absFilePath: path.join(root, name), eventType: "change" });
    expect(deps.indexManager.getIndex().cartridges[name].pendingChanges[0].filePath).toBe(name);
    expect(deps.indexManager.getAffectedCartridges("valueOf")).toEqual([]);
    const metadata = await loadCabinetMemoryMetadata(deps.indexManager.getIndex(), root);
    expect(Object.hasOwn(metadata, name)).toBe(true);
    expect(Object.getPrototypeOf(metadata)).toBeNull();
    expect(() => buildCabinetWorkbenchModel(deps.indexManager.getIndex())).not.toThrow();
  });

  it("CORE-02 preserves dotted IDs and marks collisions without routing ambiguous events", async () => {
    write("flat.ts", "flat"); write("nested.ts", "nested");
    card("a.b", ["flat.ts"]);
    const deps = services(); await deps.indexManager.scan();
    expect(deps.indexManager.getAffectedCartridges("flat.ts")).toEqual(["a.b"]);
    await handleProjectFileEvent({ ...deps, absFilePath: path.join(root, "flat.ts"), eventType: "change" });
    deps.indexManager.markGhostFile("a.b", "removed.ts");
    deps.indexManager.markDirty(); await deps.indexManager.persist();
    card("a/b", ["nested.ts"]); card("unrelated", []);
    await refreshMemoryIndex({ projectRoot: root, config: deps.config, indexManager: deps.indexManager, persist: true });
    const conflict = deps.indexManager.getIndex().cartridges["a.b"];
    expect(conflict.mainFile?.type).toBe("conflict");
    expect(conflict.idConflictPaths).toEqual(expect.arrayContaining([".agents/memory/a.b/MEMORY.md", ".agents/memory/a/b/MEMORY.md"]));
    expect(conflict.ghostFiles).toContain("removed.ts");
    expect(conflict.staleness).toBe(10);
    expect(conflict.pendingChanges.map((change) => change.filePath)).toEqual(["flat.ts"]);
    expect(deps.indexManager.resolveModulePath("a.b")).toBeNull();
    expect(deps.indexManager.getAffectedCartridges("flat.ts")).toEqual([]);
    expect(deps.indexManager.getAffectedCartridges("nested.ts")).toEqual([]);
    expect(deps.indexManager.getIndex().cartridges.unrelated).toBeDefined();
    const flatBefore = fs.readFileSync(path.join(root, ".agents/memory/a.b/MEMORY.md"), "utf8");
    const nestedBefore = fs.readFileSync(path.join(root, ".agents/memory/a/b/MEMORY.md"), "utf8");
    await handleProjectFileEvent({ ...deps, absFilePath: path.join(root, "flat.ts"), eventType: "change" });
    expect.soft(fs.readFileSync(path.join(root, ".agents/memory/a.b/MEMORY.md"), "utf8")).toBe(flatBefore);
    expect.soft(fs.readFileSync(path.join(root, ".agents/memory/a/b/MEMORY.md"), "utf8")).toBe(nestedBefore);
    await deps.indexManager.persist();
    expect(await new CartridgeIndexManager(deps.config).load()).toBe(true);
  });

  it("CORE-02 diagnoses duplicate modern/legacy IDs and preserves unrelated cards", async () => {
    card("mem-same", []); card("mem-same", [], undefined, ".agents/skills"); card("healthy", []);
    const deps = services(); await deps.indexManager.scan();
    const conflict = deps.indexManager.getIndex().cartridges["mem-same"];
    expect(conflict.mainFile?.type).toBe("conflict");
    expect(conflict.idConflictPaths).toHaveLength(2);
    expect(deps.indexManager.getIndex().cartridges.healthy).toBeDefined();
  });

  it.each(["'not-a-date'", "'2999-01-01T00:00:00Z'"])("CORE-03 keeps invalid/future date %s finite across event, reconciliation and reload", async (date) => {
    write("src/a.ts", "a"); card("dates", ["src/a.ts"], `description: safe\nlast_updated: ${date}`);
    const deps = services(); await deps.indexManager.scan();
    await handleProjectFileEvent({ ...deps, absFilePath: path.join(root, "src/a.ts"), eventType: "change" });
    expect(deps.indexManager.getIndex().cartridges.dates.staleness).toBe(10);
    expect(await new CartridgeIndexManager(deps.config).load()).toBe(true);
    expect(deps.indexManager.getIndex().cartridges.dates.contentQuality?.evidenceWarnings.join(" ")).toMatch(/last_updated/);
  });

  it.each(["{ en: example }", "[example]", "42", "true"])("CORE-04 normalizes non-string metadata %s and exposes diagnostics", async (value) => {
    card("types", [], `description: ${value}\nlast_updated: ${value}`);
    const deps = services(); await deps.indexManager.scan(); await deps.indexManager.persist();
    const entry = deps.indexManager.getIndex().cartridges.types;
    expect(entry.description).toBe(""); expect(entry.lastUpdated).toBe("");
    expect(() => buildCabinetWorkbenchModel(deps.indexManager.getIndex())).not.toThrow();
    expect(entry.contentQuality?.evidenceWarnings.join(" ")).toMatch(/description.*last_updated/);
    expect(await new CartridgeIndexManager(deps.config).load()).toBe(true);
  });

  it("CORE-04 serializes YAML timestamp dates and rejects invalid candidate state before writing", async () => {
    card("types", [], "description: safe\nlast_updated: 2026-10-04");
    const deps = services(); await deps.indexManager.scan(); await deps.indexManager.persist();
    expect(deps.indexManager.getIndex().cartridges.types.lastUpdated).toBe("2026-10-04T00:00:00.000Z");
    const before = fs.readFileSync(path.join(root, ".cartridge/index.json"), "utf8");
    deps.indexManager.getIndex().cartridges.types.staleness = Number.NaN;
    deps.indexManager.markDirty(); await expect(deps.indexManager.persist()).rejects.toThrow(/Invalid.*index/i);
    expect(fs.readFileSync(path.join(root, ".cartridge/index.json"), "utf8")).toBe(before);
    expect(await new CartridgeIndexManager(deps.config).load()).toBe(true);
  });

  it.each(["distance.ts", "distribution/index.ts", "coverage.config.ts"])("CORE-05 monitors prefix sibling %s and discovers it when untracked", async (file) => {
    write(file, "source"); const deps = services(); await deps.indexManager.scan();
    deps.indexManager.reconcileUntrackedFiles([file, "dist/generated.ts", "coverage/result.json"]);
    expect(deps.indexManager.getUntrackedFiles().map((entry) => entry.filePath)).toEqual([file]);
    card("prefix", [file]); await deps.indexManager.scan();
    await handleProjectFileEvent({ ...deps, absFilePath: path.join(root, file), eventType: "change" });
    expect(deps.indexManager.getIndex().cartridges.prefix.pendingChanges[0].filePath).toBe(file);
  });

  it("CORE-06 normalizes tracked spellings, fingerprints and pending state through offline reconciliation", async () => {
    write("src/a.ts", "source"); card("paths", ["src\\a.ts", "./src/a.ts", "src/./a.ts"], "description: safe\nlast_updated: '2026-09-14T00:00:00Z'");
    const deps = services(); await deps.indexManager.scan();
    expect(deps.indexManager.getIndex().cartridges.paths.trackedFiles).toEqual(["src/a.ts"]);
    deps.indexManager.detectMissedChanges(deps.config.scoring); deps.indexManager.reconcileTrackedState();
    expect(deps.indexManager.getIndex().cartridges.paths.pendingChanges.map((item) => item.filePath)).toEqual(["src/a.ts"]);
    expect(deps.indexManager.getAffectedCartridges(".\\src\\a.ts")).toEqual(["paths"]);
    await deps.indexManager.persist();
    const reloaded = new CartridgeIndexManager(deps.config); await reloaded.load();
    expect(reloaded.getIndex().cartridges.paths.staleness).toBe(30);
  });

  it("CORE-06 normalizes old persisted ownership and duplicate pending spellings on reload", async () => {
    write("src/a.ts", "source"); card("paths", ["src/a.ts"]);
    const deps = services(); await deps.indexManager.scan();
    const index = deps.indexManager.getIndex();
    index.cartridges.paths.trackedFiles = ["src\\a.ts", "./src/a.ts"];
    index.cartridges.paths.pendingChanges = [
      { filePath: "src\\a.ts", eventType: "change", timestamp: "first" },
      { filePath: "./src/a.ts", eventType: "change", timestamp: "second" },
    ];
    index.fileMap = { "src\\a.ts": ["paths"], "./src/a.ts": ["paths"] };
    write(".cartridge/index.json", JSON.stringify(index));
    const loaded = new CartridgeIndexManager(deps.config); expect(await loaded.load()).toBe(true);
    expect(loaded.getAffectedCartridges("src/a.ts")).toEqual(["paths"]);
    expect(loaded.getIndex().cartridges.paths.trackedFiles).toEqual(["src/a.ts"]);
    expect(loaded.getIndex().cartridges.paths.pendingChanges).toHaveLength(1);
    expect(parseTrackedFiles("## Tracked Files\n- src/../secret.ts\n- //server/path\n")).toEqual(["src/../secret.ts", "//server/path"]);
  });

  it("CORE-06 retains newest pending evidence regardless of alias array order", async () => {
    card("paths", ["src/a.ts"]); const deps = services(); await deps.indexManager.scan();
    const index = deps.indexManager.getIndex();
    index.cartridges.paths.pendingChanges = [
      { filePath: "src\\a.ts", eventType: "change", timestamp: "2026-10-04T00:00:00Z" },
      { filePath: "./src/a.ts", eventType: "unlink", timestamp: "2026-10-03T00:00:00Z" },
    ];
    index.cartridges.paths.sourceFingerprints = { "src\\a.ts": "newer", "./src/a.ts": "older" };
    write(".cartridge/index.json", JSON.stringify(index));
    const loaded = new CartridgeIndexManager(deps.config); await loaded.load();
    expect(loaded.getIndex().cartridges.paths.pendingChanges).toEqual([
      { filePath: "src/a.ts", eventType: "change", timestamp: "2026-10-04T00:00:00Z" },
    ]);
    expect(loaded.getIndex().cartridges.paths.sourceFingerprints?.["src/a.ts"]).toBeUndefined();
    index.cartridges.paths.pendingChanges[0].timestamp = "unparseable";
    write(".cartridge/index.json", JSON.stringify(index)); await loaded.load();
    expect(loaded.getIndex().cartridges.paths.pendingChanges[0].eventType).toBe("unlink");
  });

  it("CORE-09 propagates side-effect imports and ignores commented/string fake imports", async () => {
    write("src/a.ts", "import './bootstrap.js';\n// import './fake.js';\nconst text = \"import './fake.js'\";\n/* import './fake.js'; */\n");
    write("src/bootstrap.ts", "export {};\n"); write("src/fake.ts", "export {};\n");
    card("a", ["src/a.ts"]); card("bootstrap", ["src/bootstrap.ts"]); card("fake", ["src/fake.ts"]);
    const deps = services(); await deps.indexManager.scan();
    expect(deps.indexManager.getIndex().cartridges.a.engineeringDependencies).toEqual(["bootstrap"]);
    await handleProjectFileEvent({ ...deps, absFilePath: path.join(root, "src/bootstrap.ts"), eventType: "change" });
    expect(deps.indexManager.getIndex().cartridges.a.indirectStaleness).toBe(10);
    expect(extractImports("import { import as importValue } from './named.js'; export { importValue } from './other.js';")).toEqual(["./named.js", "./other.js"]);
    expect(extractImports("const x = `${await import('./bootstrap.js')}`;")).toEqual(["./bootstrap.js"]);
    expect(extractImports("`text ${`inner ${require('./nested.js')}`} import './fake.js'`;")).toEqual(["./nested.js"]);
    expect(extractImports("`import './fake.js'`; import './bootstrap.js';")).toEqual(["./bootstrap.js"]);
  });

  it("CORE-11 keeps live, offline and reconciliation scores identical under a fixed clock", async () => {
    write("src/a.ts", "source"); card("score", ["src/a.ts"], "description: safe\nlast_updated: '2026-09-14T00:00:00Z'");
    const deps = services(); await deps.indexManager.scan();
    await handleProjectFileEvent({ ...deps, absFilePath: path.join(root, "src/a.ts"), eventType: "change" });
    expect(deps.indexManager.getIndex().cartridges.score.staleness).toBe(30);
    await refreshMemoryIndex({ projectRoot: root, config: deps.config, indexManager: deps.indexManager, detectMissedChanges: true, persist: true });
    expect(deps.indexManager.getIndex().cartridges.score.staleness).toBe(30);
    deps.indexManager.reconcileTrackedState();
    expect(deps.indexManager.getIndex().cartridges.score.staleness).toBe(30);
  });

  it("CORE-R4 rejects recursive YAML aliases while preserving ordinary shared aliases", async () => {
    const cyclic = "---\nname: bad\nloop: &loop\n  self: *loop\n---\nbody\n";
    expect(() => matter(cyclic)).toThrow(/cyclic|recursive/i);
    expect(matter("---\none: &value { a: 1 }\ntwo: *value\n---\nbody").data.two).toEqual({ a: 1 });
    write(".agents/memory/cyclic/MEMORY.md", cyclic); card("healthy", []);
    const deps = services(); await deps.indexManager.scan(); await deps.indexManager.persist();
    expect(deps.indexManager.getIndex().cartridges.cyclic.contentQualityStatus).toBe("pending_review");
    expect(Object.keys(deps.indexManager.getIndex().cartridges)).toContain("healthy");
    expect(await new CartridgeIndexManager(deps.config).load()).toBe(true);
  });
  it("CORE-R1 ignores candidate owner artifacts even when configured exclusions are empty", async () => {
    const config = createConfig(root, { excludeDirs: [], ignoreFiles: [] });
    const indexManager = new CartridgeIndexManager(config);
    const writer = new MemoryWriter(config);
    const analyzer = new StalenessAnalyzer(config, indexManager, writer);
    const artifact = ".cartridge/index.lock.candidate-42-00000000-0000-4000-8000-000000000001/owner-00000000-0000-4000-8000-000000000001.json";
    write(artifact, "{}");
    indexManager.reconcileUntrackedFiles([artifact, "source.ts"]);
    expect(indexManager.getUntrackedFiles().map(entry => entry.filePath)).toEqual(["source.ts"]);
    const before = JSON.stringify(indexManager.getIndex());
    await handleProjectFileEvent({ config, indexManager, writer, analyzer, gitignoreFilter: new GitignoreFilter(root), absFilePath: path.join(root, artifact), eventType: "change" });
    expect(JSON.stringify(indexManager.getIndex())).toBe(before);
    expect(fs.existsSync(path.join(root, ".cartridge/index.json"))).toBe(false);
  });

});
