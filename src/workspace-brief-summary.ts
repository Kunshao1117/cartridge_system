import {
  classifyMemoryWarnings,
  stalenessToLevel,
  type MemoryWarningClassification,
  type MemoryWarningItem,
} from "./staleness.js";
import {
  buildCompatibilityReport,
  type CompatibilityReport,
} from "./memory-compatibility.js";
import type { ContextAuditFinding, ContextInventory } from "./context-types.js";
import type {
  ProjectContextFinding,
  ProjectContextSummary,
} from "./project-context-types.js";
import type { MemoryCompactionMetrics } from "./memory-compaction.js";

const STALENESS_SIGNIFICANT = 10;

export interface BriefCartridgeEntry {
  staleness?: number;
  pendingChanges?: unknown[];
  trackedFiles?: string[];
  ghostFiles?: string[];
  indirectStaleness?: number;
  dependencies?: string[];
  parent?: string | null;
  compaction?: MemoryCompactionMetrics;
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
  label: string;
  nextTool?: string;
  blocking: boolean;
};

type SubmitReadiness = {
  status: "ready" | "needs_review" | "blocked";
  reason: string | null;
  reasons: string[];
  nextAction: "run_commit_preflight" | null;
  nextTool: "commit_preflight" | null;
  label: string;
};

type MemoryReadiness = {
  status: "ready" | "warning" | "blocked";
  reasons: string[];
  reviewReasons: string[];
  advisoryReasons: string[];
};

export interface ContextBrief {
  inventory: ContextInventory["totals"];
  readiness: {
    status: "ready" | "warning" | "blocked";
    blockers: number;
    warnings: number;
    informational: number;
  };
  findings: ContextAuditFinding[];
}

export interface ProjectContextBrief {
  totals: ProjectContextSummary["totals"];
  readiness: ProjectContextSummary["readiness"];
  usage: ProjectContextSummary["usage"];
  findings: ProjectContextFinding[];
}

type StartupReadiness = {
  status: "ready" | "needs_review" | "blocked";
  label: string;
  reasons: string[];
  nextTool: string | null;
  nextAction: string | null;
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
  const compactionDue = cartridges
    .filter(([, entry]) => entry.compaction?.needsCompaction)
    .map(([module, entry]) => ({
      module,
      status: entry.compaction?.compactionStatus,
      reasons: entry.compaction?.reasons ?? [],
      cycleEventCount: entry.compaction?.cycleEventCount ?? 0,
      sizeBytes: entry.compaction?.sizeBytes ?? 0,
      lineCount: entry.compaction?.lineCount ?? 0,
      recommendedAction: entry.compaction?.recommendedAction,
    }));
  const legacyCards = cartridges
    .filter(([, entry]) => entry.compaction?.isLegacy)
    .map(([module, entry]) => ({
      module,
      recommendedAction: entry.compaction?.recommendedAction,
    }));
  const languageWarnings = cartridges
    .filter(([, entry]) => entry.compaction?.reasons.includes("highChineseRatio"))
    .map(([module, entry]) => ({
      module,
      chineseRatio: entry.compaction?.chineseRatio ?? 0,
    }));
  const splitSuggestions = cartridges
    .filter(([, entry]) => (entry.trackedFiles?.length ?? 0) > 8)
    .map(([module, entry]) => ({
      module,
      trackedFilesCount: entry.trackedFiles?.length ?? 0,
      blocking: false,
    }));
  const oversizedContent = cartridges
    .filter(
      ([, entry]) =>
        entry.compaction?.reasons.includes("mainCardOversize") ||
        entry.compaction?.reasons.includes("mainCardLineLimit") ||
        entry.compaction?.reasons.includes("rootIndexOversize"),
    )
    .map(([module, entry]) => ({
      module,
      sizeBytes: entry.compaction?.sizeBytes ?? 0,
      lineCount: entry.compaction?.lineCount ?? 0,
      recommendedAction: entry.compaction?.recommendedAction,
    }));
  return {
    total: cartridges.length,
    stale: staleModules.length,
    staleModules,
    ghostFiles: ghostModules.reduce((sum, item) => sum + item.ghostFilesCount, 0),
    ghostModules,
    untrackedFiles: index.untrackedFiles?.length ?? 0,
    indirectStale: indirectStaleModules.length,
    indirectStaleModules,
    oversized: oversizedContent,
    splitSuggestions,
    granularityAdvisories: splitSuggestions.length,
    compactionDue: compactionDue.length,
    compactionModules: compactionDue,
    legacyCards: legacyCards.length,
    legacyCardModules: legacyCards,
    languageWarnings: languageWarnings.length,
    languageWarningModules: languageWarnings,
    dependencies: {
      totalEdges: dependencyEdges,
    },
  };
}

