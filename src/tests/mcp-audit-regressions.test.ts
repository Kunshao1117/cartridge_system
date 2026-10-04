import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleMemoryCommit } from "../mcp-handlers.js";
import * as transactions from "../project-index-transaction.js";
import * as memoryPatch from "../memory-source-patch.js";
import type { CartridgeEntry, CartridgeIndex } from "../types.js";

let root: string;
const main = ".agents/memory/safe/MEMORY.md";
const text = "---\nname: safe\ndescription: card\nlast_updated: '2026-01-01T00:00:00Z'\nstaleness: 10\ndependencies: []\n---\n# Reviewed body\n\n## Tracked Files\n- src/safe.ts\n";
function write(relative: string, content: string) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}
function persisted(): CartridgeIndex {
  return JSON.parse(fs.readFileSync(path.join(root, ".cartridge/index.json"), "utf8"));
}
function save(index: CartridgeIndex) { write(".cartridge/index.json", JSON.stringify(index)); }
function envelope(result: Awaited<ReturnType<typeof handleMemoryCommit>>) { return JSON.parse(result.content[0].text); }
function commit() { return handleMemoryCommit({ projectRoot: root, moduleName: "safe", confirm: true }); }
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "cartridge-audit-mcp-"));
  write(main, text);
  write("src/safe.ts", "export const safe = 1;\n");
  const entry: CartridgeEntry = { skillPath: main, description: "card", trackedFiles: ["src/safe.ts"], staleness: 10, lastUpdated: "2026-01-01T00:00:00Z", pendingChanges: [{ filePath: "src/safe.ts", eventType: "change", timestamp: "2026-01-01T01:00:00Z" }], depth: 1, parent: null, ghostFiles: [], dependencies: [], declaredDependencies: [], engineeringDependencies: [], indirectStaleness: 0 };
  save({ version: 1, lastScanned: "before", cartridges: { safe: entry }, fileMap: { "src/safe.ts": ["safe"] }, untrackedFiles: [] });
});
afterEach(() => { vi.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true }); });

