import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanContextRegistry } from "../context-registry.js";
import { auditContextInventory } from "../context-audit.js";
import { handleContextDiff, handleContextInventory } from "../context-tools.js";
import { CartridgeIndexManager } from "../index-manager.js";
import { createConfig } from "../config.js";
import { handleMemoryList, handleMemoryRead, handleMemoryStatus, handleMemoryCommit } from "../mcp-handlers.js";
import { buildMemoryAuditReport } from "../memory-audit.js";
import { REQUIRED_MEMORY_QUALITY_FIELDS, REQUIRED_MEMORY_QUALITY_SECTIONS } from "../memory-main-file.js";
import { validateDependencySemantics } from "../dependency-semantics.js";

let root: string;
async function write(relative: string, raw: string) {
  const absolute = path.join(root, relative);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, raw);
}
function card(status = "verified", evidence = "- source: src/one.ts at revision abc123") {
  return [
    "---", "name: one", "description: 測試卡", "staleness: 0",
    "memory_schema_version: 2", "memory_quality_version: 1", "memory_kind: source_fact",
    `verification_status: ${status}`, 'last_verified: "2026-10-04T00:00:00Z"',
    "valid_scope: src/one.ts", "unknown_key: {preserve: true}", "---",
    ...REQUIRED_MEMORY_QUALITY_SECTIONS.flatMap(section => [
      `## ${section}`, section === "Evidence Base" ? evidence : section === "Tracked Files" ? "- src/one.ts" : "- Fixture content.", "",
    ]),
  ].join("\n");
}
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "context-memory-alignment-"));
  await write("package.json", '{"name":"alignment-fixture"}');
  await write("AGENTS.md", "Project instructions.");
});
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

