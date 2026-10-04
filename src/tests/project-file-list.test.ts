import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { listProjectFiles } from "../project-file-list.js";

const tempRoots: string[] = [];

async function createDirectoryLink(
  target: string,
  link: string,
  skip: (reason: string) => never,
  createLink = fs.symlink,
  platform: NodeJS.Platform = process.platform,
): Promise<void> {
  try {
    await createLink(target, link, "junction");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    const unsupported = ["ENOSYS", "ENOTSUP", "EOPNOTSUPP"].includes(code ?? "") ||
      (platform === "win32" && code === "EPERM");
    if (unsupported) {
      skip(`Directory symlink fixture unavailable on ${platform}: ${code}`);
    }
    throw error;
  }
}

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => fs.rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("listProjectFiles", () => {
  it("lists project files while skipping generated and index directories", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-files-"));
    tempRoots.push(root);
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.mkdir(path.join(root, "dist"), { recursive: true });
    await fs.mkdir(path.join(root, ".cartridge"), { recursive: true });
    await fs.writeFile(path.join(root, "src", "index.ts"), "export {};\n");
    await fs.writeFile(path.join(root, "dist", "index.js"), "");
    await fs.writeFile(path.join(root, ".cartridge", "index.json"), "{}");

    await expect(listProjectFiles(root)).resolves.toEqual(["src/index.ts"]);
  });

  it("does not follow directory symlinks during fallback traversal", async ({ skip }) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-files-"));
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-outside-"));
    tempRoots.push(root, outside);
    await fs.writeFile(path.join(outside, "outside.txt"), "outside");
    await createDirectoryLink(outside, path.join(root, "linked"), skip);
    expect.assertions(1);

    await expect(listProjectFiles(root)).resolves.toEqual([]);
  });
});


describe("directory symlink fixture reporting", () => {
  it.each(["ENOSYS", "ENOTSUP", "EOPNOTSUPP"])("explicitly skips unsupported %s with a reason", async (code) => {
    const skipped = new Error("test skipped");
    const skip = vi.fn((_reason: string): never => { throw skipped; });
    const createLink = vi.fn<typeof fs.symlink>().mockRejectedValue(Object.assign(new Error(code), { code }));
    await expect(createDirectoryLink("target", "link", skip, createLink, "linux")).rejects.toBe(skipped);
    expect(skip).toHaveBeenCalledWith(`Directory symlink fixture unavailable on linux: ${code}`);
  });

  it("only treats EPERM as a Windows capability restriction", async () => {
    const failure = Object.assign(new Error("privilege unavailable"), { code: "EPERM" });
    const skipped = new Error("test skipped");
    const skip = vi.fn((_reason: string): never => { throw skipped; });
    const createLink = vi.fn<typeof fs.symlink>().mockRejectedValue(failure);
    await expect(createDirectoryLink("target", "link", skip, createLink, "win32")).rejects.toBe(skipped);
    expect(skip).toHaveBeenCalledWith("Directory symlink fixture unavailable on win32: EPERM");
    skip.mockClear();
    await expect(createDirectoryLink("target", "link", skip, createLink, "linux")).rejects.toBe(failure);
    expect(skip).not.toHaveBeenCalled();
  });

  it.each(["EIO", "EACCES", "ENOENT", "EEXIST", undefined])("fails unexpected fixture errors (%s)", async (code) => {
    const failure = Object.assign(new Error("unexpected setup failure"), { code });
    const skip = vi.fn((_reason: string): never => { throw new Error("must not skip"); });
    const createLink = vi.fn<typeof fs.symlink>().mockRejectedValue(failure);
    await expect(createDirectoryLink("target", "link", skip, createLink)).rejects.toBe(failure);
    expect(skip).not.toHaveBeenCalled();
  });
});
