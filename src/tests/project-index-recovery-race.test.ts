import { fork, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { build } from "esbuild";
import { expect, it } from "vitest";

const OLD_TOKEN = "00000000-0000-4000-8000-000000000001";
async function writeStaleV2Lock(root: string) {
  const lockPath = path.join(root, ".cartridge/index.lock");
  await fs.mkdir(lockPath, { recursive: true });
  await fs.writeFile(path.join(lockPath, `owner-${OLD_TOKEN}.json`), JSON.stringify({ protocolVersion: 2,
    pid: 999_999_999, hostname: os.hostname(), token: OLD_TOKEN, createdAt: 0 }));
}
async function readOwner(root: string): Promise<{ token: string } | null> {
  const directory = path.join(root, ".cartridge/index.lock");
  try {
    const owner = (await fs.readdir(directory)).find(name => /^owner-.*\.json$/.test(name));
    return owner ? JSON.parse(await fs.readFile(path.join(directory, owner), "utf8")) : null;
  } catch { return null; }
}
async function stopChild(process: ChildProcess): Promise<void> {
  if (process.exitCode !== null || process.signalCode !== null) return;
  const exited = new Promise<void>(resolve => process.once("exit", () => resolve()));
  process.kill();
  await exited;
}
async function buildWorker(root: string): Promise<string> {
  const script = path.join(root, "worker.cjs");
  await build({ entryPoints: [path.resolve("src/tests/fixtures/index-lock-race-worker.ts")], outfile: script, bundle: true, platform: "node", format: "cjs", logLevel: "silent" });
  return script;
}

type Message = { kind: string; ok?: boolean; error?: string; stack?: string };
function expectSuccess(result: Message): void {
  expect(result, JSON.stringify(result, null, 2)).toMatchObject({ ok: true });
}
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
    const script = await buildWorker(root);
    await writeStaleV2Lock(root);
    const delayed = child(script, root, "delayed-reaper"); children.push(delayed.process);
    await delayed.next("observed-stale");
    const fresh = child(script, root, "fresh-owner"); children.push(fresh.process);
    await fresh.next("acquired");
    const freshOwner = await readOwner(root);
    expect(freshOwner).not.toBeNull();
    delayed.process.send("recover");
    const delayedResult = await delayed.next("result");
    // The fresh process still owns a live lease and deliberately has not committed.
    const ownerAfter = await readOwner(root);
    fresh.process.send("commit");
    const freshResult = await fresh.next("result");
    expect.soft(delayedResult).toMatchObject({ ok: false, error: expect.stringMatching(/Timed out waiting/) });
    expect.soft(ownerAfter).toMatchObject({ token: freshOwner!.token });
    expect.soft(freshResult, JSON.stringify(freshResult, null, 2)).toMatchObject({ ok: true });
    const indexRaw = await fs.readFile(path.join(root, ".cartridge/index.json"), "utf8").catch(() => "null");
    const index = JSON.parse(indexRaw) as { untrackedFiles?: Array<{ filePath: string }> } | null;
    const committedFiles = index?.untrackedFiles?.map((entry) => entry.filePath) ?? [];
    console.info("CORE-R1 controlled interleaving evidence", { delayedResult, freshResult, freshToken: freshOwner!.token,
      ownerAfter, committedFiles });
    expect.soft(committedFiles).toEqual(["fresh-owner.ts"]);
  } finally {
    await Promise.all(children.map(stopChild));
    await fs.rm(root, { recursive: true, force: true });
  }
}, 30_000);


it("CORE-R1 two independent processes serialize and retain both committed mutations", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-lock-serialize-"));
  const children: ChildProcess[] = [];
  try {
    const script = await buildWorker(root);
    const first = child(script, root, "first"); const second = child(script, root, "second");
    children.push(first.process, second.process);
    expectSuccess(await first.next("result"));
    expectSuccess(await second.next("result"));
    const index = JSON.parse(await fs.readFile(path.join(root, ".cartridge/index.json"), "utf8")) as { untrackedFiles: Array<{ filePath: string }> };
    expect(index.untrackedFiles.map(entry => entry.filePath).sort()).toEqual(["first.ts", "second.ts"]);
  } finally { await Promise.all(children.map(stopChild)); await fs.rm(root, { recursive: true, force: true }); }
}, 30_000);

it.each(["crash-candidate", "crash-recovery"])("CORE-R1 recovers safely after process death during %s", async (role) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-lock-crash-"));
  const children: ChildProcess[] = [];
  try {
    const script = await buildWorker(root);
    if (role === "crash-recovery") await writeStaleV2Lock(root);
    const doomed = child(script, root, role); children.push(doomed.process);
    await doomed.next(role === "crash-candidate" ? "candidate-ready" : "unlinked");
    await stopChild(doomed.process);
    const survivor = child(script, root, "survivor"); children.push(survivor.process);
    expectSuccess(await survivor.next("result"));
    const artifacts = await fs.readdir(path.join(root, ".cartridge"));
    expect(artifacts.filter(name => name.startsWith("index.lock"))).toEqual([]);
    const index = JSON.parse(await fs.readFile(path.join(root, ".cartridge/index.json"), "utf8")) as { untrackedFiles: Array<{ filePath: string }> };
    expect(index.untrackedFiles.map(entry => entry.filePath)).toEqual(["survivor.ts"]);
  } finally { await Promise.all(children.map(stopChild)); await fs.rm(root, { recursive: true, force: true }); }
}, 30_000);


it("CORE-R1 normal release between containment lstat and realpath retains both process mutations", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-lock-containment-"));
  const children: ChildProcess[] = [];
  try {
    const script = await buildWorker(root);
    const first = child(script, root, "containment-owner"); children.push(first.process);
    await first.next("acquired");
    const second = child(script, root, "containment-observer"); children.push(second.process);
    await second.next("containment-observed");
    expect(await readOwner(root)).not.toBeNull();
    first.process.send("commit");
    expectSuccess(await first.next("result"));
    expect(await fs.lstat(path.join(root, ".cartridge/index.lock")).then(() => "exists", (error: NodeJS.ErrnoException) => error.code)).toBe("ENOENT");
    await fs.writeFile(path.join(root, "continue-containment"), "released");
    expectSuccess(await second.next("result"));
    const index = JSON.parse(await fs.readFile(path.join(root, ".cartridge/index.json"), "utf8")) as { untrackedFiles: Array<{ filePath: string }> };
    expect(index.untrackedFiles.map(entry => entry.filePath).sort()).toEqual(["containment-observer.ts", "containment-owner.ts"]);
  } finally {
    await Promise.all(children.map(stopChild));
    await fs.rm(root, { recursive: true, force: true });
  }
}, 30_000);
