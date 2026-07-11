import { createConfig } from "./config.js";
import {
  GitignoreFilter,
  type GitExclusionDiagnostic,
  type GitExclusionMode,
  type ProjectFileDiscoveryResult,
} from "./gitignore-filter.js";
import { CartridgeIndexManager } from "./index-manager.js";
import { createVisibleCartridgeIndex } from "./visible-index.js";
import { validateProjectRoot } from "./path-guard.js";
import type { CartridgeConfig, CartridgeIndex } from "./types.js";
import type {
  MemoryContentQualityStatus,
  MemoryMainFileType,
} from "./memory-main-file.js";
import {
  runProjectIndexTransaction,
} from "./project-index-transaction.js";

export { serializeProjectIndexMutation } from "./project-index-transaction.js";

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
  exclusionMode: GitExclusionMode | null;
  exclusionDiagnostics: GitExclusionDiagnostic[];
  indexDiagnostics?: Array<{
    code: "index_repaired";
    message: string;
  }>;
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

export interface ProjectUntrackedRefreshOptions {
  projectRoot: string;
  indexManager: CartridgeIndexManager;
  gitignoreFilter: GitignoreFilter;
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

/**
 * 取得 canonical project file set，並以它 authoritative 地收斂未歸屬池。
 * Desktop、VS Code 與 MCP 都必須使用此入口，避免各自產生不同候選集合。
 */
export async function refreshProjectUntrackedFiles(
  options: ProjectUntrackedRefreshOptions,
): Promise<ProjectFileDiscoveryResult> {
  const transaction = await runProjectIndexTransaction({
    projectRoot: validateProjectRoot(options.projectRoot),
    indexManager: options.indexManager,
    mutation: async () => {
      options.gitignoreFilter.reload();
      const discovery = await options.gitignoreFilter.discoverProjectFiles();
      options.indexManager.reconcileUntrackedFiles(discovery.files);
      return discovery;
    },
  });
  return transaction.value;
}

export async function refreshMemoryIndex(
  options: MemoryReindexOptions,
): Promise<MemoryReindexResult> {
  const projectRoot = validateProjectRoot(options.projectRoot);
  const config = options.config ?? createConfig(projectRoot);
  const indexManager =
    options.indexManager ?? new CartridgeIndexManager(config);
  const includeProjectFiles = options.includeProjectFiles ?? true;
  const persist = options.persist ?? true;
  const transaction = await runProjectIndexTransaction({
    projectRoot,
    indexManager,
    allowInvalidRepair: includeProjectFiles && persist,
    persist,
    mutation: () =>
      refreshMemoryIndexUnlocked({
        ...options,
        projectRoot,
        config,
        indexManager,
        includeProjectFiles,
        persist,
      }),
  });
  return {
    ...transaction.value,
    indexDiagnostics: transaction.repairedInvalidIndex
      ? [
          {
            code: "index_repaired",
            message:
              "The invalid canonical project index was repaired by an authoritative full reindex.",
          },
        ]
      : [],
  };
}

async function refreshMemoryIndexUnlocked(
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
  let discovery: ProjectFileDiscoveryResult | null = null;
  if (options.includeProjectFiles ?? true) {
    discovery = await refreshProjectUntrackedFiles({
      projectRoot,
      indexManager,
      gitignoreFilter,
    });
  }
  indexManager.validateTrackedFiles();
  indexManager.markDirty();

  return {
    index: indexManager.getVisibleIndex(),
    summary: summarizeMemoryIndex(indexManager.getVisibleIndex()),
    exclusionMode: discovery?.mode ?? null,
    exclusionDiagnostics: discovery?.diagnostics ?? [],
  };
}
