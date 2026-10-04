/** Runtime index/lock generations are never source changes or untracked files. */
export function isProjectIndexArtifactPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
  return normalized === ".cartridge/index.json" ||
    normalized === ".cartridge/index.lock" ||
    normalized.startsWith(".cartridge/index.lock/") ||
    normalized.startsWith(".cartridge/index.lock.stale-") ||
    normalized.startsWith(".cartridge/index.lock.candidate-") ||
    /^\.cartridge\/index\.\d+\.[0-9a-f-]+\.tmp$/i.test(normalized);
}
