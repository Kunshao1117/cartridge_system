import type { CartridgeIndex } from "./types.js";

/**
 * Memory governance artifacts are owned by memory audit, not by product file
 * attribution. Keep this helper outside index-manager to avoid dependency loops.
 */
export function isManagedMemoryArtifactPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  return (
    normalized.startsWith(".agents/memory/") ||
    normalized.startsWith(".agents/skills/mem-")
  );
}

export function filterVisibleUntrackedFiles<T>(
  untrackedFiles: readonly T[] | undefined,
): T[] {
  return (untrackedFiles ?? []).filter((entry) => {
    const filePath =
      typeof entry === "object" &&
      entry !== null &&
      "filePath" in entry &&
      typeof (entry as { filePath?: unknown }).filePath === "string"
        ? (entry as { filePath: string }).filePath
        : "";
    return !filePath || !isManagedMemoryArtifactPath(filePath);
  });
}

export function createVisibleCartridgeIndex(
  index: CartridgeIndex,
): CartridgeIndex {
  return {
    ...index,
    untrackedFiles: filterVisibleUntrackedFiles(index.untrackedFiles),
  };
}