describe("MCP-01 revision-bound memory_commit", () => {
  it("refuses a newer card body observed while waiting for the real transaction", async () => {
    const realTransaction = transactions.runProjectIndexTransaction;
    vi.spyOn(transactions, "runProjectIndexTransaction").mockImplementationOnce(async (options) => {
      write(main, text.replace("Reviewed body", "Newer body must survive"));
      return realTransaction(options);
    });
    const result = envelope(await commit());
    expect.soft(result.status).toBe("error");
    expect.soft(fs.readFileSync(path.join(root, main), "utf8")).toBe(text.replace("Reviewed body", "Newer body must survive"));
    expect.soft(persisted().cartridges.safe.pendingChanges).toHaveLength(1);
  });

  it("never overwrites an external edit after preparing a replacement from the old body", async () => {
    const realPatch = memoryPatch.patchMemorySource;
    vi.spyOn(memoryPatch, "patchMemorySource").mockImplementationOnce((...args) => {
      const candidate = realPatch(...args);
      write(main, text.replace("Reviewed body", "External newer body"));
      return candidate;
    });
    const result = envelope(await commit());
    expect.soft(fs.readFileSync(path.join(root, main), "utf8")).toBe(text.replace("Reviewed body", "External newer body"));
    expect.soft(persisted().cartridges.safe.pendingChanges).toHaveLength(1);
    expect.soft(result.status).toBe("error");
  });

  it("does not acknowledge a pending event added after the reviewed snapshot", async () => {
    const realTransaction = transactions.runProjectIndexTransaction;
    vi.spyOn(transactions, "runProjectIndexTransaction").mockImplementationOnce(async (options) => {
      const latest = persisted();
      latest.cartridges.safe.pendingChanges.push({ filePath: "src/safe.ts", eventType: "change", timestamp: "2026-10-04T08:00:00Z" });
      latest.cartridges.safe.staleness = 20;
      save(latest);
      return realTransaction(options);
    });
    const result = envelope(await commit());
    expect.soft(result.status).toBe("error");
    expect.soft(fs.readFileSync(path.join(root, main), "utf8")).toBe(text);
    expect.soft(persisted().cartridges.safe.pendingChanges).toHaveLength(2);
    expect.soft(persisted().cartridges.safe.staleness).toBe(20);
  });

  it("does not acknowledge changed source bytes before the pending event is delivered", async () => {
    const realTransaction = transactions.runProjectIndexTransaction;
    vi.spyOn(transactions, "runProjectIndexTransaction").mockImplementationOnce(async (options) => {
      write("src/safe.ts", "export const safe = 2;\n");
      return realTransaction(options);
    });
    const result = envelope(await commit());
    expect.soft(result.status).toBe("error");
    expect.soft(fs.readFileSync(path.join(root, main), "utf8")).toBe(text);
    expect.soft(persisted().cartridges.safe.pendingChanges).toHaveLength(1);
  });

  it("does not write the card when acquiring the transaction fails", async () => {
    vi.spyOn(transactions, "runProjectIndexTransaction").mockRejectedValueOnce(new Error("lock unavailable"));
    const before = fs.readFileSync(path.join(root, ".cartridge/index.json"), "utf8");
    const result = envelope(await commit());
    expect.soft(result.status).toBe("error");
    expect.soft(fs.readFileSync(path.join(root, main), "utf8")).toBe(text);
    expect.soft(fs.readFileSync(path.join(root, ".cartridge/index.json"), "utf8")).toBe(before);
  });

  it("keeps the original card and index when atomic card replacement fails", async () => {
    const realRename = fs.renameSync;
    vi.spyOn(fs, "renameSync").mockImplementation((from, to) => {
      if (String(to) === path.join(root, main)) throw new Error("injected card replacement failure");
      return realRename(from, to);
    });
    const before = fs.readFileSync(path.join(root, ".cartridge/index.json"), "utf8");
    expect.soft(envelope(await commit()).status).toBe("error");
    expect.soft(fs.readFileSync(path.join(root, main), "utf8")).toBe(text);
    expect.soft(fs.readFileSync(path.join(root, ".cartridge/index.json"), "utf8")).toBe(before);
    expect.soft(fs.readdirSync(path.dirname(path.join(root, main)))).toEqual(["MEMORY.md"]);
  });

  it("rechecks source revision after staging the replacement", async () => {
    const realOpen = fsp.open;
    vi.spyOn(fsp, "open").mockImplementation(async (...args) => {
      if (String(args[0]).includes(".cartridge-review-")) write("src/safe.ts", "export const safe = 3;\n");
      return realOpen(...args);
    });
    expect.soft(envelope(await commit()).status).toBe("error");
    expect.soft(fs.readFileSync(path.join(root, main), "utf8")).toBe(text);
    expect.soft(persisted().cartridges.safe.pendingChanges).toHaveLength(1);
  });

  it("preserves directory tracking declarations and token-free legacy CRLF cards", async () => {
    const legacy = ".agents/memory/safe/SKILL.md";
    fs.renameSync(path.join(root, main), path.join(root, legacy));
    fs.mkdirSync(path.join(root, "src/templates"));
    const original = text.replace("staleness: 10", "staleness: 10\nunknown: preserved").replace("- src/safe.ts", "- src/safe.ts\n- src/templates/").replace(/\n/g, "\r\n");
    write(legacy, original);
    const index = persisted(); index.cartridges.safe.skillPath = legacy; save(index);
    const result = envelope(await commit());
    expect.soft(result.summary.synchronizationComplete).toBe(true);
    const updated = fs.readFileSync(path.join(root, legacy), "utf8");
    expect.soft(updated).toContain("unknown: preserved\r\n");
    expect.soft(updated.slice(updated.indexOf("# Reviewed body"))).toBe(original.slice(original.indexOf("# Reviewed body")));
    expect.soft(fs.existsSync(path.join(root, main))).toBe(false);
    expect.soft(persisted().cartridges.safe.trackedFiles).toContain("src/templates/");
  });

  it("reports partial persistence after a real index replacement failure without hiding pending state", async () => {
    const realRename = fsp.rename;
    vi.spyOn(fsp, "rename").mockImplementation(async (from, to) => {
      if (String(to) === path.join(root, ".cartridge/index.json")) throw new Error("injected index replacement failure");
      return realRename(from, to);
    });
    const result = envelope(await commit());
    expect.soft(result.summary).toMatchObject({ cardWritten: true, indexSynchronized: false, synchronizationComplete: false });
    expect.soft(result.findings.some((finding: { code: string }) => finding.code === "INDEX_SYNC_PARTIAL")).toBe(true);
    expect.soft(persisted().cartridges.safe.pendingChanges).toHaveLength(1);
  });
});

describe("MCP-02 main file identity", () => {
  it.each(["config.json", "src/config.md", "src/MEMORY.md", ".agents/context/safe/CONTEXT.md"])("does not write an indexed ordinary file %s even with confirm true", async (target) => {
    fs.rmSync(path.join(root, ".agents"), { recursive: true });
    const content = target.endsWith("json") ? '{"keep":true}\n' : text;
    write(target, content);
    const index = persisted();
    index.cartridges.safe.skillPath = target;
    save(index);
    const before = fs.readFileSync(path.join(root, ".cartridge/index.json"), "utf8");
    const result = envelope(await commit());
    expect.soft(result.status).toBe("error");
    expect.soft(fs.readFileSync(path.join(root, target), "utf8")).toBe(content);
    expect.soft(fs.readFileSync(path.join(root, ".cartridge/index.json"), "utf8")).toBe(before);
  });
});