function buildReadiness(classification: MemoryWarningClassification): MemoryReadiness {
  const reasons = classification.blocking.map(
    (item) => `${item.target}: ${item.reason}`,
  );
  const reviewReasons = classification.review.map(
    (item) => `${item.target}: ${item.reason}`,
  );
  const advisoryReasons = classification.advisory.map(
    (item) => `${item.target}: ${item.reason}`,
  );
  return {
    status:
      reasons.length > 0
        ? "blocked"
        : reviewReasons.length > 0 || advisoryReasons.length > 0
          ? "warning"
          : "ready",
    reasons,
    reviewReasons,
    advisoryReasons,
  };
}

function buildStartupReadiness(args: {
  memoryReadiness: MemoryReadiness;
  context?: ContextBrief;
  projectContext?: ProjectContextBrief;
}): StartupReadiness {
  if (args.memoryReadiness.status === "blocked") {
    return {
      status: "blocked",
      label: "需要先處理記憶卡提醒",
      reasons: args.memoryReadiness.reasons,
      nextTool: "memory_audit",
      nextAction: "review_action_items",
    };
  }

  if (args.memoryReadiness.status === "warning") {
    return {
      status: "needs_review",
      label: "可以開工，但建議複審記憶卡提醒",
      reasons: [
        ...args.memoryReadiness.reviewReasons,
        ...args.memoryReadiness.advisoryReasons,
      ],
      nextTool: "memory_deps",
      nextAction: "review_memory_advisories",
    };
  }

  if (args.context?.readiness.status === "blocked") {
    return {
      status: "blocked",
      label: "需要先處理規則檔衝突",
      reasons: args.context.findings
        .filter((finding) => finding.severity === "error")
        .map((finding) => finding.message),
      nextTool: "context_audit",
      nextAction: "review_context_findings",
    };
  }

  if (args.context?.readiness.status === "warning") {
    return {
      status: "needs_review",
      label: "可以開工，但建議先看規則檔提醒",
      reasons: args.context.findings
        .filter((finding) => finding.severity === "warning")
        .map((finding) => finding.message),
      nextTool: "context_audit",
      nextAction: "review_context_findings",
    };
  }

  if (args.projectContext?.readiness.status === "warning") {
    return {
      status: "needs_review",
      label: "可以開工，但專案脈絡需要複審",
      reasons: args.projectContext.findings
        .filter((finding) => finding.severity !== "info")
        .map((finding) => finding.message),
      nextTool: "project_context_status",
      nextAction: "review_project_context",
    };
  }

  return {
    status: "ready",
    label: "可以開工",
    reasons: [],
    nextTool: null,
    nextAction: null,
  };
}

function buildSubmitReadiness(
  readiness: MemoryReadiness,
): SubmitReadiness {
  if (readiness.status === "blocked") {
    return {
      status: "blocked",
      reason: "memory readiness is blocked",
      reasons: readiness.reasons,
      nextAction: null,
      nextTool: null,
      label: "記憶卡還有待處理項目，先不要提交",
    };
  }

  return {
    status: "needs_review",
    reason: "git state not inspected",
    reasons: [
      "workspace_brief does not inspect git state",
      "run commit_preflight before committing",
    ],
    nextAction: "run_commit_preflight",
    nextTool: "commit_preflight",
    label: "提交前還要跑 commit_preflight",
  };
}

function buildRecommendedActions(index: BriefIndex): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  const classification = classifyMemoryWarnings(index);
  for (const item of classification.blocking) {
    actions.push(toRecommendedAction(item));
  }
  for (const item of classification.review) {
    actions.push(toRecommendedAction(item));
  }
  for (const item of classification.advisory) {
    actions.push(toRecommendedAction(item));
  }
  return actions.sort((a, b) => a.priority.localeCompare(b.priority));
}

