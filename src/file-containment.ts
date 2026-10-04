import fs from "node:fs";
import path from "node:path";

export class PathContainmentError extends Error {
  constructor(candidate: string) {
    super(`Path is outside the project boundary or cannot be verified: ${candidate}`);
    this.name = "PathContainmentError";
  }
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

/** Canonicalize even a not-yet-created leaf without following dangling links. */
function physicalPath(candidate: string): string {
  let current = candidate;
  const tail: string[] = [];
  for (;;) {
    try {
      fs.lstatSync(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      tail.unshift(path.basename(current));
      current = parent;
      continue;
    }
    // lstat succeeded: a dangling symlink must fail here, not be treated as a
    // missing leaf whose parent would otherwise pass the containment check.
    return path.resolve(fs.realpathSync(current), ...tail);
  }
}

/**
 * Resolve an untrusted path at the I/O boundary. Arbitrary in-project configured
 * roots are allowed. Both lexical and physical containment must hold; a trusted
 * project root may itself be a symlink. Recheck before each read/write/open.
 * This is not a filesystem sandbox against concurrent hostile link replacement.
 */
export function assertPathInsideProject(projectRoot: string, candidate: string): string {
  if (typeof candidate !== "string" || !candidate || candidate.includes("\0")) {
    throw new PathContainmentError(String(candidate));
  }
  const normalized = candidate.replace(/\\/g, "/");
  // Reject foreign drive/UNC paths, drive-relative paths, ADS and device paths.
  if (process.platform !== "win32" && (/^[a-z]:/i.test(normalized) || normalized.startsWith("//"))) {
    throw new PathContainmentError(candidate);
  }
  if (process.platform === "win32" && (
    /^[a-z]:(?!\/)/i.test(normalized) ||
    /^\/[^/]/.test(normalized) ||
    /^\/\/[?.]\//.test(normalized) ||
    normalized.replace(/^[a-z]:/i, "").includes(":")
  )) throw new PathContainmentError(candidate);
  const root = path.resolve(projectRoot);
  const resolved = path.resolve(root, normalized);
  if (!isInside(root, resolved)) throw new PathContainmentError(candidate);
  try {
    if (!isInside(physicalPath(root), physicalPath(resolved))) {
      throw new PathContainmentError(candidate);
    }
  } catch (error) {
    if (error instanceof PathContainmentError) throw error;
    throw new PathContainmentError(candidate);
  }
  return resolved;
}

export function tryProjectPath(projectRoot: string, candidate: string): string | null {
  try { return assertPathInsideProject(projectRoot, candidate); } catch { return null; }
}
