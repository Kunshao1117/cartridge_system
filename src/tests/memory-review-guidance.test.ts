import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryWriter } from "../writer.js";
import { createConfig } from "../config.js";
import matter from "../safe-frontmatter.js";
import { patchMemorySource, readMemorySource } from "../memory-source-patch.js";
import { buildCompactionMetrics, formatCompactionWarnings } from "../memory-compaction.js";
import { classifyMemoryWarnings } from "../staleness.js";
import { buildDesktopProjectSnapshot } from "../monitoring/project-snapshot.js";
import { cartridgesForIssue, getCartridgeStatus } from "../desktop/renderer/status.js";
import type { CartridgeIndex } from "../types.js";

let root: string;
function write(relative: string, raw: string) {
  const absolute = path.join(root, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, raw);
  return absolute;
}
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "memory-review-guidance-")); });
afterEach(() => { vi.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true }); });
const legacy = "\uFEFF---\r\n# Preserve header comments and unknown formatting\r\nname: 'legacy'\r\nstaleness: 0 # derived score\r\nstatus: stable\r\nlast_reviewed: 2026-10-04\r\nunknown: {custom: [one, two]}\r\ndescription: |\r\n  中文描述\r\n  第二行\r\n---\r\n\r\n# Legacy prose\r\n\r\n## Key Decisions\r\n- Existing claim.\r\n\r\n## Tracked Files\r\n- src/one.ts\r\n";

describe("T13/T15 warning writes are derived and idempotent", () => {
  it("preserves user-owned bytes and timestamp across independent writer instances", async () => {
    const relative = ".agents/memory/one/SKILL.md";
    const absolute = write(relative, legacy);
    const archive = write(".agents/memory/one/archive-001.md", "# Archive\nHistorical bytes.\n");
    const spy = vi.spyOn(fs, "writeFileSync");
    await new MemoryWriter(createConfig(root)).injectWarning(relative, ["src/two.ts", "src/one.ts"], 20);
    const first = fs.readFileSync(absolute, "utf8");
    expect(first).toContain("來源變動待複審");
    expect(first).not.toContain("已過期失真");
    expect(first).not.toContain("必須優先閱讀最新原始碼並更新");
    expect(first).toContain("no-write");
    expect(first).toContain("不會自動清除 stale 或同步索引");
    expect(first).toContain("staleness: 20 # derived score\r\n");
    expect(first).toContain("unknown: {custom: [one, two]}\r\n");
    expect(first.replace(/\r\n/g, "")).not.toContain("\n");
    expect(first.endsWith(readMemorySource(legacy).content)).toBe(true);
    expect(matter(first).data).toEqual({ ...matter(legacy).data, staleness: 20, status: "stale" });
    spy.mockClear();
    await new MemoryWriter(createConfig(root)).injectWarning(relative, ["src/one.ts", "src/two.ts", "src/one.ts"], 20);
    expect(spy).not.toHaveBeenCalled();
    expect(fs.readFileSync(absolute, "utf8")).toBe(first);
    expect(fs.readFileSync(archive, "utf8")).toBe("# Archive\nHistorical bytes.\n");
    expect(fs.existsSync(path.join(root, ".agents/memory/one/MEMORY.md"))).toBe(false);
    await new MemoryWriter(createConfig(root)).syncWarningState(relative, [], 0);
    expect(fs.readFileSync(absolute, "utf8")).toBe(legacy);
    spy.mockClear();
    await new MemoryWriter(createConfig(root)).syncWarningState(relative, [], 0);
    expect(spy).not.toHaveBeenCalled();
  });

  it("does not standardize healthy legacy cards or overwrite lifecycle status", async () => {
    const writer = new MemoryWriter(createConfig(root));
    for (const [name, raw] of [
      ["minimal", "---\nname: minimal\nunknown: keep\n---\n# Unchanged legacy body\n"],
      ["deprecated", "---\nname: old\nstaleness: 0\nstatus: deprecated\n---\n# Deprecated body\n"],
      ["progress", "---\nname: progress\nstaleness: 0\nstatus: in_progress\n---\n# In-progress body\n"],
    ]) {
      const relative = `.agents/memory/${name}/SKILL.md`;
      const absolute = write(relative, raw);
      await writer.syncWarningState(relative, [], 0);
      expect(fs.readFileSync(absolute, "utf8")).toBe(raw);
      if (name !== "minimal") {
        await writer.injectWarning(relative, ["src/changed.ts"], 20);
        expect(matter(fs.readFileSync(absolute, "utf8")).data.status).toBe(matter(raw).data.status);
        await writer.syncWarningState(relative, [], 0);
        expect(fs.readFileSync(absolute, "utf8")).toBe(raw);
      }
    }
  });

  it("allows configured roots and legacy memory roots but rejects true Skills, archive and dual main files", async () => {
    const custom = write("custom/memory/one/MEMORY.md", legacy);
    const writer = new MemoryWriter(createConfig(root, { memoryDir: "custom/memory", skillsDir: "custom/skills" }));
    await writer.injectWarning("custom/memory/one/MEMORY.md", ["src/one.ts"], 10);
    expect(fs.readFileSync(custom, "utf8")).toContain("staleness: 10");
    const old = write("custom/skills/mem-old/SKILL.md", legacy);
    await writer.injectWarning("custom/skills/mem-old/SKILL.md", [], 10);
    expect(fs.readFileSync(old, "utf8")).toContain("staleness: 10");
    for (const relative of ["custom/skills/true-skill/SKILL.md", "custom/memory/one/archive/SKILL.md", "custom/memory/one/NOTES.md"]) {
      const absolute = write(relative, legacy);
      await expect(writer.injectWarning(relative, [], 10)).rejects.toThrow();
      expect(fs.readFileSync(absolute, "utf8")).toBe(legacy);
    }
    write("custom/memory/one/SKILL.md", legacy);
    const before = fs.readFileSync(custom, "utf8");
    await expect(writer.injectWarning("custom/memory/one/MEMORY.md", [], 10)).rejects.toThrow("MEMORY_MAIN_FILE_CONFLICT");
    expect(fs.readFileSync(custom, "utf8")).toBe(before);
  });
});

