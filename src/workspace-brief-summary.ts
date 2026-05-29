import { stalenessToLevel } from "./staleness.js";
import {
  buildCompatibilityReport,
  type CompatibilityReport,
} from "./memory-compatibility.js";
import type { ContextAuditFinding, ContextInventory } from "./context-types.js";
import type {
  ProjectContextFinding,
  ProjectContextSummary,
} from "./project-context-types.js";

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

function buildStartupReadiness(args: {
  memoryReadiness: ReturnType<typeof buildReadiness>;
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
  readiness: ReturnType<typeof buildReadiness>,
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
  for (const [module, entry] of Object.entries(index.cartridges ?? {})) {
    const staleness = entry.staleness ?? 0;
    if (staleness > 0) {
      actions.push({
        priority: staleness >= STALENESS_SIGNIFICANT ? "P1" : "P2",
        action: "repair_stale_memory",
        target: module,
        reason: `staleness=${staleness}`,
        label: `更新記憶卡：${module}`,
        nextTool: "memory_status",
        blocking: staleness >= STALENESS_SIGNIFICANT,
      });
    }
    const ghostCount = entry.ghostFiles?.length ?? 0;
    if (ghostCount > 0) {
      actions.push({
        priority: "P1",
        action: "clean_ghost_files",
        target: module,
        reason: `ghostFiles=${ghostCount}`,
        label: `清理幽靈檔案：${module}`,
        nextTool: "memory_status",
        blocking: true,
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
      label: "歸屬未歸屬檔案",
      nextTool: "memory_audit",
      blocking: true,
    });
  }
  return actions.sort((a, b) => a.priority.localeCompare(b.priority));
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
  const readiness = buildReadiness(memory);
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
