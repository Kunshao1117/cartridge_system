import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeProjectWatcherOptions } from "../monitoring/node-project-watcher.js";

const watcher = vi.hoisted(() => ({ options: undefined as NodeProjectWatcherOptions | undefined }));
vi.mock("../monitoring/node-project-watcher.js", () => ({
  NodeProjectWatcher: class {
    constructor(options: NodeProjectWatcherOptions) { watcher.options = options; }
    start() {}
    stop() {}
  },
}));

import { CartridgeProjectMonitor } from "../monitoring/project-monitor.js";

let root: string | undefined;
let monitor: CartridgeProjectMonitor | undefined;
afterEach(async () => {
  if (root) await fs.rm(path.join(root, ".cartridge/index.lock"), { recursive: true, force: true });
  await monitor?.stop();
  if (root) await fs.rm(root, { recursive: true, force: true });
  root = undefined;
  monitor = undefined;
  watcher.options = undefined;
});

describe("CORE-R2 real source transaction drain", () => {
  it("waits for a source event blocked on an external disk lock and leaves no writes after stop", async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "monitor-lock-drain-"));
    const cardPath = path.join(root, ".agents/memory/main/MEMORY.md");
    const sourcePath = path.join(root, "src/main.ts");
    const indexPath = path.join(root, ".cartridge/index.json");
    const lockPath = path.join(root, ".cartridge/index.lock");
    await fs.mkdir(path.dirname(cardPath), { recursive: true });
    await fs.mkdir(path.dirname(sourcePath), { recursive: true });
    await fs.writeFile(path.join(root, "package.json"), '{"name":"lock-drain-fixture"}');
    await fs.writeFile(sourcePath, "export const current = 1;\n");
    await fs.writeFile(cardPath, [
      "---", "name: main", "description: Source transaction fixture", "staleness: 0",
      `last_updated: '${new Date().toISOString()}'`, "---", "# Current module", "",
      "## Tracked Files", "- src/main.ts", "",
    ].join("\n"));
    monitor = new CartridgeProjectMonitor(root);
    await monitor.start();
    const initialCard = await fs.readFile(cardPath, "utf8");
    const initialIndex = await fs.readFile(indexPath, "utf8");
    await fs.mkdir(lockPath);
    const token = randomUUID();
    await fs.writeFile(path.join(lockPath, `owner-${token}.json`), JSON.stringify({
      protocolVersion: 2, pid: process.pid, hostname: os.hostname(), token, createdAt: Date.now(),
    }));
    await fs.writeFile(sourcePath, "export const current = 2;\n");
    watcher.options!.onEvent(sourcePath, "change");
    let stopped = false;
    const stopping = monitor.stop().then(() => { stopped = true; });
    try {
      // The real transaction cannot acquire this live external lock. The delay
      // only gives stop's already-resolved dirty check time to reveal the bug.
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(stopped).toBe(false);
      expect(await fs.readFile(cardPath, "utf8")).toBe(initialCard);
      expect(await fs.readFile(indexPath, "utf8")).toBe(initialIndex);
    } finally {
      await fs.rm(lockPath, { recursive: true, force: true });
      await stopping;
    }
    const finalCard = await fs.readFile(cardPath, "utf8");
    const finalIndex = await fs.readFile(indexPath, "utf8");
    expect(JSON.parse(finalIndex).cartridges.main.pendingChanges).toContainEqual(expect.objectContaining({ filePath: "src/main.ts" }));
    expect(finalCard).toContain("CARTRIDGE_SYSTEM_WARNING_START");
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(await fs.readFile(cardPath, "utf8")).toBe(finalCard);
    expect(await fs.readFile(indexPath, "utf8")).toBe(finalIndex);
  });
});
