import { assertPathInsideProject } from "../file-containment.js";
import path from "node:path";

function canonicalPath(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

export function isKnownProjectRoot(root: string, knownRoots: string[]): boolean {
  const candidate = canonicalPath(root);
  return knownRoots.some((knownRoot) => canonicalPath(knownRoot) === candidate);
}

export function resolveProjectFilePath(
  projectRoot: string,
  relativePath: string,
): string | null {
  if (path.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath)) return null;
  try {
    const target = assertPathInsideProject(projectRoot, relativePath);
    return target === path.resolve(projectRoot) ? null : target;
  } catch {
    return null;
  }
}
