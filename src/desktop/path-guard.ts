import { assertPathInsideProject } from "../file-containment.js";
import path from "node:path";
import { canonicalProjectRoot } from "../monitoring/project-identity.js";


export function isKnownProjectRoot(root: string, knownRoots: string[]): boolean {
  const candidate = canonicalProjectRoot(root);
  return knownRoots.some((knownRoot) => canonicalProjectRoot(knownRoot) === candidate);
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