describe("T23 minimal metadata patches", () => {
  it("preserves exact unrelated YAML/body bytes and safely quotes timestamps", () => {
    const updated = patchMemorySource(legacy, { staleness: 5, last_updated: "2026-10-04T05:00:00Z" });
    expect(updated).toContain("staleness: 5 # derived score\r\n");
    expect(updated).toContain('last_updated: "2026-10-04T05:00:00Z"\r\n');
    expect(updated.endsWith(readMemorySource(legacy).content)).toBe(true);
    expect(matter(updated).data.unknown).toEqual(matter(legacy).data.unknown);
    expect(matter(updated).data.last_reviewed).toEqual(matter(legacy).data.last_reviewed);
    expect(patchMemorySource(updated, { staleness: 5, last_updated: "2026-10-04T05:00:00Z" })).toBe(updated);
  });
  it("keeps prototype-named keys and JSON/complex YAML values through safe fallback", () => {
    const raw = '\uFEFF---json\r\n{"__proto__":{"preserve":true},"constructor":"keep","staleness":0,"unknown":[1,2]}\r\n---\r\n# body\r\n';
    const updated = patchMemorySource(raw, { staleness: 2 });
    expect(matter(updated).data).toEqual({ ...matter(raw).data, staleness: 2 });
    expect(Object.hasOwn(matter(updated).data, "__proto__")).toBe(true);
    expect(updated.startsWith("\uFEFF---\r\n")).toBe(true);
    expect(() => patchMemorySource("---javascript\n({staleness:0})\n---\nbody", { staleness: 2 })).toThrow();
  });
});

describe("T16/T20/T24 truthful review guidance", () => {
  it("keeps legacy upgrades optional and direct review blocking without mutating state", () => {
    const metrics = buildCompactionMetrics(legacy);
    const warnings = formatCompactionWarnings("legacy", metrics).join("\n");
    expect(warnings).toContain("僅在需要且已核准結構標準化時升級");
    expect(warnings).not.toContain("下次更新前");
    const entry = { staleness: 20, indirectStaleness: 5, compaction: metrics };
    const before = JSON.stringify(entry);
    const classified = classifyMemoryWarnings({ cartridges: { legacy: entry } });
    expect(classified.blocking.find(item => item.code === "memory_stale")).toMatchObject({ label: "複審來源與記憶卡：legacy", blocking: true });
    expect(JSON.stringify(entry)).toBe(before);
  });
  it("exposes partial derived sync and declaration diagnostics through shared and desktop review views", () => {
    const index: CartridgeIndex = { version: 1, lastScanned: "", fileMap: {}, untrackedFiles: [], cartridges: {
      one: { skillPath: ".agents/memory/one/MEMORY.md", mainFileType: "MEMORY.md", contentQualityStatus: "complete", description: "", trackedFiles: [], staleness: 0, lastUpdated: "", pendingChanges: [], depth: 1, parent: null, ghostFiles: [], dependencies: [], indirectStaleness: 0, dependencySyncWarning: "DEPENDENCY_SYNC_PARTIAL: unavailable", dependencyDiagnostics: [{ code: "DEPENDENCY_TARGET_UNKNOWN", dependency: "gone", message: "Unknown target gone" }] },
    } };
    const classified = classifyMemoryWarnings(index);
    expect(classified.review.map(item => item.code)).toContain("memory_dependency_sync_partial");
    expect(classified.review.map(item => item.code)).toContain("memory_dependency_diagnostic");
    expect(classified.blocking).toEqual([]);
    const snapshot = buildDesktopProjectSnapshot({ projectRoot: root, enabled: true, index });
    expect(snapshot.status).toBe("warning");
    expect(snapshot.cartridges[0].guidance).toContain("不能視為完整同步成功");
    expect(cartridgesForIssue(snapshot, "review")).toHaveLength(1);
    expect(getCartridgeStatus(snapshot.cartridges[0]).label).toBe("複審");
  });
});
