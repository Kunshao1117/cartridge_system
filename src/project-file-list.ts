import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";

const DEFAULT_SKIP_DIRS = new Set([
  ".git",
  ".cartridge",
  "node_modules",
  "dist",
  ".next",
  ".turbo",
  "coverage",
]);

export async function listProjectFiles(projectRoot: string): Promise<string[]> {
  const files: string[] = [];
  await walk(projectRoot, projectRoot, files);
  return files.sort();
}

async function walk(
  projectRoot: string,
  currentDir: string,
  files: string[],
): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absPath = path.join(currentDir, entry.name);
    const relPath = path.relative(projectRoot, absPath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      if (DEFAULT_SKIP_DIRS.has(entry.name)) continue;
      await walk(projectRoot, absPath, files);
      continue;
    }

    if (entry.isFile()) {
      files.push(relPath);
    }
  }
}
