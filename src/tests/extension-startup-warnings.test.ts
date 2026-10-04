import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { injectExtensionStartupWarnings } from "../extension-startup-warnings.js";
import { createConfig } from "../config.js";
import { CartridgeIndexManager } from "../index-manager.js";
import { MemoryWriter } from "../writer.js";
import { runProjectIndexTransaction } from "../project-index-transaction.js";
import { deferred, surfaceEntry, surfaceIndex } from "./surface-regression-fixtures.js";
const roots: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true }))); });
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "extension-startup-")); roots.push(root);
  const config = createConfig(root), indexManager = new CartridgeIndexManager(config), writer = new MemoryWriter(config);
  const card = path.join(root, ".agents/memory/core/MEMORY.md");
  await fs.mkdir(path.dirname(card), { recursive: true }); await fs.writeFile(card, "---\ntitle: Core\n---\n\n# Core\n");
  await fs.mkdir(path.join(root, ".cartridge"));
  await fs.writeFile(path.join(root, ".cartridge/index.json"), JSON.stringify(surfaceIndex({ core: surfaceEntry({ staleness: 20, pendingChanges: [{ filePath: "src/core.ts", eventType: "change", timestamp: "now" }] }) })));
  await indexManager.load();
  return { root, config, indexManager, writer, card };
}
it("reloads canonical pending state before startup injection, preserving another manager's completed synchronization", async () => {
  const f = await fixture(); const other = new CartridgeIndexManager(f.config); const before = await fs.readFile(f.card, "utf8");
  await runProjectIndexTransaction({ projectRoot: f.root, indexManager: other, mutation: async () => {
    const entry = other.getIndex().cartridges.core; entry.staleness = 0; entry.pendingChanges = []; other.markDirty();
  } });
  const write = vi.spyOn(f.writer, "injectWarning");
  await injectExtensionStartupWarnings({ ...f, isActive: () => true });
  expect(write).not.toHaveBeenCalled(); expect(await fs.readFile(f.card, "utf8")).toBe(before);
  expect(f.indexManager.getIndex().cartridges.core.staleness).toBe(0);
});
it("writes current warnings only while owning the actual project transaction", async () => {
  const f = await fixture(); const original = f.writer.injectWarning.bind(f.writer);
  const write = vi.spyOn(f.writer, "injectWarning").mockImplementation(async (...args) => {
    expect((await fs.stat(path.join(f.root, ".cartridge/index.lock"))).isDirectory()).toBe(true);
    await original(...args);
  });
  await injectExtensionStartupWarnings({ ...f, isActive: () => true });
  expect(write).toHaveBeenCalledTimes(1); expect(await fs.readFile(f.card, "utf8")).toContain("src/core.ts");
});
it("cancels startup writes after deactivation while waiting for a transaction", async () => {
  const f = await fixture(); const entered = deferred<void>(), release = deferred<void>();
  const other = new CartridgeIndexManager(f.config); let active = true;
  const competing = runProjectIndexTransaction({ projectRoot: f.root, indexManager: other, mutation: async () => { entered.resolve(); await release.promise; } });
  await entered.promise;
  const write = vi.spyOn(f.writer, "injectWarning");
  const pending = injectExtensionStartupWarnings({ ...f, isActive: () => active });
  active = false; release.resolve(); await competing; await pending;
  expect(write).not.toHaveBeenCalled();
});
