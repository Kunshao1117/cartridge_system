import type { CartridgeConfig, StalenessLevel } from "./types.js";

const STALENESS_THRESHOLDS = { significant: 10, critical: 30 };

export type MemoryWarningTier = "blocking" | "review" | "info";

export interface MemoryWarningEntry {
  staleness?: number;
  ghostFiles?: unknown[];
  indirectStaleness?: number;
  parent?: string | null;
}

export interface MemoryWarningIndex {
  cartridges?: Record<string, MemoryWarningEntry>;
  untrackedFiles?: unknown[];
}

export interface MemoryWarningItem {
  tier: MemoryWarningTier;
  code:
    | "memory_stale"
    | "memory_ghost_files"
    | "memory_untracked_files"
    | "memory_indirect_stale"
    | "memory_child_review"
    | "memory_relation_hint";
  target: string;
  reason: string;
  label: string;
  score: number;
  blocking: boolean;
}

export interface MemoryWarningClassification {
  blocking: MemoryWarningItem[];
  review: MemoryWarningItem[];
  info: MemoryWarningItem[];
}

export function stalenessToLevel(staleness: number): string {
  if (staleness <= 0) return "healthy";
  if (staleness < STALENESS_THRESHOLDS.significant) return "mild";
  if (staleness < STALENESS_THRESHOLDS.critical) return "significant";
  return "critical";
}

export function getStalenessLevel(
  staleness: number,
  config: CartridgeConfig,
): StalenessLevel {
  if (staleness <= 0) return "healthy";
  if (staleness < config.thresholds.significant) return "mild";
  if (staleness < config.thresholds.critical) return "significant";
  return "critical";
}

export function classifyMemoryWarnings(
  index: MemoryWarningIndex,
): MemoryWarningClassification {
  const blocking: MemoryWarningItem[] = [];
  const review: MemoryWarningItem[] = [];
  const info: MemoryWarningItem[] = [];
  const childReviewByParent = new Map<string, string[]>();

  for (const [module, entry] of Object.entries(index.cartridges ?? {})) {
    const staleness = entry.staleness ?? 0;
    if (staleness > 0) {
      blocking.push({
        tier: "blocking",
        code: "memory_stale",
        target: module,
        reason: `staleness=${staleness}`,
        label: `更新記憶卡：${module}`,
        score: staleness,
        blocking: true,
      });
    }

    const ghostFiles = entry.ghostFiles?.length ?? 0;
    if (ghostFiles > 0) {
      blocking.push({
        tier: "blocking",
        code: "memory_ghost_files",
        target: module,
        reason: `ghostFiles=${ghostFiles}`,
        label: `清理幽靈檔案：${module}`,
        score: ghostFiles,
        blocking: true,
      });
    }

    const indirectStaleness = entry.indirectStaleness ?? 0;
    if (indirectStaleness > 0) {
      review.push({
        tier: "review",
        code: "memory_indirect_stale",
        target: module,
        reason: `indirectStaleness=${indirectStaleness}`,
        label: `複審上游影響：${module}`,
        score: indirectStaleness,
        blocking: false,
      });
    }

    if (entry.parent) {
      info.push({
        tier: "info",
        code: "memory_relation_hint",
        target: module,
        reason: `parent=${entry.parent}`,
        label: `父卡脈絡：${entry.parent}`,
        score: 0,
        blocking: false,
      });
      if (staleness > 0 || ghostFiles > 0 || indirectStaleness > 0) {
        const children = childReviewByParent.get(entry.parent) ?? [];
        children.push(module);
        childReviewByParent.set(entry.parent, children);
      }
    }
  }

  const untrackedFiles = index.untrackedFiles?.length ?? 0;
  if (untrackedFiles > 0) {
    blocking.push({
      tier: "blocking",
      code: "memory_untracked_files",
      target: "workspace",
      reason: `untrackedFiles=${untrackedFiles}`,
      label: "歸屬未歸屬檔案",
      score: untrackedFiles,
      blocking: true,
    });
  }

  for (const [parent, children] of childReviewByParent.entries()) {
    review.push({
      tier: "review",
      code: "memory_child_review",
      target: parent,
      reason: `childrenNeedReview=${children.join(",")}`,
      label: `複審子卡狀態：${parent}`,
      score: children.length,
      blocking: false,
    });
  }

  return {
    blocking: sortWarnings(blocking),
    review: sortWarnings(review),
    info: sortWarnings(info),
  };
}

function sortWarnings(items: MemoryWarningItem[]): MemoryWarningItem[] {
  return [...items].sort((a, b) => b.score - a.score || a.target.localeCompare(b.target));
}
