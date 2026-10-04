/** Child process used only by the real-filesystem lock recovery regression. */
import fs from "node:fs/promises";
import syncFs from "node:fs";
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
  if (role === "containment-observer") {
    const lockPath = path.join(root, ".cartridge/index.lock");
    const resumePath = path.join(root, "continue-containment");
    let observing = false;
    let paused = false;
    // Arm only after observeLock's real async lstat; pause its next containment
    // lstat after the real entry was observed, immediately before realpath.
    fs.lstat = new Proxy(fs.lstat, {
      async apply(target, thisArg, args) {
        const result = await Reflect.apply(target, thisArg, args);
        if (String(args[0]) === lockPath) observing = true;
        return result;
      },
    });
    Object.defineProperty(syncFs, "lstatSync", {
      value: new Proxy(syncFs.lstatSync, {
        apply(target, thisArg, args) {
          const result = Reflect.apply(target, thisArg, args);
          if (observing && !paused && String(args[0]) === lockPath) {
            paused = true;
            process.send?.({ kind: "containment-observed" });
            // This window is synchronous, so an IPC handler cannot resume it.
            // The parent commits/releases the owner before creating this marker.
            const deadline = Date.now() + 10_000;
            const signal = new Int32Array(new SharedArrayBuffer(4));
            while (!syncFs.existsSync(resumePath)) {
              if (Date.now() >= deadline) throw new Error("Timed out waiting for containment barrier");
              Atomics.wait(signal, 0, 0, 2);
            }
          }
          return result;
        },
      }),
    });
  }
  const oldOwnerPath = path.join(root, ".cartridge/index.lock/owner-00000000-0000-4000-8000-000000000001.json");
  if (role === "delayed-reaper" || role === "crash-recovery") {
    // Pause AFTER eligibility but at the exact generation-specific unlink.
    // The production lock and the other process remain entirely real.
    const unlink = fs.unlink.bind(fs);
    let paused = false;
    fs.unlink = async (target) => {
      if (!paused && String(target) === oldOwnerPath) {
        paused = true;
        if (role === "crash-recovery") {
          await unlink(target);
          process.send?.({ kind: "unlinked" });
          await wait("continue");
          return;
        }
        process.send?.({ kind: "observed-stale" });
        await wait("recover");
      }
      return unlink(target);
    };
  }
  if (role === "crash-candidate") {
    const rename = fs.rename.bind(fs);
    fs.rename = async (from, to) => {
      if (String(from).includes("index.lock.candidate-")) {
        process.send?.({ kind: "candidate-ready" });
        await wait("publish");
      }
      return rename(from, to);
    };
  }
  const manager = new CartridgeIndexManager(createConfig(root));
  try {
    await runProjectIndexTransaction({
      projectRoot: root,
      indexManager: manager,
      timing: { localStaleMs: 0, lockTimeoutMs: role === "delayed-reaper" ? 500 : 5_000, retryMinMs: 2, retryMaxMs: 4, heartbeatMs: 10 },
      mutation: async () => {
        process.send?.({ kind: "acquired", role });
        if (role === "fresh-owner" || role === "containment-owner") await wait("commit");
        manager.addUntrackedFile(`${role}.ts`, "add");
        manager.markDirty();
      },
    });
    process.send?.({ kind: "result", ok: true });
  } catch (error) {
    process.send?.({ kind: "result", ok: false, error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined });
  }
}
void main().finally(() => process.disconnect?.());