describe("T05-T07 Memory inventory identity and read-only quality", () => {
  it("uses the shared main-file matrix without selecting either conflict candidate or archive", async () => {
    const fixtures = {
      ".agents/memory/current/MEMORY.md": card(),
      ".agents/memory/legacy/SKILL.md": card(),
      ".agents/memory/conflict/MEMORY.md": card().replace("src/one.ts", "src/new-sentinel.ts"),
      ".agents/memory/conflict/SKILL.md": card().replace("src/one.ts", "src/old-sentinel.ts"),
      ".agents/memory/container/child/MEMORY.md": card(),
      ".agents/memory/current/archive-001.md": "Historical content.",
      ".agents/memory/current/archive/001/SKILL.md": "Historical legacy content.",
    };
    for (const [relative, raw] of Object.entries(fixtures)) await write(relative, raw);
    const inventory = await scanContextRegistry(root);
    const memories = inventory.assets.filter(asset => asset.type === "memory");
    const manager = new CartridgeIndexManager(createConfig(root));
    const index = await manager.scan();
    for (const asset of memories) {
      const moduleName = asset.id.replace(/^agents\.memory\./, "");
      expect(asset.mainFile).toEqual(index.cartridges[moduleName].mainFile);
      expect(asset.contentQuality).toEqual(index.cartridges[moduleName].contentQuality);
    }
    await write(".cartridge/index.json", JSON.stringify(index));
    const list = JSON.parse((await handleMemoryList({ projectRoot: root })).content[0].text);
    for (const asset of memories) {
      const moduleName = asset.id.replace(/^agents\.memory\./, "");
      const listed = list.summary.cartridges.find((item: { module: string }) => item.module === moduleName);
      expect(listed.mainFileType).toBe(asset.mainFile?.type);
      expect(listed.contentQualityStatus).toBe(asset.contentQuality?.status);
      const status = JSON.parse((await handleMemoryStatus({ projectRoot: root, moduleName })).content[0].text);
      expect(status.summary.mainFileType).toBe(asset.mainFile?.type);
      expect(status.summary.contentQualityStatus).toBe(asset.contentQuality?.status);
      const read = JSON.parse((await handleMemoryRead({ projectRoot: root, moduleName })).content[0].text);
      if (asset.mainFile?.activePath) {
        expect(read.summary.mainFileType).toBe(asset.mainFile.type);
        expect(read.summary.contentQualityStatus).toBe(asset.contentQuality?.status);
      } else {
        expect(read.status).toBe("error");
        expect(read.summary?.content).toBeUndefined();
      }
    }
    const audit = await buildMemoryAuditReport(root);
    expect(audit.summary.mainFileConflicts).toBe(1);
    expect(audit.summary.missingMainFiles).toBe(1);
    expect(audit.summary.legacyMainFiles).toBe(1);
    expect(audit.summary.memoryMainFiles).toBe(2);
    expect(audit.findings).toContainEqual(expect.objectContaining({ code: "MEMORY_MAIN_FILE_CONFLICT", module: "conflict" }));
    expect(audit.findings).toContainEqual(expect.objectContaining({ code: "MEMORY_MAIN_FILE_MISSING", module: "container" }));
    const conflict = memories.find(asset => asset.id === "agents.memory.conflict")!;
    expect(conflict.mainFile).toMatchObject({ type: "conflict", activePath: null });
    expect(conflict.mainFile?.candidatePaths).toHaveLength(2);
    expect(conflict.path).toBe(".agents/memory/conflict");
    expect(conflict.trackedFiles).toEqual([]);
    expect(conflict.dependencies).toEqual([]);
    expect(memories.find(asset => asset.id === "agents.memory.container")?.mainFile?.type).toBe("missing");
    expect(memories.some(asset => asset.path.includes("archive"))).toBe(false);
    expect(auditContextInventory(inventory)).toContainEqual(expect.objectContaining({ code: "context_memory_main_file_conflict", blocking: true }));
    const output = JSON.parse((await handleContextInventory({ projectRoot: root })).content[0].text);
    expect(output.status).toBe("blocked");
    const diff = JSON.parse((await handleContextDiff({ projectRoot: root, leftId: conflict.id, rightId: "codex.agents" })).content[0].text);
    expect(diff.status).toBe("blocked");
    for (const [relative, raw] of Object.entries(fixtures)) expect(await fs.readFile(path.join(root, relative), "utf8")).toBe(raw);
  });

  it("keeps four supported Memory levels, legacy mem-* identity, true Skills, and custom roots", async () => {
    for (const directory of ["one", "one/two", "one/two/three", "one/two/three/four"]) {
      await write(`custom/memory/${directory}/MEMORY.md`, card());
    }
    await write("custom/memory/one/two/three/four/five/MEMORY.md", card());
    await write("custom/skills/mem-old/SKILL.md", card());
    await write("custom/skills/actual-skill/SKILL.md", "---\nname: actual-skill\n---\nSkill body.\n");
    await write("custom/skills/actual-skill/MEMORY.md", "This is not a Memory root.");
    const inventory = await scanContextRegistry(root, { memoryDir: "custom/memory", skillsDir: "custom/skills" });
    expect(inventory.assets.find(asset => asset.id === "custom.memory.one.two.three.four")?.type).toBe("memory");
    expect(inventory.assets.some(asset => asset.id.endsWith(".five"))).toBe(false);
    expect(inventory.assets.find(asset => asset.id === "custom.skills.mem-old")).toMatchObject({ type: "memory", mainFile: { type: "legacy SKILL.md" } });
    expect(inventory.assets.find(asset => asset.id === "custom.skills.actual-skill")).toMatchObject({ type: "skill", path: path.join("custom", "skills", "actual-skill", "SKILL.md") });
  });

  it.each([
    ["verified", "- source: src/one.ts", "complete"],
    ["pending_review", "- source: src/one.ts", "pending_review"],
    ["conflict", "- source: src/one.ts", "conflict"],
    ["superseded", "- source: src/one.ts", "superseded"],
    ["verified", "", "pending_review"],
  ])("retains six fields and nine sections for %s / %s", async (verification, evidence, expected) => {
    await write(".agents/memory/one/MEMORY.md", card(verification, evidence));
    await write("src/one.ts", "export const one = 1;\n");
    const asset = (await scanContextRegistry(root)).assets.find(item => item.type === "memory")!;
    const manager = new CartridgeIndexManager(createConfig(root));
    const index = await manager.scan();
    await write(".cartridge/index.json", JSON.stringify(index));
    for (const handler of [handleMemoryRead, handleMemoryStatus]) {
      const result = JSON.parse((await handler({ projectRoot: root, moduleName: "one" })).content[0].text);
      expect(result.summary.contentQualityStatus).toBe(expected);
    }
    const listed = JSON.parse((await handleMemoryList({ projectRoot: root })).content[0].text).summary.cartridges[0];
    expect(listed.contentQualityStatus).toBe(expected);
    const audit = await buildMemoryAuditReport(root);
    expect(audit.summary.pendingQualityReview).toBe(expected === "pending_review" ? 1 : 0);
    expect(audit.summary.supersededQuality).toBe(expected === "superseded" ? 1 : 0);
    expect(audit.summary.evidenceWarnings > 0).toBe(evidence === "");
    expect(asset.contentQuality?.status).toBe(expected);
    expect(asset.contentQuality?.requiredFields).toEqual(REQUIRED_MEMORY_QUALITY_FIELDS);
    expect(asset.contentQuality?.requiredFields).toHaveLength(6);
    expect(asset.contentQuality?.requiredSections).toHaveLength(9);
    const committed = JSON.parse((await handleMemoryCommit({ projectRoot: root, moduleName: "one", confirm: true })).content[0].text);
    expect(committed.summary.contentQualityStatus).toBe(expected);
    expect(committed.summary.cardWritten).toBe(true);
    expect(committed.summary.synchronizationComplete).toBe(true);
  });
});

describe("T08 dependency rationale compatibility", () => {
  it.each(["Current Truth", "Active Constraints", "Key Decisions", "Known Issues"])("accepts recorded rationale in %s", heading => {
    const warnings = validateDependencySemantics({ moduleName: "consumer", dependencies: ["upstream"], body: `## ${heading}\r\n- This dependency consumes upstream policy; upstream changes require this card to be reviewed.\r\n` });
    expect(warnings.some(item => item.code === "DEPENDENCY_REASON_MISSING")).toBe(false);
  });
  it("does not treat Relations or Applicable Skills as dependency rationale", () => {
    const warnings = validateDependencySemantics({ moduleName: "consumer", dependencies: ["upstream"], body: "## Relations\n- dependency upstream is recommended reading.\n## Applicable Skills\n- import upstream.\n" });
    expect(warnings.map(item => item.code)).toContain("DEPENDENCY_REASON_MISSING");
    expect(warnings.map(item => item.code)).toContain("DEPENDENCY_RELATION_MIRROR_SUSPECT");
  });
});
