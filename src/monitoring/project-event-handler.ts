import path from "node:path";
import fs from "node:fs";
import { assertPathInsideProject } from "../file-containment.js";
import type { CartridgeConfig, FileEventType } from "../types.js";
import { memoryContentFingerprint, type CartridgeIndexManager } from "../index-manager.js";
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
    const updated = await handleProjectSkillFileChange({ ...args, relPath });
    return { updated, refresh: updated };
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
    // Watch notifications can arrive late or in a different order in another
    // process. Reconcile their kind with the current filesystem state.
    const exists = fs.existsSync(assertPathInsideProject(args.config.projectRoot, args.absFilePath));
    const currentType = !exists ? "unlink" : args.eventType === "unlink" ? "change" : args.eventType;
    const updated = await args.analyzer.processFileEvent(relPath, currentType);
    if (currentType === "unlink") {
      for (const cartridgeId of affected) {
        args.indexManager.markGhostFile(cartridgeId, relPath);
      }
      args.indexManager.markDirty();
    }
    if (updated) {
      for (const id of affected) {
        args.indexManager.reconcileTrackedState(id);
        await args.analyzer.refreshWarnings(id);
      }
      args.indexManager.buildAndMergeDependencies();
      args.indexManager.markDirty();
    }
    return { updated, refresh: false };
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
): Promise<boolean> {
  const normalizedRelPath = args.relPath.replace(/\\/g, "/");
  const cartridgeEntry = Object.entries(args.indexManager.getIndex().cartridges)
    .find(([, entry]) => (entry.mainFile?.activePath ?? entry.skillPath).replace(/\\/g, "/") === normalizedRelPath);
  let fingerprint: string | undefined;
  try {
    fingerprint = memoryContentFingerprint(fs.readFileSync(
      assertPathInsideProject(args.config.projectRoot, normalizedRelPath), "utf8",
    ));
  } catch {
    // Missing/invalid cards still need a scan that exposes the diagnostic.
  }
  if (cartridgeEntry && fingerprint !== undefined &&
      fingerprint === cartridgeEntry[1].memoryContentFingerprint) {
    // A warning/status self-write is recognizable from durable content, even in
    // a second process that never performed the write. Idempotent warning repair
    // also handles an externally removed warning without a self-write loop.
    await args.analyzer.refreshWarnings(cartridgeEntry[0]);
    return false;
  }

  await args.indexManager.scan({ deriveDependencies: false });
  const changedEntry = Object.entries(args.indexManager.getIndex().cartridges)
    .find(([id, entry]) => id === cartridgeEntry?.[0] ||
      (entry.mainFile?.activePath ?? entry.skillPath).replace(/\\/g, "/") === normalizedRelPath);
  if (changedEntry) args.indexManager.reconcileTrackedState(changedEntry[0]);
  args.indexManager.buildAndMergeDependencies();
  if (changedEntry) await args.analyzer.refreshWarnings(changedEntry[0]);
  await refreshProjectUntrackedFiles({
    projectRoot: args.config.projectRoot,
    indexManager: args.indexManager,
    gitignoreFilter: args.gitignoreFilter,
  });
  args.indexManager.markDirty();
  return true;
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
