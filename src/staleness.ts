import type { CartridgeConfig, StalenessLevel } from "./types.js";
import type { MemoryCompactionMetrics } from "./memory-compaction.js";
import type {
  MemoryContentQualityStatus,
  MemoryMainFileInfo,
  MemoryMainFileType,
  MemoryQualityReport,
} from "./memory-main-file.js";
import { filterVisibleUntrackedFiles } from "./index-manager.js";

const STALENESS_THRESHOLDS = { significant: 10, critical: 30 };

export type MemoryWarningTier = "blocking" | "review" | "advisory" | "info";

export interface MemoryWarningEntry {
  skillPath?: string;
  staleness?: number;
  ghostFiles?: unknown[];
  indirectStaleness?: number;
  parent?: string | null;
  trackedFiles?: unknown[];
  compaction?: MemoryCompactionMetrics;
  mainFile?: MemoryMainFileInfo;
  mainFileType?: MemoryMainFileType;
  contentQuality?: MemoryQualityReport;
  contentQualityStatus?: MemoryContentQualityStatus;
  migrationRequired?: boolean;
  legacyCompatibility?: boolean;
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
    | "memory_relation_hint"
    | "memory_compaction_due"
    | "memory_compaction_invalid"
    | "memory_archive_volume_due"
    | "memory_archive_migration"
    | "memory_main_file_conflict"
    | "memory_main_file_missing"
    | "memory_main_file_legacy"
    | "memory_quality_missing_fields"
    | "memory_quality_missing_sections"
    | "memory_quality_pending_review"
    | "memory_quality_conflict"
    | "memory_quality_superseded"
    | "memory_legacy_schema"
    | "memory_language_ratio"
    | "memory_granularity_advisory";
  target: string;
  reason: string;
  label: string;
  score: number;
  blocking: boolean;
}

export interface MemoryWarningClassification {
  blocking: MemoryWarningItem[];
  review: MemoryWarningItem[];
  advisory: MemoryWarningItem[];
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
  const advisory: MemoryWarningItem[] = [];
  const info: MemoryWarningItem[] = [];
  const childReviewByParent = new Map<string, string[]>();

