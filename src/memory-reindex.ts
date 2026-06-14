import { createConfig } from "./config.js";
import { GitignoreFilter } from "./gitignore-filter.js";
import { CartridgeIndexManager } from "./index-manager.js";
import { createVisibleCartridgeIndex } from "./visible-index.js";
import { validateProjectRoot } from "./path-guard.js";
import type { CartridgeConfig, CartridgeIndex } from "./types.js";
import type {
  MemoryContentQualityStatus,
  MemoryMainFileType,
} from "./memory-main-file.js";
import { listProjectFiles } from "./project-file-list.js";

export interface MemoryIndexSummary {
  cartridgeCount: number;
  untrackedFiles: number;
  ghostFiles: number;
  pendingChanges: number;
  migrationRequired: number;
  legacyCompatibility: number;
  mainFileTypes: Record<MemoryMainFileType, number>;
  contentQualityStatuses: Record<MemoryContentQualityStatus, number>;
  conflicts: Array<{
    module: string;
    candidates: string[];
  }>;
}

export interface MemoryReindexResult {
  index: CartridgeIndex;
  summary: MemoryIndexSummary;
}

export interface MemoryReindexOptions {
  projectRoot: string;
  config?: CartridgeConfig;
  indexManager?: CartridgeIndexManager;
  gitignoreFilter?: GitignoreFilter;
  detectMissedChanges?: boolean;
  includeProjectFiles?: boolean;
  clearUntrackedFiles?: boolean;
  persist?: boolean;
}

function emptyMainFileTypeCounts(): Record<MemoryMainFileType, number> {
  return {
    "MEMORY.md": 0,
    "legacy SKILL.md": 0,
    conflict: 0,
    missing: 0,
  };
}

function emptyQualityCounts(): Record<MemoryContentQualityStatus, number> {
  return {
    complete: 0,
    missing_fields: 0,
    missing_sections: 0,
    pending_review: 0,
    conflict: 0,
    superseded: 0,
  };
}

export function summarizeMemoryIndex(index: CartridgeIndex): MemoryIndexSummary {
  const visible = createVisibleCartridgeIndex(index);
  const mainFileTypes = emptyMainFileTypeCounts();
  const contentQualityStatuses = emptyQualityCounts();
  let migrationRequired = 0;
  let legacyCompatibility = 0;
  let ghostFiles = 0;
  let pendingChanges = 0;
  const conflicts: MemoryIndexSummary["conflicts"] = [];

  for (const [module, entry] of Object.entries(visible.cartridges ?? {})) {
    const mainFileType = entry.mainFile?.type ?? entry.mainFileType ?? "legacy SKILL.md";
    mainFileTypes[mainFileType] += 1;
    const qualityStatus =
      entry.contentQuality?.status ?? entry.contentQualityStatus ?? "pending_review";
    contentQualityStatuses[qualityStatus] += 1;
    if (entry.migrationRequired) migrationRequired += 1;
    if (entry.legacyCompatibility) legacyCompatibility += 1;
    ghostFiles += entry.ghostFiles?.length ?? 0;
    pendingChanges += entry.pendingChanges?.length ?? 0;
    if (mainFileType === "conflict") {
      conflicts.push({
        module,
        candidates: entry.mainFile?.candidatePaths ?? [],
      });
    }
  }

  return {
    cartridgeCount: Object.keys(visible.cartridges ?? {}).length,
    untrackedFiles: visible.untrackedFiles?.length ?? 0,
    ghostFiles,
    pendingChanges,
    migrationRequired,
    legacyCompatibility,
    mainFileTypes,
    contentQualityStatuses,
    conflicts,
  };
}

export async function refreshMemoryIndex(
  options: MemoryReindexOptions,
): Promise<MemoryReindexResult> {
  const projectRoot = validateProjectRoot(options.projectRoot);
  const config = options.config ?? createConfig(projectRoot);
  const indexManager =
    options.indexManager ?? new CartridgeIndexManager(config);
  const gitignoreFilter =
    options.gitignoreFilter ?? new GitignoreFilter(projectRoot);

  gitignoreFilter.reload();
  if (options.clearUntrackedFiles) {
    indexManager.clearUntrackedFiles();
  }
  await indexManager.scan();
  if (options.detectMissedChanges ?? true) {
    indexManager.detectMissedChanges(config.scoring);
  }
  if (options.includeProjectFiles ?? true) {
    const files = await listProjectFiles(projectRoot);
    indexManager.detectUntrackedFiles(files, gitignoreFilter);
  }
  indexManager.validateTrackedFiles();
  indexManager.refilterUntrackedFiles(gitignoreFilter);
  indexManager.markDirty();
  if (options.persist ?? true) {
    await indexManager.flushIfDirty();
  }

  return {
    index: indexManager.getVisibleIndex(),
    summary: summarizeMemoryIndex(indexManager.getVisibleIndex()),
  };
}
