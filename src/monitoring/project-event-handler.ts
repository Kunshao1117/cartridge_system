import path from "node:path";
import type { CartridgeConfig, FileEventType } from "../types.js";
import type { CartridgeIndexManager } from "../index-manager.js";
import { isManagedMemoryArtifactPath } from "../visible-index.js";
import type { StalenessAnalyzer } from "../analyzer.js";
import type { GitignoreFilter } from "../gitignore-filter.js";
import type { MemoryWriter } from "../writer.js";
import { isActiveMemoryMainFilePath } from "../memory-main-file.js";
import {
  refreshProjectUntrackedFiles,
} from "../memory-reindex.js";
import {
  ProjectIndexInvalidError,
  ProjectIndexMissingError,
  runProjectIndexTransaction,
} from "../project-index-transaction.js";

export interface ProjectEventHandlerDeps {
  config: CartridgeConfig;
  indexManager: CartridgeIndexManager;
  analyzer: StalenessAnalyzer;
  gitignoreFilter: GitignoreFilter;
  writer: MemoryWriter;
  onUpdate?: () => void;
  onRefresh?: () => void;
}

export interface ProjectFileEvent extends ProjectEventHandlerDeps {
  absFilePath: string;
  eventType: FileEventType;
}

export async function handleProjectFileEvent(
  args: ProjectFileEvent,
): Promise<void> {
  try {
    const transaction = await runProjectIndexTransaction({
      projectRoot: args.config.projectRoot,
      indexManager: args.indexManager,
      mutation: () => handleProjectFileEventUnlocked(args),
    });
    if (transaction.value.refresh) args.onRefresh?.();
    if (transaction.value.updated) args.onUpdate?.();
  } catch (error) {
    if (
      error instanceof ProjectIndexInvalidError ||
      error instanceof ProjectIndexMissingError
    ) {
      args.indexManager.notifyCommittedChange();
      args.onUpdate?.();
      return;
    }
    throw error;
  }
}

async function handleProjectFileEventUnlocked(
  args: ProjectFileEvent,
): Promise<{ updated: boolean; refresh: boolean }> {
  const relPath = path
    .relative(args.config.projectRoot, args.absFilePath)
    .replace(/\\/g, "/");

  if (args.config.ignoreFiles.some((file) => relPath.endsWith(file))) {
    return { updated: false, refresh: false };
  }

  if (isMemorySkillPath(relPath)) {
    await handleProjectSkillFileChange({ ...args, relPath });
    return { updated: true, refresh: true };
  }

  if (isManagedMemoryArtifactPath(relPath)) {
    return { updated: false, refresh: false };
  }

  if (isGitExclusionControlPath(relPath)) {
    await refreshProjectUntrackedFiles({
      projectRoot: args.config.projectRoot,
      indexManager: args.indexManager,
      gitignoreFilter: args.gitignoreFilter,
    });
    return { updated: true, refresh: false };
  }

  if (args.config.excludeDirs.some((dir) => relPath.startsWith(dir))) {
    return { updated: false, refresh: false };
  }

  if (
    relPath.startsWith(".agents/") &&
    !relPath.includes(".agents/memory/") &&
    !relPath.includes(".agents/skills/mem-")
  ) {
    return { updated: false, refresh: false };
  }

  const ignoreDecision = await args.gitignoreFilter.checkIgnored(relPath);
  if (ignoreDecision.ignored) {
    if (args.indexManager.removeUntrackedFile(relPath)) {
      args.indexManager.markDirty();
      return { updated: true, refresh: false };
    }
    return { updated: false, refresh: false };
  }

  const affected = args.indexManager.getAffectedCartridges(relPath);
  if (affected.length > 0) {
    await args.analyzer.processFileEvent(relPath, args.eventType);
    if (args.eventType === "unlink") {
      for (const cartridgeId of affected) {
        args.indexManager.markGhostFile(cartridgeId, relPath);
      }
      args.indexManager.markDirty();
    }
    return { updated: true, refresh: false };
  }

  if (args.eventType === "unlink") {
    if (!args.indexManager.removeUntrackedFile(relPath)) {
      return { updated: false, refresh: false };
    }
  } else {
    args.indexManager.addUntrackedFile(relPath, args.eventType);
  }
  args.indexManager.markDirty();
  return { updated: true, refresh: false };
}

async function handleProjectSkillFileChange(
  args: ProjectFileEvent & { relPath: string },
): Promise<void> {
  const normalizedRelPath = args.relPath.replace(/\\/g, "/");
  const cartridgeEntry = Object.entries(
    args.indexManager.getIndex().cartridges,
  ).find(([, entry]) => entry.skillPath.replace(/\\/g, "/") === normalizedRelPath);

  if (cartridgeEntry) {
    args.indexManager.clearPendingChanges(cartridgeEntry[0]);
    args.indexManager.clearGhostFiles(cartridgeEntry[0]);
  }

  await args.writer.checkAndCleanWarning(args.relPath);
  await args.indexManager.scan();
  await refreshProjectUntrackedFiles({
    projectRoot: args.config.projectRoot,
    indexManager: args.indexManager,
    gitignoreFilter: args.gitignoreFilter,
  });
  args.indexManager.markDirty();
}

export function isMemorySkillPath(relPath: string): boolean {
  return isActiveMemoryMainFilePath(relPath);
}

export function isGitExclusionControlPath(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, "/").toLowerCase();
  return (
    normalized === ".gitignore" ||
    normalized.endsWith("/.gitignore") ||
    normalized === ".git/info/exclude" ||
    normalized === ".git/index" ||
    normalized === ".git/config"
  );
}
