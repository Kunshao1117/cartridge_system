import {
  buildCompatibilityReport,
  type CompatibilityReport,
} from "./memory-compatibility.js";
import {
  classifyMemoryWarnings,
  type MemoryWarningClassification,
  type MemoryWarningItem,
} from "./staleness.js";
import type { MemoryCompactionMetrics } from "./memory-compaction.js";

export interface PreflightCartridgeEntry {
  skillPath?: string;
  staleness?: number;
  ghostFiles?: unknown[];
  indirectStaleness?: number;
  trackedFiles?: string[];
  parent?: string | null;
  dependencies?: string[];
  compaction?: MemoryCompactionMetrics;
}

export interface PreflightIndex {
  cartridges?: Record<string, PreflightCartridgeEntry>;
  fileMap?: Record<string, string[]>;
  untrackedFiles?: unknown[];
}

export interface GitStatusEntry {
  raw: string;
  index: string;
  workingTree: string;
  path: string;
  category: "tracked" | "untracked";
}

type Blocker = {
  type:
    | "memory_stale"
    | "memory_ghost_files"
    | "memory_untracked_files"
    | "memory_compaction_due"
    | "memory_compaction_invalid"
    | "memory_archive_volume_due"
    | "memory_compatibility"
    | "git_dirty";
  target: string;
  reason: string;
};

type RecommendedAction = {
  priority: "P1" | "P2";
  action: string;
  target: string;
  reason: string;
};

export interface DependencySemanticSummaryItem {
  module: string;
  codes: string[];
}

export interface DependencySemanticSummary {
  warnings: number;
  modules: DependencySemanticSummaryItem[];
}

type PreflightReadiness = {
  status: "ready" | "warning" | "blocked";
  blockingReasons: string[];
  warningReasons: string[];
};

export function parseGitStatusPorcelain(output: string): GitStatusEntry[] {
  return output
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const rawPath = line.slice(3);
      const path = rawPath.includes(" -> ")
        ? rawPath.split(" -> ").at(-1) ?? rawPath
        : rawPath;
      return {
        raw: line,
        index: line[0] ?? " ",
        workingTree: line[1] ?? " ",
        path,
        category: line.startsWith("??") ? "untracked" : "tracked",
      };
    });
}

function buildMemoryGate(index: PreflightIndex) {
  const entries = Object.entries(index.cartridges ?? {});
  const classification = classifyMemoryWarnings(index);
  const staleModules = entries
    .filter(([, entry]) => (entry.staleness ?? 0) > 0)
    .map(([module, entry]) => ({
      module,
      staleness: entry.staleness ?? 0,
    }));
  const ghostModules = entries
    .filter(([, entry]) => (entry.ghostFiles?.length ?? 0) > 0)
    .map(([module, entry]) => ({
      module,
      ghostFiles: entry.ghostFiles?.length ?? 0,
    }));
  const indirectStaleModules = entries
    .filter(([, entry]) => (entry.indirectStaleness ?? 0) > 0)
    .map(([module, entry]) => ({
      module,
      indirectStaleness: entry.indirectStaleness ?? 0,
    }));
  const untrackedFiles = index.untrackedFiles?.length ?? 0;
  const compactionModules = entries
    .filter(([, entry]) => entry.compaction?.needsCompaction)
    .map(([module, entry]) => ({
      module,
      reasons: entry.compaction?.reasons ?? [],
      cycleEventCount: entry.compaction?.cycleEventCount ?? 0,
      sizeBytes: entry.compaction?.sizeBytes ?? 0,
      lineCount: entry.compaction?.lineCount ?? 0,
      compliance: entry.compaction?.compliance ?? "ok",
    }));
  const splitSuggestions = entries
    .filter(([, entry]) => (entry.trackedFiles?.length ?? 0) > 8)
    .map(([module, entry]) => ({
      module,
      trackedFilesCount: entry.trackedFiles?.length ?? 0,
      blocking: false,
    }));
  const archiveVolumeDue = entries.reduce(
    (sum, [, entry]) =>
      sum +
      (entry.compaction?.archiveVolumes?.filter((volume) => volume.needsCompaction)
        .length ?? 0),
    0,
  );
  const legacyCards = entries.filter(([, entry]) => entry.compaction?.isLegacy)
    .length;
  const languageWarnings = entries.filter(([, entry]) =>
    entry.compaction?.reasons.includes("highChineseRatio"),
  ).length;
  const blockers: Blocker[] = classification.blocking.map((item) => ({
    type: item.code as Blocker["type"],
    target: item.target,
    reason: item.reason,
  }));
  return {
    summary: {
      stale: staleModules.length,
      ghostFiles: ghostModules.reduce((sum, item) => sum + item.ghostFiles, 0),
      untrackedFiles,
      indirectStale: indirectStaleModules.length,
      compactionDue: compactionModules.length,
      compactionModules,
      archiveVolumeDue,
      splitSuggestions,
      granularityAdvisories: splitSuggestions.length,
      legacyCards,
      languageWarnings,
    },
    blockers,
    reviewItems: classification.review,
    advisories: [
      ...classification.review,
      ...classification.advisory,
      ...classification.info,
    ],
  };
}

