import { fork, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { build } from "esbuild";
import { expect, it } from "vitest";

type Message = { kind: string; ok?: boolean; error?: string };
function child(script: string, root: string, role: string) {
  const process: ChildProcess = fork(script, [root, role], { stdio: ["ignore", "ignore", "pipe", "ipc"] });
  const queued: Message[] = [];
  const waiting = new Map<string, { resolve: (value: Message) => void; reject: (error: Error) => void }>();
  let stderr = "";
  process.stderr?.on("data", (data) => { stderr += String(data); });
  process.on("message", (value) => {
    const message = value as Message;
    const waiter = waiting.get(message.kind);
    if (waiter) { waiting.delete(message.kind); waiter.resolve(message); }
    else queued.push(message);
  });
  process.on("exit", (code) => {
    for (const waiter of waiting.values()) waiter.reject(new Error(`Child ${role} exited ${code}: ${stderr}`));
    waiting.clear();
  });
  return {
    process,
    next: (kind: string): Promise<Message> => {
      const index = queued.findIndex((message) => message.kind === kind);
      if (index >= 0) return Promise.resolve(queued.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { waiting.delete(kind); reject(new Error(`Timed out waiting for ${role}: ${kind}; ${stderr}`)); }, 10_000);
        waiting.set(kind, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
      });
    },
  };
}

it("CORE-R1 a delayed stale reaper never removes a different process's fresh live lock", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-lock-race-"));
  const children: ChildProcess[] = [];
  try {
    const script = path.join(root, "worker.cjs");
    await build({ entryPoints: [path.resolve("src/tests/fixtures/index-lock-race-worker.ts")], outfile: script, bundle: true, platform: "node", format: "cjs", logLevel: "silent" });
    const lockPath = path.join(root, ".cartridge/index.lock");
    await fs.mkdir(lockPath, { recursive: true });
    await fs.writeFile(path.join(lockPath, "owner.json"), JSON.stringify({ pid: 999_999_999, hostname: os.hostname(), token: "old-owner", createdAt: 0 }));
    const delayed = child(script, root, "delayed-reaper"); children.push(delayed.process);
    await delayed.next("observed-stale");
    const fresh = child(script, root, "fresh-owner"); children.push(fresh.process);
    await fresh.next("acquired");
    const freshOwner = JSON.parse(await fs.readFile(path.join(lockPath, "owner.json"), "utf8")) as { token: string };
    delayed.process.send("recover");
    const delayedResult = await delayed.next("result");
    // The fresh process still owns a live lease and deliberately has not committed.
    const ownerAfter = await fs.readFile(path.join(lockPath, "owner.json"), "utf8").catch(() => "null");
    fresh.process.send("commit");
    const freshResult = await fresh.next("result");
    expect.soft(delayedResult).toMatchObject({ ok: false, error: expect.stringMatching(/Timed out waiting/) });
    expect.soft(JSON.parse(ownerAfter)).toMatchObject({ token: freshOwner.token });
    expect.soft(freshResult).toMatchObject({ ok: true });
    const indexRaw = await fs.readFile(path.join(root, ".cartridge/index.json"), "utf8").catch(() => "null");
    const index = JSON.parse(indexRaw) as { untrackedFiles?: Array<{ filePath: string }> } | null;
    const committedFiles = index?.untrackedFiles?.map((entry) => entry.filePath) ?? [];
    console.info("CORE-R1 controlled interleaving evidence", { delayedResult, freshResult, freshToken: freshOwner.token,
      ownerAfter: JSON.parse(ownerAfter), committedFiles });
    expect.soft(committedFiles).toEqual(["fresh-owner.ts"]);
  } finally {
    for (const process of children) if (process.exitCode === null) process.kill();
    await Promise.all(children.map((process) => process.exitCode !== null ? Promise.resolve() : new Promise<void>((resolve) => process.once("exit", () => resolve()))));
    await fs.rm(root, { recursive: true, force: true });
  }
}, 30_000);
