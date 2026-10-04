/** Child process used only by the real-filesystem lock recovery regression. */
import fs from "node:fs/promises";
import path from "node:path";
import { createConfig } from "../../config.js";
import { CartridgeIndexManager } from "../../index-manager.js";
import { runProjectIndexTransaction } from "../../project-index-transaction.js";

const [root, role] = process.argv.slice(2);
const messages = new Set<string>();
const waiters = new Map<string, () => void>();
process.on("message", (message) => {
  const value = String(message);
  const waiter = waiters.get(value);
  if (waiter) { waiters.delete(value); waiter(); }
  else messages.add(value);
});
const wait = (message: string): Promise<void> => messages.delete(message)
  ? Promise.resolve() : new Promise((resolve) => waiters.set(message, resolve));

async function main(): Promise<void> {
  if (role === "delayed-reaper") {
    // The barrier is after production stale eligibility, immediately before its
    // destructive rename. It does not simulate the lock or the competing owner.
    const rename = fs.rename.bind(fs);
    let paused = false;
    fs.rename = async (oldPath, newPath) => {
      if (!paused && String(oldPath) === path.join(root, ".cartridge/index.lock") && String(newPath).includes(".stale-")) {
        paused = true;
        process.send?.({ kind: "observed-stale" });
        await wait("recover");
      }
      return rename(oldPath, newPath);
    };
  }
  const manager = new CartridgeIndexManager(createConfig(root));
  try {
    await runProjectIndexTransaction({
      projectRoot: root,
      indexManager: manager,
      timing: { localStaleMs: 0, lockTimeoutMs: 500, retryMinMs: 2, retryMaxMs: 4, heartbeatMs: 10 },
      mutation: async () => {
        process.send?.({ kind: "acquired", role });
        if (role === "fresh-owner") await wait("commit");
        manager.addUntrackedFile(`${role}.ts`, "add");
        manager.markDirty();
      },
    });
    process.send?.({ kind: "result", ok: true });
  } catch (error) {
    process.send?.({ kind: "result", ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}
void main().finally(() => process.disconnect?.());