  for (const [module, entry] of Object.entries(index.cartridges ?? {})) {
    const mainFileType =
      entry.mainFile?.type ??
      entry.mainFileType ??
      (entry.skillPath
        ? entry.skillPath.replace(/\\/g, "/").endsWith("/MEMORY.md")
          ? "MEMORY.md"
          : "legacy SKILL.md"
        : null);
    if (mainFileType === "conflict") {
      blocking.push({
        tier: "blocking",
        code: "memory_main_file_conflict",
        target: module,
        reason: `candidates=${(entry.mainFile?.candidatePaths ?? []).join(",")}`,
        label: `解決雙主檔衝突：${module}`,
        score: 100,
        blocking: true,
      });
    } else if (mainFileType === "missing") {
      blocking.push({
        tier: "blocking",
        code: "memory_main_file_missing",
        target: module,
        reason: "mainFile=missing",
        label: `補齊記憶主檔：${module}`,
        score: 100,
        blocking: true,
      });
    } else if (mainFileType === "legacy SKILL.md") {
      advisory.push({
        tier: "advisory",
        code: "memory_main_file_legacy",
        target: module,
        reason: "mainFile=legacy SKILL.md",
        label: `遷移舊版主檔：${module}`,
        score: 1,
        blocking: false,
      });
    }

    const qualityStatus = entry.contentQuality?.status ?? entry.contentQualityStatus;
    if (qualityStatus === "conflict") {
      blocking.push({
        tier: "blocking",
        code: "memory_quality_conflict",
        target: module,
        reason: "contentQuality=conflict",
        label: `處理品質衝突：${module}`,
        score: 100,
        blocking: true,
      });
    } else if (qualityStatus === "missing_fields") {
      review.push({
        tier: "review",
        code: "memory_quality_missing_fields",
        target: module,
        reason: `missingFields=${entry.contentQuality?.missingFields.join(",") ?? "unknown"}`,
        label: `補齊品質欄位：${module}`,
        score: entry.contentQuality?.missingFields.length ?? 1,
        blocking: false,
      });
    } else if (qualityStatus === "missing_sections") {
      review.push({
        tier: "review",
        code: "memory_quality_missing_sections",
        target: module,
        reason: `missingSections=${entry.contentQuality?.missingSections.join(",") ?? "unknown"}`,
        label: `補齊品質段落：${module}`,
        score: entry.contentQuality?.missingSections.length ?? 1,
        blocking: false,
      });
    } else if (qualityStatus === "pending_review") {
      review.push({
        tier: "review",
        code: "memory_quality_pending_review",
        target: module,
        reason: `verificationStatus=${entry.contentQuality?.verificationStatus ?? "unknown"}`,
        label: `複審品質證據：${module}`,
        score: 1,
        blocking: false,
      });
    } else if (qualityStatus === "superseded") {
      review.push({
        tier: "review",
        code: "memory_quality_superseded",
        target: module,
        reason: "contentQuality=superseded",
        label: `確認已取代主卡：${module}`,
        score: 1,
        blocking: false,
      });
    }

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

    const compaction = entry.compaction;
    if (compaction?.needsCompaction) {
      blocking.push({
        tier: "blocking",
        code:
          compaction.compliance === "invalid"
            ? "memory_compaction_invalid"
            : "memory_compaction_due",
        target: module,
        reason:
          `compactionStatus=${compaction.compactionStatus};` +
          `cardKind=${compaction.cardKind};` +
          `reasons=${compaction.reasons.join(",")};` +
          `cycleEvents=${compaction.cycleEventCount}/${compaction.cycleEventLimit};` +
          `sizeBytes=${compaction.sizeBytes}/${compaction.sizeLimitBytes};` +
          `lineCount=${compaction.lineCount}/${compaction.lineLimit ?? "none"}`,
        label: `先彙整記憶卡：${module}`,
        score: Math.max(
          compaction.cycleEventCount,
          Math.ceil(compaction.sizeBytes / 1024),
          compaction.lineCount,
        ),
        blocking: true,
      });
    }

    for (const archive of compaction?.archiveVolumes ?? []) {
      if (!archive.needsCompaction) continue;
      blocking.push({
        tier: "blocking",
        code: "memory_archive_volume_due",
        target: module,
        reason:
          `archive=${archive.filePath};` +
          `reasons=${archive.reasons.join(",")};` +
          `sizeBytes=${archive.sizeBytes}/${archive.sizeLimitBytes};` +
          `lineCount=${archive.lineCount}/${archive.lineLimit}`,
        label: `開新歸檔卷：${module}`,
        score: Math.max(Math.ceil(archive.sizeBytes / 1024), archive.lineCount),
        blocking: true,
      });
    }

    if (compaction?.isLegacy) {
      advisory.push({
        tier: "advisory",
        code: "memory_legacy_schema",
        target: module,
        reason: "memory_schema_version<2",
        label: `懶升級舊記憶卡：${module}`,
        score: 1,
        blocking: false,
      });
    }

    if (compaction?.reasons.includes("highChineseRatio")) {
      advisory.push({
        tier: "advisory",
        code: "memory_language_ratio",
        target: module,
        reason: `chineseRatio=${compaction.chineseRatio}`,
        label: `調整英文主體比例：${module}`,
        score: Math.ceil(compaction.chineseRatio * 100),
        blocking: false,
      });
    }

    const trackedFilesCount = entry.trackedFiles?.length ?? 0;
    if (trackedFilesCount > 8) {
      advisory.push({
        tier: "advisory",
        code: "memory_granularity_advisory",
        target: module,
        reason: `trackedFiles=${trackedFilesCount}`,
        label: `建議拆分記憶卡：${module}`,
        score: trackedFilesCount,
        blocking: false,
      });
    }

    for (const warning of compaction?.archiveMigrationWarnings ?? []) {
      advisory.push({
        tier: "advisory",
        code: "memory_archive_migration",
        target: module,
        reason: warning,
        label: `遷移舊式歸檔路徑：${module}`,
        score: 1,
        blocking: false,
      });
    }
  }

  const untrackedFiles = filterVisibleUntrackedFiles(index.untrackedFiles).length;
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
    advisory: sortWarnings(advisory),
    info: sortWarnings(info),
  };
}

function sortWarnings(items: MemoryWarningItem[]): MemoryWarningItem[] {
  return [...items].sort((a, b) => b.score - a.score || a.target.localeCompare(b.target));
}
