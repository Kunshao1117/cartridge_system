import * as fs from "fs/promises";
import type * as FsPromisesModule from "fs/promises";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConfig } from "../config.js";
import { CartridgeIndexManager } from "../index-manager.js";
import { handleMemoryList, handleMemoryStatus } from "../mcp-handlers.js";
import { buildMemoryAuditReport, handleMemoryAudit } from "../memory-audit.js";
import { scanContextRegistry } from "../context-registry.js";
import { auditContextInventory } from "../context-audit.js";
import { handleContextAudit, handleContextInventory } from "../context-tools.js";

// Mock the module boundary rather than redefining a non-configurable ESM
// namespace export. All operations still use real I/O except this exact read.
const readFault = vi.hoisted(() => ({
  target: undefined as string | undefined,
  deniedReads: 0,
}));
vi.mock("fs/promises", async importOriginal => {
  const actual = await importOriginal<typeof FsPromisesModule>();
  return {
    ...actual,
    readFile: (...args: Parameters<typeof actual.readFile>) => {
      if (readFault.target !== undefined && args[0] === readFault.target) {
        readFault.deniedReads += 1;
        return Promise.reject(Object.assign(new Error("fixture read denied"), { code: "EACCES" }));
      }
      return actual.readFile(...args);
    },
  };
});

let root: string;
async function write(relative: string, raw: string) {
  const absolute = path.join(root, relative);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, raw);
}

function card(name: string, tracked = `src/${name}.ts`, status = "verified"): string {
  return [
    "---", `name: ${name}`, "description: Regression fixture", "last_updated: '2026-10-04T00:00:00Z'",
    "staleness: 0", "memory_schema_version: 2", "memory_quality_version: 1", "memory_kind: implementation",
    `verification_status: ${status}`, "last_verified: '2026-10-04T00:00:00Z'", `valid_scope: ${tracked}`,
    "content_language: en", "human_language: zh-TW", "cycle_id: fixture-001", "cycle_event_count: 1",
    "size_limit_bytes: 16384", "archive_policy: volume", "compaction_status: ready",
    "metadata: {author: fixture, version: '1.0', origin: test, memory_awareness: full, tool_scope: []}", "---",
    "## Current Truth", "- The implementation is documented by this fixture.",
    "## Active Constraints", "- Preserve independently readable cards.",
    "## Cycle Events", "- 01: Recorded current source behavior.", "## Archive Index", "- None.",
    "## Evidence Base", `- source: ${tracked} at revision fixture-001`,
    "## Read Contract", "- Read the documented sources before changing them.",
    "## Conflicts and Supersession", "- None.", "## 中文摘要", "- 測試。",
    "## Tracked Files", `- ${tracked}`, "",
  ].join("\n");
}

async function persistScan() {
  const index = await new CartridgeIndexManager(createConfig(root)).scan();
  await write(".cartridge/index.json", JSON.stringify(index));
  return index;
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "core-diagnostics-"));
  await write("package.json", '{"name":"core-diagnostics-fixture"}');
  await write("AGENTS.md", "Project instructions.");
});

afterEach(async () => {
  readFault.target = undefined;
  readFault.deniedReads = 0;
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});

