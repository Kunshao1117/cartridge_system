import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TestContext } from "vitest";
import { assertPathInsideProject, PathContainmentError } from "../file-containment.js";

let root: string;
let outside: string;
const originalRealpath = fs.realpathSync;
const directoryLinkType = process.platform === "win32" ? "junction" : "dir";

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "cartridge-containment-race-"));
  outside = fs.mkdtempSync(path.join(os.tmpdir(), "cartridge-containment-outside-"));
  fs.writeFileSync(path.join(outside, "sentinel.txt"), "outside bytes are unchanged");
});
afterEach(() => {
  vi.restoreAllMocks();
  try {
    expect(fs.readFileSync(path.join(outside, "sentinel.txt"), "utf8")).toBe("outside bytes are unchanged");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

function requireDirectoryLinks(context: TestContext, dangling = false): void {
  const probe = path.join(root, "link-capability-probe");
  try {
    fs.symlinkSync(dangling ? path.join(outside, "missing") : outside, probe, directoryLinkType);
    expect(fs.lstatSync(probe).isSymbolicLink()).toBe(true);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (process.platform === "win32" && ["EPERM", "EACCES", "ENOSYS", "ENOTSUP"].includes(code ?? "")) {
      context.skip(`Windows directory junction capability unavailable: ${code}`);
    }
    throw error;
  } finally {
    try { fs.unlinkSync(probe); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
}

function beforeRealpath(target: string, action: () => void) {
  let calls = 0;
  vi.spyOn(fs, "realpathSync").mockImplementation(((entry: fs.PathLike, options?: unknown) => {
    if (String(entry) === target) {
      calls += 1;
      action();
    }
    return originalRealpath(entry, options as fs.EncodingOption);
  }) as typeof fs.realpathSync);
  return () => calls;
}

describe("containment across cooperating filesystem changes", () => {
  it.each(["directory", "owner file"])("rechecks a %s removed after lstat", (kind) => {
    const lock = path.join(root, ".cartridge/index.lock");
    fs.mkdirSync(lock, { recursive: true });
    const target = kind === "directory" ? lock : path.join(lock, "owner-test.json");
    if (kind === "owner file") fs.writeFileSync(target, "{}");
    const stat = vi.spyOn(fs, "lstatSync");
    beforeRealpath(target, () => {
      if (kind === "directory") fs.rmdirSync(target);
      else fs.unlinkSync(target);
    });
    expect(assertPathInsideProject(root, target)).toBe(target);
    expect(stat.mock.calls.filter(([entry]) => String(entry) === target)).toHaveLength(2);
  });

  it("restarts from the original candidate when a resolved ancestor disappears", () => {
    const ancestor = path.join(root, "parent/child");
    const candidate = path.join(ancestor, "not-created/file.json");
    fs.mkdirSync(ancestor, { recursive: true });
    const stat = vi.spyOn(fs, "lstatSync");
    beforeRealpath(ancestor, () => {
      fs.rmdirSync(ancestor);
      fs.rmdirSync(path.join(root, "parent"));
    });
    expect(assertPathInsideProject(root, candidate)).toBe(candidate);
    const calls = stat.mock.calls.map(([entry]) => String(entry));
    expect(calls.filter(entry => entry === candidate)).toHaveLength(2);
    expect(calls.filter(entry => entry === path.join(root, "parent"))).toHaveLength(1);
  });

  it("rejects replacement by an outside symlink/junction", (context) => {
    requireDirectoryLinks(context);
    const target = path.join(root, "lock");
    fs.mkdirSync(target);
    beforeRealpath(target, () => {
      fs.rmdirSync(target);
      fs.symlinkSync(outside, target, directoryLinkType);
    });
    expect(() => assertPathInsideProject(root, target)).toThrow(PathContainmentError);
    expect(fs.lstatSync(target).isSymbolicLink()).toBe(true);
  });

  it("revalidates an outside symlink/junction introduced during the retry", (context) => {
    requireDirectoryLinks(context);
    const target = path.join(root, "lock");
    fs.mkdirSync(target);
    const originalLstat = fs.lstatSync;
    let removed = false;
    let replaced = false;
    vi.spyOn(fs, "lstatSync").mockImplementation(((entry: fs.PathLike, options?: unknown) => {
      if (String(entry) === target && removed && !replaced) {
        fs.symlinkSync(outside, target, directoryLinkType);
        replaced = true;
      }
      return originalLstat(entry, options as { bigint?: false });
    }) as typeof fs.lstatSync);
    beforeRealpath(target, () => {
      if (removed) return;
      fs.rmdirSync(target);
      removed = true;
    });
    expect(() => assertPathInsideProject(root, target)).toThrow(PathContainmentError);
    expect(replaced).toBe(true);
    expect(fs.lstatSync(target).isSymbolicLink()).toBe(true);
  });

  it("rejects a dangling symlink/junction introduced after lstat", (context) => {
    requireDirectoryLinks(context, true);
    const target = path.join(root, "lock");
    fs.mkdirSync(target);
    let replaced = false;
    const calls = beforeRealpath(target, () => {
      if (replaced) return;
      fs.rmdirSync(target);
      fs.symlinkSync(path.join(outside, "missing"), target, directoryLinkType);
      replaced = true;
    });
    expect(() => assertPathInsideProject(root, target)).toThrow(PathContainmentError);
    expect(calls()).toBe(3);
    expect(replaced).toBe(true);
    expect(fs.lstatSync(target).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(target)).toBe(false);
  });

  it("rejects a persistent dangling symlink/junction without treating it as absent", (context) => {
    requireDirectoryLinks(context, true);
    const target = path.join(root, "dangling");
    fs.symlinkSync(path.join(root, "missing"), target, directoryLinkType);
    expect(fs.lstatSync(target).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(target)).toBe(false);
    expect(() => assertPathInsideProject(root, target)).toThrow(PathContainmentError);
  });

  it("fails closed after bounded repeated ENOENT churn", () => {
    const target = path.join(root, "lock");
    fs.mkdirSync(target);
    const calls = beforeRealpath(target, () => {
      // The entry exists for every lstat but has disappeared by each realpath.
      const error = Object.assign(new Error("racing removal"), { code: "ENOENT" });
      throw error;
    });
    expect(() => assertPathInsideProject(root, target)).toThrow(PathContainmentError);
    expect(calls()).toBe(3);
  });

  it("does not retry non-ENOENT realpath failures", () => {
    const target = path.join(root, "lock");
    fs.mkdirSync(target);
    const calls = beforeRealpath(target, () => { throw Object.assign(new Error("permission denied"), { code: "EACCES" }); });
    expect(() => assertPathInsideProject(root, target)).toThrow(PathContainmentError);
    expect(calls()).toBe(1);
  });

  it("preserves supported in-project and project-root symlinks/junctions", (context) => {
    requireDirectoryLinks(context);
    const target = path.join(root, "real");
    const alias = path.join(root, "alias");
    const rootAlias = path.join(outside, "project");
    fs.mkdirSync(target);
    fs.symlinkSync(target, alias, directoryLinkType);
    fs.symlinkSync(root, rootAlias, directoryLinkType);
    expect(assertPathInsideProject(root, path.join(alias, "new.json"))).toBe(path.join(alias, "new.json"));
    expect(assertPathInsideProject(rootAlias, "real/new.json")).toBe(path.join(rootAlias, "real/new.json"));
  });
});
