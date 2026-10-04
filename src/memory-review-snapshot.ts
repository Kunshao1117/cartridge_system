import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { assertPathInsideProject, PathContainmentError } from "./file-containment.js";
import { assertMemoryCardPath } from "./memory-card-path.js";
import type { CartridgeConfig } from "./types.js";

export class MemoryReviewConflictError extends Error {
  constructor() {
    super("MEMORY_REVIEW_CONFLICT: card, source, or pending revision changed during this commit; review the latest state before retrying.");
    this.name = "MemoryReviewConflictError";
  }
}

export async function sourceRevision(projectRoot: string, trackedFiles: string[]): Promise<string> {
  const states: Array<[string, string]> = [];
  for (const source of [...new Set(trackedFiles)].sort()) {
    try {
      const target = assertPathInsideProject(projectRoot, source);
      const stat = await fsp.stat(target);
      // Directory declarations are grouping hints in the existing contract,
      // not recursive source ownership. Preserve their type/existence without
      // reading a directory as a file or pretending to review its descendants.
      if (stat.isDirectory() && source.endsWith("/")) {
        states.push([source, "directory"]);
        continue;
      }
      const bytes = await fsp.readFile(target);
      states.push([source, createHash("sha256").update(bytes).digest("hex")]);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "ENOTDIR") states.push([source, "missing"]);
      else if (error instanceof PathContainmentError) states.push([source, "unsafe"]);
      else throw error; // Permission/I/O failures are not evidence that a source was reviewed.
    }
  }
  return JSON.stringify(states);
}

/** Called only while the caller owns the project transaction. Temporary writes
 * preserve the original card on failure. The last comparison and replacement
 * have no async gap in this process. An uncooperative external process can still
 * race a filesystem compare/rename; this is not an OS-wide compare-and-swap. */
export async function replaceReviewedCard(
  config: CartridgeConfig,
  filePath: string,
  original: string,
  replacement: string,
  revalidate: () => Promise<void>,
): Promise<void> {
  const target = assertMemoryCardPath(config, filePath);
  const mode = fs.statSync(target).mode;
  const temporary = path.join(path.dirname(target), `.cartridge-review-${randomUUID()}.tmp`);
  let handle: Awaited<ReturnType<typeof fsp.open>> | undefined;
  let replaced = false;
  try {
    handle = await fsp.open(assertPathInsideProject(config.projectRoot, temporary), "wx", mode);
    await handle.chmod(mode & 0o777); // Preserve target mode despite the process umask.
    await handle.writeFile(replacement, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await revalidate();
    const checked = assertMemoryCardPath(config, target);
    if (fs.readFileSync(checked, "utf8") !== original) throw new MemoryReviewConflictError();
    fs.renameSync(assertPathInsideProject(config.projectRoot, temporary), checked);
    replaced = true;
  } finally {
    if (handle) await handle.close();
    if (!replaced) {
      try { await fsp.unlink(assertPathInsideProject(config.projectRoot, temporary)); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
  }
}
