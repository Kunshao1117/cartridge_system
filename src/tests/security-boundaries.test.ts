import { CartridgeProjectMonitor } from "../monitoring/project-monitor.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import matter from "../safe-frontmatter.js";
import { assertPathInsideProject, tryProjectPath } from "../file-containment.js";
import { resolveProjectFilePath } from "../desktop/path-guard.js";
import { projectFileOpenCommand, openProjectFile } from "../project-file-command.js";
import { createConfig } from "../config.js";
import { CartridgeIndexManager } from "../index-manager.js";
import { MemoryWriter } from "../writer.js";
import { loadCabinetMemoryMetadata, parseCabinetMemoryMetadata } from "../cabinet-memory-metadata.js";
import { buildSkillContextAsset } from "../context-contract.js";
import { scanContextRegistry } from "../context-registry.js";
import { parseProjectContextCard, scanProjectContextCards } from "../project-context-registry.js";
import { buildCompactionMetrics } from "../memory-compaction.js";
import { analyzeMemoryContentQuality } from "../memory-main-file.js";
import { buildMemoryAuditReport } from "../memory-audit.js";
import { scanFileImports } from "../import-resolver.js";
import { handleMemoryRead, handleMemoryCommit, handleMemoryDeps, resolveMemoryMainFileForModule, updateFrontmatterFields } from "../mcp-handlers.js";
import type { CartridgeEntry, CartridgeIndex } from "../types.js";

const sentinel = globalThis as typeof globalThis & { cartridgeSecuritySentinel?: string };
const malicious = (language: string) => `---${language}\n({ name: (globalThis.cartridgeSecuritySentinel = 'executed'), staleness: 0 })\n---\n# body\n`;
const clean = "---\nname: safe\ndescription: safe card\nstaleness: 0\nlast_updated: '2026-10-04T00:00:00Z'\n---\n# Safe\n\n## Tracked Files\n- src/safe.ts\n";
const cardPath = ".agents/memory/safe/MEMORY.md";
let sandbox: string;
let root: string;
let outside: string;

function write(relative: string, content: string, base = root) {
  const target = path.join(base, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  return target;
}
function entry(skillPath = cardPath): CartridgeEntry {
  return { skillPath, description: "", trackedFiles: [], staleness: 0, lastUpdated: "", pendingChanges: [], depth: 1, parent: null, ghostFiles: [], dependencies: [], indirectStaleness: 0 };
}
function index(card: CartridgeEntry): CartridgeIndex {
  return { version: 1, lastScanned: "", cartridges: { safe: card }, fileMap: {}, untrackedFiles: [] };
}
function linkedDirectory(target: string, link: string) {
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
}

beforeEach(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "cartridge-security-"));
  root = path.join(sandbox, "project");
  outside = path.join(sandbox, "outside");
  fs.mkdirSync(root);
  fs.mkdirSync(outside);
  delete sentinel.cartridgeSecuritySentinel;
});
afterEach(() => {
  vi.restoreAllMocks();
  delete sentinel.cartridgeSecuritySentinel;
  fs.rmSync(sandbox, { recursive: true, force: true });
});

