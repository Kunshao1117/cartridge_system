import path from "node:path";

/** Shared identity for persistence, monitor lookup and renderer selection. */
export function canonicalProjectRoot(root: string, platform: NodeJS.Platform = process.platform): string {
  const resolved = platform === "win32" ? path.win32.resolve(root) : path.resolve(root);
  return platform === "win32" ? resolved.toLowerCase() : resolved;
}
