import path from "node:path";

function canonicalPath(value: string): string {
  return path.resolve(value).toLowerCase();
}

export function isKnownProjectRoot(root: string, knownRoots: string[]): boolean {
  const candidate = canonicalPath(root);
  return knownRoots.some((knownRoot) => canonicalPath(knownRoot) === candidate);
}

export function resolveProjectFilePath(
  projectRoot: string,
  relativePath: string,
): string | null {
  if (path.isAbsolute(relativePath)) return null;

  const root = path.resolve(projectRoot);
  const target = path.resolve(root, relativePath);
  const rel = path.relative(root, target);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return target;
}