describe("data-only frontmatter boundary", () => {
  it.each(["js", "javascript", "JavaScript", "toml", "python", "constructor", "__proto__", "toString"])("rejects %s before any engine executes", (language) => {
    const raw = malicious(language);
    expect(() => matter(raw)).toThrow(/Unsupported frontmatter/);
    expect(() => updateFrontmatterFields(raw, { staleness: 0 })).toThrow();
    expect(() => parseCabinetMemoryMetadata(raw)).toThrow();
    expect(() => buildSkillContextAsset({ id: "x", relativePath: "x/SKILL.md", owner: "cartridge", priority: 1, content: raw })).toThrow();
    expect(() => parseProjectContextCard({ projectRoot: root, absolutePath: path.join(root, "CONTEXT.md"), raw })).toThrow();
    expect(() => buildCompactionMetrics(raw)).toThrow();
    analyzeMemoryContentQuality(raw, { type: "MEMORY.md", activePath: cardPath, activeFileName: "MEMORY.md", candidates: { memory: cardPath }, candidatePaths: [cardPath], legacyCompatibility: false, migrationRequired: false, conflict: false }); // Quality diagnostics catch parse errors.
    expect(sentinel.cartridgeSecuritySentinel).toBeUndefined();
  });

  it.each([1, 2, 3])("normalizes %s leading BOMs before checking engines", (count) => {
    const prefix = "\uFEFF".repeat(count);
    for (const language of ["js", "javascript", "constructor", "toml"]) {
      for (const newline of ["\n", "\r\n"]) {
        expect(() => matter(prefix + malicious(language).replace(/\n/g, newline))).toThrow();
        expect(() => matter(prefix + `---${language}${newline}${newline}---${newline}`)).toThrow();
      }
      expect(sentinel.cartridgeSecuritySentinel).toBeUndefined();
    }
    const safeYaml = prefix + "---\nname: yaml\n---\nbody";
    expect(matter(safeYaml).data.name).toBe("yaml");
    expect(updateFrontmatterFields(safeYaml, { staleness: 0 }).startsWith(prefix + "---")).toBe(true);
    expect(matter(prefix + '---json\n{"name":"json"}\n---\nbody').data.name).toBe("json");
  });

  it("preserves pure YAML/JSON data, dates, unknown fields, BOM and CRLF", () => {
    const raw = "\uFEFF---\r\nname: safe\r\nlast_reviewed: 2026-10-04\r\nquoted_date: '2026-10-04'\r\nunknown:\r\n  nested: [a, b]\r\ndescription: |\r\n  第一行\r\n  第二行\r\n---\r\n# body\r\n";
    const target = write(cardPath, raw);
    const parsed = matter(fs.readFileSync(target, "utf8"));
    expect(parsed.data.last_reviewed).toBeInstanceOf(Date);
    expect(parsed.data.quoted_date).toBe("2026-10-04");
    expect(parsed.data.unknown).toEqual({ nested: ["a", "b"] });
    expect(fs.readFileSync(target, "utf8")).toBe(raw);
    const updated = updateFrontmatterFields(raw, { staleness: 2 });
    expect(updated.startsWith("\uFEFF---\r\n")).toBe(true);
    expect(updated.replace(/\r\n/g, "")).not.toContain("\n");
    expect(matter(updated).data).toEqual({ ...parsed.data, staleness: 2 });
    expect(matter('---json\n{"unknown":{"x":1},"name":"json"}\n---\nbody').data.unknown).toEqual({ x: 1 });
    expect(matter("---yml\nname: yaml\n---\nbody").data.name).toBe("yaml");
    expect(() => matter("---\n!!js/function 'function() {}'\n---")).toThrow();
  });

  it("preserves prototype-named data keys without unsafe object merging", () => {
    const data = JSON.parse('{"__proto__":{"kept":true},"constructor":"kept","prototype":[1,2],"unknown":1}');
    expect(Object.hasOwn(Object.assign({}, data), "__proto__")).toBe(false); // Previous vendor stringify merge loses this key.
    const roundTrip = matter(matter.stringify("body", data)).data;
    expect(Object.hasOwn(roundTrip, "__proto__")).toBe(true);
    expect(roundTrip).toEqual(data);
    expect(matter.stringify("", {})).toBe("\n");
    expect(matter.stringify("body\n", {})).toBe("body\n");
  });

  it("never reparses the body during stringify", () => {
    const body = malicious("javascript");
    const output = matter.stringify(body, { name: "outer", unknown: [1, 2] });
    expect(matter(output).content).toBe(body);
    expect(sentinel.cartridgeSecuritySentinel).toBeUndefined();
  });

  it.each(["js", "javascript"])("keeps %s inert in official filesystem consumers", async (language) => {
    const raw = malicious(language);
    const target = write(cardPath, raw);
    write(".agents/skills/mem-bad/SKILL.md", raw);
    write(".agents/context/bad/CONTEXT.md", raw);
    const writer = new MemoryWriter(createConfig(root));
    for (const action of [() => writer.injectWarning(cardPath, ["src/a.ts"], 30), () => writer.removeWarning(cardPath), () => writer.checkAndCleanWarning(cardPath)]) {
      await expect(action()).rejects.toThrow(/Unsupported frontmatter/);
    }
    const manager = new CartridgeIndexManager(createConfig(root));
    await manager.scan();
    const metadata = await loadCabinetMemoryMetadata(index(entry()), root);
    expect(metadata.safe.title).toBeUndefined();
    const readResult = await handleMemoryRead({ projectRoot: root, moduleName: "safe" });
    expect(JSON.parse(readResult.content[0].text).status).toBe("error");
    await handleMemoryCommit({ projectRoot: root, moduleName: "safe", confirm: true });
    await handleMemoryDeps({ projectRoot: root, moduleName: "safe" });
    await expect(buildMemoryAuditReport(root)).rejects.toThrow();
    await expect(scanContextRegistry(root)).rejects.toThrow();
    await expect(scanProjectContextCards(root)).rejects.toThrow();
    expect(fs.readFileSync(target, "utf8")).toBe(raw);
    expect(sentinel.cartridgeSecuritySentinel).toBeUndefined();
  });

  it("routes every production gray-matter import through the data-only boundary", () => {
    const sourceRoot = path.resolve("src");
    function walk(dir: string): string[] {
      return fs.readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
        if (item.name === "tests") return [];
        const filename = path.join(dir, item.name);
        return item.isDirectory() ? walk(filename) : /\.[cm]?tsx?$/.test(item.name) ? [filename] : [];
      });
    }
    const direct = walk(sourceRoot).filter((file) => /(?:from\s*|require\s*\(\s*)["']gray-matter["']/.test(fs.readFileSync(file, "utf8")));
    expect(direct.map((file) => path.basename(file))).toEqual(["safe-frontmatter.ts"]);
  });
});

describe("final I/O containment across MCP, Desktop and VS Code", () => {
  it.each(["../outside/MEMORY.md", "..\\outside\\MEMORY.md", "C:secret.md", "Z:\\secret.md", "\\\\server\\share\\MEMORY.md", "\\\\?\\C:\\secret.md", "x\0.md"])("rejects unsafe path %s", (candidate) => {
    expect(tryProjectPath(root, candidate)).toBeNull();
    expect(resolveProjectFilePath(root, candidate)).toBeNull();
  });

  it("rejects a sibling-prefix path and permits safe missing leaves", () => {
    expect(tryProjectPath(root, `${root}-other/MEMORY.md`)).toBeNull();
    expect(assertPathInsideProject(root, "new/card/MEMORY.md")).toBe(path.join(root, "new/card/MEMORY.md"));
  });

  it.each(["skillPath", "activePath", "candidatePaths"])("ignores poisoned index %s at all read/write consumers", async (field) => {
    const external = write("MEMORY.md", clean.replace("safe card", "OUTSIDE_SENTINEL"), outside);
    const poisoned = entry("../outside/MEMORY.md");
    if (field !== "skillPath") {
      poisoned.skillPath = ".agents/memory/missing/MEMORY.md";
      poisoned.mainFile = { type: "MEMORY.md", activePath: field === "activePath" ? "../outside/MEMORY.md" : null, activeFileName: "MEMORY.md", candidates: { memory: "../outside/MEMORY.md" }, candidatePaths: field === "candidatePaths" ? ["../outside/MEMORY.md"] : [], legacyCompatibility: false, migrationRequired: false, conflict: false };
    }
    write(".cartridge/index.json", JSON.stringify(index(poisoned)));
    const before = fs.readFileSync(external, "utf8");
    expect((await resolveMemoryMainFileForModule(root, "safe")).status).not.toBe("ready");
    const results = await Promise.all([handleMemoryRead({ projectRoot: root, moduleName: "safe" }), handleMemoryDeps({ projectRoot: root, moduleName: "safe" }), handleMemoryCommit({ projectRoot: root, moduleName: "safe", confirm: true }), loadCabinetMemoryMetadata(index(poisoned), root)]);
    expect(JSON.stringify(results)).not.toContain("OUTSIDE_SENTINEL");
    await expect(new MemoryWriter(createConfig(root)).injectWarning("../outside/MEMORY.md", [], 30)).rejects.toThrow();
    expect(fs.readFileSync(external, "utf8")).toBe(before);
  });

  it("blocks external directory symlinks/junctions in resolver, dependencies, writer and Desktop open", async () => {
    const external = write("MEMORY.md", clean.replace("safe card", "OUTSIDE_SENTINEL"), outside);
    write("source.ts", 'import "./secret";', outside);
    linkedDirectory(outside, path.join(root, ".agents/memory/safe"));
    const before = fs.readFileSync(external, "utf8");
    expect(tryProjectPath(root, cardPath)).toBeNull();
    expect(resolveProjectFilePath(root, cardPath)).toBeNull();
    expect((await resolveMemoryMainFileForModule(root, "safe")).status).not.toBe("ready");
    expect(scanFileImports(".agents/memory/safe/source.ts", root)).toEqual([]);
    expect(JSON.stringify(await handleMemoryRead({ projectRoot: root, moduleName: "safe" }))).not.toContain("OUTSIDE_SENTINEL");
    await expect(new MemoryWriter(createConfig(root)).injectWarning(cardPath, [], 30)).rejects.toThrow();
    expect(fs.readFileSync(external, "utf8")).toBe(before);
  });

  it("blocks escaped configured roots and canonical index directory symlinks/junctions", async () => {
    linkedDirectory(outside, path.join(root, ".agents/memory"));
    await expect(new CartridgeIndexManager(createConfig(root)).scan()).rejects.toThrow();
    linkedDirectory(outside, path.join(root, ".cartridge"));
    const manager = new CartridgeIndexManager(createConfig(root));
    manager.markDirty();
    await expect(manager.persist()).rejects.toThrow();
    expect(fs.existsSync(path.join(outside, "index.json"))).toBe(false);
    expect(fs.existsSync(path.join(outside, "index.lock"))).toBe(false);
  });

  it("retains custom in-project memory/skill roots and internal links/root aliases", async () => {
    write("custom/memory/one/MEMORY.md", clean);
    write("custom/skills/mem-two/SKILL.md", clean);
    const manager = new CartridgeIndexManager(createConfig(root, { memoryDir: "custom/memory", skillsDir: "custom/skills" }));
    const scanned = await manager.scan();
    expect(Object.keys(scanned.cartridges).sort()).toEqual(["mem-two", "one"]);
    await new MemoryWriter(createConfig(root, { memoryDir: "custom/memory" })).injectWarning("custom/memory/one/MEMORY.md", [], 30);
    expect(fs.readFileSync(path.join(root, "custom/memory/one/MEMORY.md"), "utf8")).toContain("CARTRIDGE_SYSTEM_WARNING_START");
    linkedDirectory(path.join(root, "custom/memory/one"), path.join(root, "alias"));
    expect(assertPathInsideProject(root, "alias/MEMORY.md")).toBe(path.join(root, "alias/MEMORY.md"));
    const rootAlias = path.join(sandbox, "project-alias");
    linkedDirectory(root, rootAlias);
    expect(assertPathInsideProject(rootAlias, "custom/memory/one/MEMORY.md")).toBe(path.join(rootAlias, "custom/memory/one/MEMORY.md"));
    expect(projectFileOpenCommand(root, cardPath, "Open")).toEqual({ command: "cartridge.openProjectFile", title: "Open", arguments: [root, cardPath] });
  });

  it("guards the actual VS Code host-open callback after a link changes", async () => {
    write("inside/MEMORY.md", clean);
    const alias = path.join(root, "alias");
    linkedDirectory(path.join(root, "inside"), alias);
    const command = projectFileOpenCommand(root, "alias/MEMORY.md", "Open");
    fs.unlinkSync(alias);
    linkedDirectory(outside, alias);
    const hostOpen = vi.fn(async () => undefined);
    await expect(openProjectFile(command.arguments[0], command.arguments[1], hostOpen)).rejects.toThrow();
    expect(hostOpen).not.toHaveBeenCalled();
    await openProjectFile(root, "inside/MEMORY.md", hostOpen);
    expect(hostOpen).toHaveBeenCalledWith(path.join(root, "inside/MEMORY.md"));
  });

  it("blocks the final memory_deps read even when a manager returns a poisoned entry", async () => {
    write("MEMORY.md", "---\ndependencies: [EXTERNAL_DEPENDENCY_SENTINEL]\n---\n", outside);
    const poisoned = index(entry("../outside/MEMORY.md"));
    vi.spyOn(CartridgeIndexManager.prototype, "scan").mockResolvedValue(poisoned);
    vi.spyOn(CartridgeIndexManager.prototype, "getIndex").mockReturnValue(poisoned);
    const result = await handleMemoryDeps({ projectRoot: root, moduleName: "safe" });
    const envelope = JSON.parse(result.content[0].text);
    expect(envelope.summary.module).toBe("safe");
    expect(JSON.stringify(envelope)).not.toContain("EXTERNAL_DEPENDENCY_SENTINEL");
  });

  it("exercises the Desktop project monitor rescan with malicious frontmatter", async () => {
    const target = write(cardPath, malicious("javascript"));
    const monitor = new CartridgeProjectMonitor(root);
    try {
      const snapshot = await monitor.rescan();
      expect(snapshot.root).toBe(root);
      expect(sentinel.cartridgeSecuritySentinel).toBeUndefined();
      expect(fs.readFileSync(target, "utf8")).toBe(malicious("javascript"));
    } finally {
      await monitor.stop();
    }
  });

  it.skipIf(process.platform === "win32")("blocks dangling leaf links before creation (POSIX symlinks)", () => {
    fs.symlinkSync(path.join(outside, "not-created.md"), path.join(root, "dangling.md"));
    expect(tryProjectPath(root, "dangling.md")).toBeNull();
    expect(fs.existsSync(path.join(outside, "not-created.md"))).toBe(false);
  });
});
