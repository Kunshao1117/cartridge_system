import { stalenessToLevel } from "./mcp-handlers.js";

const STALENESS_SIGNIFICANT = 10;

export interface BriefCartridgeEntry {
  staleness?: number;
  pendingChanges?: unknown[];
  trackedFiles?: string[];
  ghostFiles?: string[];
  indirectStaleness?: number;
  dependencies?: string[];
  parent?: string | null;
}

export interface BriefIndex {
  cartridges?: Record<string, BriefCartridgeEntry>;
  untrackedFiles?: unknown[];
}

interface ProjectSummary {
  name: string;
  version: string;
  description: string;
}

type RecommendedAction = {
  priority: "P1" | "P2";
  action: string;
  target: string;
  reason: string;
};

function buildMemorySummary(index: BriefIndex) {
  const cartridges = Object.entries(index.cartridges ?? {});
  const byScore = <T extends { score: number }>(items: T[]) =>
    items.sort((a, b) => b.score - a.score);
  const staleModules = byScore(
    cartridges
      .filter(([, entry]) => (entry.staleness ?? 0) > 0)
      .map(([module, entry]) => {
        const score = entry.staleness ?? 0;
        return {
          module,
          score,
          staleness: score,
          level: stalenessToLevel(score),
          pendingChangesCount: entry.pendingChanges?.length ?? 0,
        };
      }),
  );
  const ghostModules = cartridges
    .filter(([, entry]) => (entry.ghostFiles?.length ?? 0) > 0)
    .map(([module, entry]) => ({
      module,
      ghostFilesCount: entry.ghostFiles?.length ?? 0,
    }));
  const indirectStaleModules = byScore(
    cartridges
      .filter(([, entry]) => (entry.indirectStaleness ?? 0) > 0)
      .map(([module, entry]) => ({
        module,
        score: entry.indirectStaleness ?? 0,
        indirectStaleness: entry.indirectStaleness ?? 0,
      })),
  );
  const dependencyEdges = cartridges.reduce(
    (sum, [, entry]) => sum + (entry.dependencies?.length ?? 0),
    0,
  );
  return {
    total: cartridges.length,
    stale: staleModules.length,
    staleModules,
    ghostFiles: ghostModules.reduce((sum, item) => sum + item.ghostFilesCount, 0),
    ghostModules,
    untrackedFiles: index.untrackedFiles?.length ?? 0,
    indirectStale: indirectStaleModules.length,
    indirectStaleModules,
    oversized: cartridges
      .filter(([, entry]) => (entry.trackedFiles?.length ?? 0) > 8)
      .map(([module, entry]) => ({
        module,
        trackedFilesCount: entry.trackedFiles?.length ?? 0,
      })),
    dependencies: {
      totalEdges: dependencyEdges,
    },
  };
}

function buildReadiness(memory: ReturnType<typeof buildMemorySummary>) {
  const reasons = [
    ...memory.staleModules.map((item) => `${item.module} staleness=${item.staleness}`),
    ...memory.ghostModules.map(
      (item) => `${item.module} ghostFiles=${item.ghostFilesCount}`,
    ),
  ];
  if (memory.untrackedFiles > 0) reasons.push(`untrackedFiles=${memory.untrackedFiles}`);
  if (memory.indirectStale > 0) reasons.push(`indirectStaleModules=${memory.indirectStale}`);
  return { status: reasons.length > 0 ? "blocked" : "ready", reasons };
}

function buildRecommendedActions(index: BriefIndex): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  for (const [module, entry] of Object.entries(index.cartridges ?? {})) {
    const staleness = entry.staleness ?? 0;
    if (staleness > 0) {
      actions.push({
        priority: staleness >= STALENESS_SIGNIFICANT ? "P1" : "P2",
        action: "repair_stale_memory",
        target: module,
        reason: `staleness=${staleness}`,
      });
    }
    const ghostCount = entry.ghostFiles?.length ?? 0;
    if (ghostCount > 0) {
      actions.push({
        priority: "P1",
        action: "clean_ghost_files",
        target: module,
        reason: `ghostFiles=${ghostCount}`,
      });
    }
  }
  const untrackedCount = index.untrackedFiles?.length ?? 0;
  if (untrackedCount > 0) {
    actions.push({
      priority: "P1",
      action: "attribute_untracked_files",
      target: "workspace",
      reason: `untrackedFiles=${untrackedCount}`,
    });
  }
  return actions.sort((a, b) => a.priority.localeCompare(b.priority));
}

export function buildWorkspaceBrief(project: ProjectSummary, index: BriefIndex) {
  const memory = buildMemorySummary(index);
  return {
    project,
    memory,
    readiness: buildReadiness(memory),
    recommendedActions: buildRecommendedActions(index),
  };
}
