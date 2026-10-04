import path from "node:path";

/** One lexical identity for card paths, watcher events and durable source state.
 * This does not authorize a path: filesystem callers must still check containment.
 */
export function canonicalTrackedPath(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  if (!normalized) return "";
  // Preserve suspicious syntax for existing validation/containment diagnostics.
  // In particular do not collapse traversal or UNC into an apparently safe key.
  if (/^(?:\/|[a-z]:)/i.test(normalized) || normalized.split("/").includes("..")) return normalized;
  return path.posix.normalize(normalized);
}

/** Exclusions name root-relative directories, never similarly prefixed files. */
export function isExcludedDirectoryPath(filePath: string, directories: readonly string[]): boolean {
  const candidate = canonicalTrackedPath(filePath).replace(/\/$/, "");
  return directories.some((directory) => {
    const normalized = canonicalTrackedPath(directory).replace(/\/$/, "");
    return normalized.length > 0 && (candidate === normalized || candidate.startsWith(`${normalized}/`));
  });
}