function buildGitGate(entries: GitStatusEntry[]) {
  const tracked = entries.filter((entry) => entry.category === "tracked");
  const untracked = entries.filter((entry) => entry.category === "untracked");
  const staged = tracked.filter((entry) => entry.index !== " ");
  const unstaged = tracked.filter((entry) => entry.workingTree !== " ");
  const blockers: Blocker[] = entries.length
    ? [
        {
          type: "git_dirty",
          target: "workspace",
          reason: `dirtyFiles=${entries.length}`,
        },
      ]
    : [];
  return {
    summary: {
      dirty: entries.length > 0,
      modified: tracked.length,
      untracked: untracked.length,
      staged: staged.length,
      unstaged: unstaged.length,
      files: entries.map((entry) => ({
        path: entry.path,
        status: `${entry.index}${entry.workingTree}`,
        category: entry.category,
      })),
    },
    blockers,
  };
}

function buildRecommendedActions(
  memory: ReturnType<typeof buildMemoryGate>,
  git: ReturnType<typeof buildGitGate>,
  compatibility: CompatibilityReport,
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  if (compatibility.mode === "compatibility") {
    actions.push({
      priority: "P1",
      action: "run_memory_audit",
      target: "workspace",
      reason: `compatibilityWarnings=${compatibility.warnings.length}`,
    });
  }
  for (const blocker of memory.blockers) {
    actions.push({
      priority: blocker.type === "memory_stale" ? "P2" : "P1",
      action:
        blocker.type === "memory_stale"
          ? "repair_stale_memory"
          : blocker.type === "memory_compaction_due" ||
              blocker.type === "memory_compaction_invalid"
            ? "compact_memory_card"
            : blocker.type === "memory_archive_volume_due"
              ? "open_next_archive_volume"
          : "repair_memory_health",
      target: blocker.target,
      reason: blocker.reason,
    });
  }
  for (const item of memory.reviewItems) {
    actions.push(toReviewAction(item));
  }
  for (const item of memory.advisories) {
    if (item.tier === "advisory") actions.push(toReviewAction(item));
  }
  if (git.summary.dirty) {
    actions.push({
      priority: "P1",
      action: "review_dirty_files",
      target: "workspace",
      reason: "提交前需確認哪些檔案屬於本次變更",
    });
  }
  return actions.sort((a, b) => a.priority.localeCompare(b.priority));
}

function toReviewAction(item: MemoryWarningItem): RecommendedAction {
  if (item.code === "memory_legacy_schema") {
    return {
      priority: "P2",
      action: "lazy_upgrade_memory_card",
      target: item.target,
      reason: item.reason,
    };
  }
  if (item.code === "memory_language_ratio") {
    return {
      priority: "P2",
      action: "reduce_memory_card_chinese_body",
      target: item.target,
      reason: item.reason,
    };
  }
  if (item.code === "memory_granularity_advisory") {
    return {
      priority: "P2",
      action: "review_memory_card_split_suggestion",
      target: item.target,
      reason: item.reason,
    };
  }
  if (item.code === "memory_archive_migration") {
    return {
      priority: "P2",
      action: "migrate_archive_path",
      target: item.target,
      reason: item.reason,
    };
  }
  return {
    priority: "P2",
    action:
      item.code === "memory_child_review"
        ? "review_child_memory"
        : "review_upstream_staleness",
    target: item.target,
    reason: item.reason,
  };
}

function buildSuggestedCommands() {
  return [
    "git status --short",
    "npx gitnexus detect-changes --scope all",
    "npx vitest run",
    "npx tsc --noEmit",
    "npx eslint src/ --format json",
    "npx tsup --config tsup.config.ts",
  ];
}

function buildReadiness(
  blockers: Blocker[],
  dependencySemantics: DependencySemanticSummary,
  memoryWarnings: MemoryWarningClassification,
): PreflightReadiness {
  const warningReasons = [
    ...memoryWarnings.review.map((item) => `${item.target}: ${item.reason}`),
    ...memoryWarnings.advisory.map((item) => `${item.target}: ${item.reason}`),
    ...dependencySemantics.modules.map(
      (item) => `${item.module}: ${item.codes.join(", ")}`,
    ),
  ];
  return {
    status: blockers.length > 0 ? "blocked" : warningReasons.length > 0 ? "warning" : "ready",
    blockingReasons: blockers.map(
      (blocker) => `${blocker.target}: ${blocker.reason}`,
    ),
    warningReasons,
  };
}

export function buildCommitPreflight(
  index: PreflightIndex,
  gitStatus: GitStatusEntry[],
  dependencySemantics: DependencySemanticSummary = {
    warnings: 0,
    modules: [],
  },
  options: { indexAvailable?: boolean } = {},
) {
  const memory = buildMemoryGate(index);
  const git = buildGitGate(gitStatus);
  const compatibility = buildCompatibilityReport(index, options);
  const compatibilityBlockers: Blocker[] =
    compatibility.mode === "compatibility"
      ? [
          {
            type: "memory_compatibility",
            target: "workspace",
            reason: `compatibilityWarnings=${compatibility.warnings.length}`,
          },
        ]
      : [];
  const blockers = [...compatibilityBlockers, ...memory.blockers, ...git.blockers];
  const memoryWarnings = classifyMemoryWarnings(index);
  const readiness = buildReadiness(blockers, dependencySemantics, memoryWarnings);
  return {
    status: readiness.status,
    summary: {
      readiness,
      compatibility,
      memory: memory.summary,
      memoryWarnings,
      reviewItems: memory.reviewItems,
      advisories: memory.advisories,
      git: git.summary,
      dependencySemantics,
    },
    blockers,
    recommendedActions: buildRecommendedActions(memory, git, compatibility),
    suggestedCommands: buildSuggestedCommands(),
  };
}