describe("CORE audit diagnostic regressions", () => {
  it("CORE-07 keeps legacy mem-* canonical IDs distinct from modern unprefixed cards", async () => {
    await write(".agents/skills/mem-old/SKILL.md", card("mem-old"));
    await write(".agents/memory/old/MEMORY.md", card("old"));
    await write("src/mem-old.ts", "export const legacy = 1;\n");
    await write("src/old.ts", "export const current = 1;\n");
    const index = await persistScan();
    expect(Object.keys(index.cartridges).sort()).toEqual(["mem-old", "old"]);
    const report = await buildMemoryAuditReport(root);
    expect(report.summary.cards).toBe(2);
    expect(report.findings.filter(finding => ["INDEX_CARD_MISSING", "INDEX_GHOST_CARD"].includes(finding.code))).toEqual([]);
    expect(report.findings).toContainEqual(expect.objectContaining({ code: "MEMORY_MAIN_FILE_LEGACY", module: "mem-old" }));
  });

  it.each(["constructor", "__proto__", "toString"])("CORE-01 audits reserved card and source name %s as own dictionary keys", async name => {
    const relative = `.agents/memory/${name}/MEMORY.md`;
    await write(relative, card(name, name));
    await write(name, "export const value = 1;\n");
    await write(".cartridge/index.json", JSON.stringify({
      cartridges: Object.fromEntries([[name, {
        skillPath: relative, staleness: 0, trackedFiles: [name], pendingChanges: [],
        ghostFiles: [], dependencies: [], indirectStaleness: 0,
      }]]), fileMap: Object.fromEntries([[name, [name]]]), untrackedFiles: [],
    }));
    const report = await buildMemoryAuditReport(root);
    expect(report.summary.cards).toBe(1);
    expect(report.findings).toEqual([]);
    const result = await handleMemoryAudit({ projectRoot: root });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text).status).toBe("ready");
  });

  it("CORE-01 reports a reserved-name card missing from an ordinary empty persisted dictionary", async () => {
    await write(".agents/memory/constructor/MEMORY.md", card("constructor"));
    await write(".cartridge/index.json", JSON.stringify({ cartridges: {}, fileMap: {}, untrackedFiles: [] }));
    const report = await buildMemoryAuditReport(root);
    expect(report.findings).toContainEqual(expect.objectContaining({ code: "INDEX_CARD_MISSING", module: "constructor" }));
  });

  it("CORE-02 diagnoses duplicate canonical module IDs without merging their engineering ownership", async () => {
    await write(".agents/memory/a.b/MEMORY.md", card("flat", "src/flat.ts"));
    await write(".agents/memory/a/b/MEMORY.md", card("nested", "src/nested.ts"));
    await write("src/flat.ts", "import './nested';\n");
    await write("src/nested.ts", "import './flat';\n");
    const report = await buildMemoryAuditReport(root);
    expect(report.findings).toContainEqual(expect.objectContaining({
      severity: "error", code: "MEMORY_ID_CONFLICT", module: "a.b",
    }));
    const conflict = report.findings.find(finding => finding.code === "MEMORY_ID_CONFLICT")!;
    expect(conflict.file).toContain(".agents/memory/a.b/MEMORY.md");
    expect(conflict.file).toContain(".agents/memory/a/b/MEMORY.md");
    expect(report.cycleDetails.some(cycle => cycle.path.includes("a.b"))).toBe(false);
  });

  it("CORE-08 isolates malformed Memory and Skill cards across inventory and audit handlers", async () => {
    const malformed = "---\nname: [unterminated\n---\n## Tracked Files\n- src/untrusted.ts\n";
    await write(".agents/memory/healthy/MEMORY.md", card("healthy"));
    await write("src/healthy.ts", "export const healthy = true;\n");
    await persistScan();
    for (const relative of [".agents/memory/broken/MEMORY.md", ".agents/skills/mem-broken/SKILL.md", ".agents/skills/broken-skill/SKILL.md"]) {
      await write(relative, malformed);
    }
    const inventory = await scanContextRegistry(root);
    expect(inventory.assets.find(asset => asset.id === "agents.memory.healthy")?.trackedFiles).toEqual(["src/healthy.ts"]);
    for (const id of ["agents.memory.broken", "agents.skills.mem-broken", "agents.skills.broken-skill"]) {
      expect(inventory.assets.find(asset => asset.id === id)).toMatchObject({
        exists: true, risk: "high", trackedFiles: [], dependencies: [], signals: ["context:parse-error"],
      });
    }
    expect(inventory.assets.find(asset => asset.id === "agents.memory.broken")?.contentQuality?.status).toBe("pending_review");
    expect(auditContextInventory(inventory).filter(finding => finding.code === "context_asset_parse_error")).toHaveLength(3);
    for (const handler of [handleContextInventory, handleContextAudit]) {
      const result = await handler({ projectRoot: root });
      expect(result.isError).toBeUndefined();
      const envelope = JSON.parse(result.content[0].text);
      expect(envelope.status).toBe("blocked");
      expect(envelope.findings).toContainEqual(expect.objectContaining({ code: "context_asset_parse_error", file: ".agents/memory/broken/MEMORY.md" }));
    }
    const report = await buildMemoryAuditReport(root);
    expect(report.summary.cards).toBe(3);
    expect(report.summary.pendingQualityReview).toBe(2);
    expect(report.findings.filter(finding => finding.code === "MEMORY_CARD_PARSE_ERROR").map(finding => finding.module).sort()).toEqual(["broken", "mem-broken"]);
    const result = await handleMemoryAudit({ projectRoot: root });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text).status).not.toBe("ready");
    expect(await fs.readFile(path.join(root, ".agents/memory/broken/MEMORY.md"), "utf8")).toBe(malformed);
  });

  it("CORE-08 preserves custom roots when retaining a malformed card diagnostic", async () => {
    await write("custom/memory/broken/MEMORY.md", "---\nname: [unterminated\n---\n");
    await write("custom/memory/healthy/MEMORY.md", card("healthy"));
    await write("custom/skills/mem-old/SKILL.md", card("mem-old"));
    const inventory = await scanContextRegistry(root, { memoryDir: "custom/memory", skillsDir: "custom/skills" });
    expect(inventory.assets.filter(asset => asset.type === "memory")).toHaveLength(3);
    expect(inventory.assets.find(asset => asset.id === "custom.memory.broken")).toMatchObject({ path: "custom/memory/broken/MEMORY.md", signals: ["context:parse-error"] });
  });

  it("CORE-08 retains an unreadable active card and keeps healthy cards available", async () => {
    await write(".agents/memory/unreadable/MEMORY.md", card("unreadable"));
    await write(".agents/memory/healthy/MEMORY.md", card("healthy"));
    const target = path.join(root, ".agents/memory/unreadable/MEMORY.md");
    readFault.target = target;
    const inventory = await scanContextRegistry(root);
    expect(readFault.deniedReads).toBeGreaterThan(0);
    const inventoryDeniedReads = readFault.deniedReads;
    expect(inventory.assets.find(asset => asset.id === "agents.memory.unreadable")).toMatchObject({ exists: true, risk: "high", signals: ["context:read-error"], trackedFiles: [], contentQuality: { status: "pending_review" } });
    expect(inventory.assets.find(asset => asset.id === "agents.memory.healthy")?.contentQuality?.status).toBe("complete");
    const report = await buildMemoryAuditReport(root);
    expect(readFault.deniedReads).toBeGreaterThan(inventoryDeniedReads);
    expect(report.summary.cards).toBe(2);
    expect(report.summary.pendingQualityReview).toBe(1);
    expect(report.findings).toContainEqual(expect.objectContaining({ code: "MEMORY_CARD_READ_ERROR", module: "unreadable", file: ".agents/memory/unreadable/MEMORY.md" }));
  });

  it("CORE-10 blocks current-truth readiness for an otherwise complete quality conflict", async () => {
    await write(".agents/memory/conflicted/MEMORY.md", card("conflicted", "src/conflicted.ts", "conflict"));
    await write("src/conflicted.ts", "export const conflicted = true;\n");
    await persistScan();
    const report = await buildMemoryAuditReport(root);
    expect(report.summary).toMatchObject({ qualityConflicts: 1, mainFileConflicts: 0, missingQualityFields: 0, missingQualitySections: 0, evidenceWarnings: 0 });
    expect(report.findings).toEqual([expect.objectContaining({ severity: "error", code: "MEMORY_QUALITY_CONFLICT", module: "conflicted" })]);
    const envelope = JSON.parse((await handleMemoryAudit({ projectRoot: root })).content[0].text);
    expect(envelope.status).not.toBe("ready");
    expect(envelope.recommendedActions).toContainEqual(expect.objectContaining({ action: "resolve_memory_quality_conflicts" }));
  });
  it.each([
    ["description: Regression fixture", "description: { en: example }"],
    ["last_updated: '2026-10-04T00:00:00Z'", "last_updated: 'not-a-date'"],
  ])("CORE-04 shared quality and audit retain metadata diagnostics for %s", async (before, after) => {
    await write(".agents/memory/metadata/MEMORY.md", card("metadata").replace(before, after));
    await write("src/metadata.ts", "export const metadata = true;\n");
    const index = await persistScan();
    expect(index.cartridges.metadata.contentQualityStatus).toBe("pending_review");
    const listed = JSON.parse((await handleMemoryList({ projectRoot: root })).content[0].text);
    expect(listed.status).not.toBe("ready");
    expect(listed.summary.cartridges.find((item: { module: string }) => item.module === "metadata").contentQualityStatus).toBe("pending_review");
    const status = JSON.parse((await handleMemoryStatus({ projectRoot: root, moduleName: "metadata" })).content[0].text);
    expect(status.status).not.toBe("ready");
    expect(status.summary.contentQualityStatus).toBe("pending_review");
    const report = await buildMemoryAuditReport(root);
    expect(report.findings).toContainEqual(expect.objectContaining({ code: "MEMORY_METADATA_INVALID", module: "metadata" }));
    expect(report.summary.pendingQualityReview).toBe(1);
    expect(JSON.parse((await handleMemoryAudit({ projectRoot: root })).content[0].text).status).not.toBe("ready");
  });

});
