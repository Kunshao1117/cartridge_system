import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listProjectFiles } from "../project-file-list.js";

const tempRoots: string[] = [];

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

  it("does not follow directory symlinks during fallback traversal", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-files-"));
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-outside-"));
    tempRoots.push(root, outside);
    await fs.writeFile(path.join(outside, "outside.txt"), "outside");
    try {
      await fs.symlink(outside, path.join(root, "linked"), "junction");
    } catch {
      return;
    }

    await expect(listProjectFiles(root)).resolves.toEqual([]);
  });
});