function toRecommendedAction(item: MemoryWarningItem): RecommendedAction {
  if (item.code === "memory_stale") {
    return {
      priority: item.score >= STALENESS_SIGNIFICANT ? "P1" : "P2",
      action: "repair_stale_memory",
      target: item.target,
      reason: item.reason,
      label: item.label,
      nextTool: "memory_status",
      blocking: true,
    };
  }
  if (item.code === "memory_indirect_stale") {
    return {
      priority: "P2",
      action: "review_upstream_staleness",
      target: item.target,
      reason: item.reason,
      label: item.label,
      nextTool: "memory_deps",
      blocking: false,
    };
  }
  if (item.code === "memory_child_review") {
    return {
      priority: "P2",
      action: "review_child_memory",
      target: item.target,
      reason: item.reason,
      label: item.label,
      nextTool: "memory_graph",
      blocking: false,
    };
  }
  if (
    item.code === "memory_compaction_due" ||
    item.code === "memory_compaction_invalid" ||
    item.code === "memory_archive_volume_due"
  ) {
    return {
      priority: "P1",
      action:
        item.code === "memory_archive_volume_due"
          ? "open_next_archive_volume"
          : "compact_memory_card",
      target: item.target,
      reason: item.reason,
      label: item.label,
      nextTool: "memory_audit",
      blocking: true,
    };
  }
  if (item.code === "memory_legacy_schema") {
    return {
      priority: "P2",
      action: "lazy_upgrade_memory_card",
      target: item.target,
      reason: item.reason,
      label: item.label,
      nextTool: "memory_read",
      blocking: false,
    };
  }
  if (item.code === "memory_language_ratio") {
    return {
      priority: "P2",
      action: "reduce_memory_card_chinese_body",
      target: item.target,
      reason: item.reason,
      label: item.label,
      nextTool: "memory_read",
      blocking: false,
    };
  }
  if (item.code === "memory_granularity_advisory") {
    return {
      priority: "P2",
      action: "review_memory_card_split_suggestion",
      target: item.target,
      reason: item.reason,
      label: item.label,
      nextTool: "memory_list",
      blocking: false,
    };
  }
  if (item.code === "memory_archive_migration") {
    return {
      priority: "P2",
      action: "migrate_archive_path",
      target: item.target,
      reason: item.reason,
      label: item.label,
      nextTool: "memory_audit",
      blocking: false,
    };
  }
  return {
    priority: "P1",
    action:
      item.code === "memory_untracked_files"
        ? "attribute_untracked_files"
        : "clean_ghost_files",
    target: item.target,
    reason: item.reason,
    label: item.label,
    nextTool:
      item.code === "memory_untracked_files" ? "memory_audit" : "memory_status",
    blocking: true,
  };
}

function buildCompatibilityActions(
  compatibility: CompatibilityReport,
): RecommendedAction[] {
  if (compatibility.mode === "modern") return [];
  return [
    {
      priority: "P1",
      action: "run_memory_audit",
      target: "workspace",
      reason: `compatibilityWarnings=${compatibility.warnings.length}`,
      label: "執行記憶卡完整健檢",
      nextTool: "memory_audit",
      blocking: false,
    },
  ];
}

function buildContextActions(context?: ContextBrief): RecommendedAction[] {
  if (!context) return [];
  return context.findings
    .filter((finding) => finding.severity !== "info")
    .map((finding) => ({
      priority: finding.severity === "error" ? "P1" : ("P2" as const),
      action: finding.recommendedAction ?? "review_context_finding",
      target: finding.paths?.[0] ?? "workspace",
      reason: finding.message,
      label:
        finding.severity === "error"
          ? `處理規則檔衝突：${finding.code}`
          : `檢查規則檔提醒：${finding.code}`,
      nextTool: finding.recommendedTool ?? "context_audit",
      blocking: finding.severity === "error",
    }));
}

function buildProjectContextActions(
  projectContext?: ProjectContextBrief,
): RecommendedAction[] {
  if (!projectContext) return [];
  return projectContext.findings
    .filter((finding) => finding.severity !== "info")
    .map((finding) => ({
      priority: "P2" as const,
      action: "review_project_context",
      target: finding.file ?? finding.contextId ?? "workspace",
      reason: finding.message,
      label: `檢查專案脈絡：${finding.code}`,
      nextTool: "project_context_status",
      blocking: false,
    }));
}

export function buildWorkspaceBrief(
  project: ProjectSummary,
  index: BriefIndex,
  options: {
    indexAvailable?: boolean;
    context?: ContextBrief;
    projectContext?: ProjectContextBrief;
  } = {},
) {
  const memory = buildMemorySummary(index);
  const memoryWarnings = classifyMemoryWarnings(index);
  const readiness = buildReadiness(memoryWarnings);
  const compatibility = buildCompatibilityReport(index, options);
  const startupReadiness = buildStartupReadiness({
    memoryReadiness: readiness,
    context: options.context,
    projectContext: options.projectContext,
  });
  return {
    project,
    memory,
    context: options.context,
    projectContext: options.projectContext,
    compatibility,
    readiness,
    memoryWarnings,
    reviewItems: memoryWarnings.review,
    advisories: [
      ...memoryWarnings.review,
      ...memoryWarnings.advisory,
      ...memoryWarnings.info,
    ],
    startupReadiness,
    submitReadiness: buildSubmitReadiness(readiness),
    recommendedActions: [
      ...buildCompatibilityActions(compatibility),
      ...buildRecommendedActions(index),
      ...buildContextActions(options.context),
      ...buildProjectContextActions(options.projectContext),
    ].sort((a, b) => a.priority.localeCompare(b.priority)),
  };
}
