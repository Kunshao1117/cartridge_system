import path from "node:path";
import type { CartridgeConfig, FileEventType } from "../types.js";
import type { CartridgeIndexManager } from "../index-manager.js";
import { isManagedMemoryArtifactPath } from "../index-manager.js";
import type { StalenessAnalyzer } from "../analyzer.js";
import type { GitignoreFilter } from "../gitignore-filter.js";
import type { MemoryWriter } from "../writer.js";

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
  const relPath = path
    .relative(args.config.projectRoot, args.absFilePath)
    .replace(/\\/g, "/");

  if (args.config.ignoreFiles.some((file) => relPath.endsWith(file))) {
    return;
  }

  if (isMemorySkillPath(relPath)) {
    await handleProjectSkillFileChange({ ...args, relPath });
    return;
  }

  if (isManagedMemoryArtifactPath(relPath)) {
    return;
  }

  if (
    args.config.excludeDirs.some((dir) => relPath.startsWith(dir)) ||
    args.gitignoreFilter.isIgnored(relPath)
  ) {
    return;
  }

  if (
    relPath.startsWith(".agents/") &&
    !relPath.includes(".agents/memory/") &&
    !relPath.includes(".agents/skills/mem-")
  ) {
    return;
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
    args.onUpdate?.();
    return;
  }

  if (relPath === ".gitignore" && args.eventType === "change") {
    args.gitignoreFilter.reload();
    args.indexManager.refilterUntrackedFiles(args.gitignoreFilter);
    args.indexManager.markDirty();
    args.onUpdate?.();
    return;
  }

  if (args.eventType === "unlink") {
    args.indexManager.removeUntrackedFile(relPath);
  } else {
    args.indexManager.addUntrackedFile(relPath, args.eventType);
  }
  args.indexManager.markDirty();
  args.onUpdate?.();
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
  args.indexManager.refilterUntrackedFiles(args.gitignoreFilter);
  args.indexManager.markDirty();
  await args.indexManager.flushIfDirty();
  args.onRefresh?.();
  args.onUpdate?.();
}

export function isMemorySkillPath(relPath: string): boolean {
  return (
    (relPath.includes(".agents/memory/") ||
      relPath.includes(".agents/skills/mem-")) &&
    relPath.endsWith("SKILL.md")
  );
}
