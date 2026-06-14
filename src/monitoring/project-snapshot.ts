import path from "node:path";
import { createVisibleCartridgeIndex } from "../visible-index.js";
import { classifyMemoryWarnings } from "../staleness.js";
import type { MemoryCompactionMetrics } from "../memory-compaction.js";
import type {
  MemoryContentQualityStatus,
  MemoryMainFileType,
} from "../memory-main-file.js";
import type {
  CartridgeEntry,
  CartridgeIndex,
  FileEventType,
  PendingChange,
  UntrackedFileEntry,
} from "../types.js";

export type DesktopProjectStatus =
  | "ready"
  | "warning"
  | "blocked"
  | "paused"
  | "error";

export interface DesktopCartridgeSnapshot {
  id: string;
  skillPath: string;
  mainFileType: MemoryMainFileType;
  mainFilePath: string | null;
  mainFileCandidates: string[];
  contentQualityStatus: MemoryContentQualityStatus;
  contentQualityLabel: string;
  migrationRequired: boolean;
  legacyCompatibility: boolean;
  description: string;
  staleness: number;
  indirectStaleness: number;
  pendingChanges: number;
  ghostFiles: number;
  trackedFiles: string[];
  pendingChangeFiles: DesktopPendingChangeSnapshot[];
  ghostFilePaths: string[];
  compaction: MemoryCompactionMetrics | null;
  guidance: string;
}

export interface DesktopPendingChangeSnapshot {
  filePath: string;
  eventType: FileEventType;
  timestamp: string;
  label: string;
}

export interface DesktopUntrackedFileSnapshot {
  filePath: string;
  suggestedOwner: string | null;
  detectedAt: string;
  lastEvent: FileEventType;
  guidance: string;
}

export interface DesktopProjectSnapshot {
  id: string;
  name: string;
  root: string;
  status: DesktopProjectStatus;
  enabled: boolean;
  lastScanned: string;
  error: string | null;
  counts: {
    cartridges: number;
    blocking: number;
    review: number;
    advisory: number;
    info: number;
    stale: number;
    ghostFiles: number;
    untrackedFiles: number;
    pendingChanges: number;
    migrationRequired: number;
    mainFileConflicts: number;
    legacyMainFiles: number;
    qualityReview: number;
  };
  cartridges: DesktopCartridgeSnapshot[];
  untrackedFiles: DesktopUntrackedFileSnapshot[];
}

export function createProjectId(projectRoot: string): string {
  return Buffer.from(path.resolve(projectRoot).toLowerCase()).toString("base64url");
}

export function buildDesktopProjectSnapshot(args: {
  projectRoot: string;
  index: CartridgeIndex;
  enabled: boolean;
  error?: string | null;
}): DesktopProjectSnapshot {
  const index = createVisibleCartridgeIndex(args.index);
  const warnings = classifyMemoryWarnings(index);
  const cartridges = Object.entries(index.cartridges)
    .map(([id, entry]) => toCartridgeSnapshot(id, entry))
    .sort((a, b) => b.staleness - a.staleness || a.id.localeCompare(b.id));
  const ghostFiles = cartridges.reduce((sum, item) => sum + item.ghostFiles, 0);
  const pendingChanges = cartridges.reduce(
    (sum, item) => sum + item.pendingChanges,
    0,
  );
  const migrationRequired = cartridges.filter(
    (item) => item.migrationRequired,
  ).length;
  const mainFileConflicts = cartridges.filter(
    (item) => item.mainFileType === "conflict",
  ).length;
  const legacyMainFiles = cartridges.filter(
    (item) => item.mainFileType === "legacy SKILL.md",
  ).length;
  const qualityReview = cartridges.filter(
    (item) => item.contentQualityStatus !== "complete",
  ).length;
  const status = getProjectStatus({
    enabled: args.enabled,
    error: args.error,
    blocking: warnings.blocking.length,
    review: warnings.review.length + warnings.advisory.length,
  });

  return {
    id: createProjectId(args.projectRoot),
    name: path.basename(args.projectRoot),
    root: path.resolve(args.projectRoot),
    status,
    enabled: args.enabled,
    lastScanned: index.lastScanned,
    error: args.error ?? null,
    counts: {
      cartridges: cartridges.length,
      blocking: warnings.blocking.length,
      review: warnings.review.length,
      advisory: warnings.advisory.length,
      info: warnings.info.length,
      stale: cartridges.filter((item) => item.staleness > 0).length,
      ghostFiles,
      untrackedFiles: index.untrackedFiles?.length ?? 0,
      pendingChanges,
      migrationRequired,
      mainFileConflicts,
      legacyMainFiles,
      qualityReview,
    },
    cartridges,
    untrackedFiles: (index.untrackedFiles ?? []).map(toUntrackedFileSnapshot),
  };
}

function toCartridgeSnapshot(
  id: string,
  entry: CartridgeEntry,
): DesktopCartridgeSnapshot {
  const contentQualityStatus =
    entry.contentQuality?.status ??
    entry.contentQualityStatus ??
    "pending_review";
  return {
    id,
    skillPath: entry.skillPath,
    mainFileType: entry.mainFile?.type ?? entry.mainFileType ?? "legacy SKILL.md",
    mainFilePath: entry.mainFile?.activePath ?? entry.skillPath ?? null,
    mainFileCandidates: entry.mainFile?.candidatePaths ?? [entry.skillPath],
    contentQualityStatus,
    contentQualityLabel:
      entry.contentQuality?.label ?? qualityLabel(contentQualityStatus),
    migrationRequired: entry.migrationRequired ?? false,
    legacyCompatibility: entry.legacyCompatibility ?? false,
    description: entry.description,
    staleness: entry.staleness,
    indirectStaleness: entry.indirectStaleness ?? 0,
    pendingChanges: entry.pendingChanges?.length ?? 0,
    ghostFiles: entry.ghostFiles?.length ?? 0,
    trackedFiles: [...(entry.trackedFiles ?? [])].sort(),
    pendingChangeFiles: (entry.pendingChanges ?? [])
      .map(toPendingChangeSnapshot)
      .sort((a, b) => a.filePath.localeCompare(b.filePath)),
    ghostFilePaths: [...(entry.ghostFiles ?? [])].sort(),
    compaction: entry.compaction ?? null,
    guidance: buildCartridgeGuidance(id, entry),
  };
}

function qualityLabel(status: MemoryContentQualityStatus): string {
  if (status === "complete") return "完整";
  if (status === "missing_fields") return "缺欄位";
  if (status === "missing_sections") return "缺段落";
  if (status === "conflict") return "衝突";
  if (status === "superseded") return "已取代";
  return "待審";
}

function toPendingChangeSnapshot(
  change: PendingChange,
): DesktopPendingChangeSnapshot {
  return {
    filePath: change.filePath,
    eventType: change.eventType,
    timestamp: change.timestamp,
    label: getEventLabel(change.eventType),
  };
}

function toUntrackedFileSnapshot(
  entry: UntrackedFileEntry,
): DesktopUntrackedFileSnapshot {
  return {
    filePath: entry.filePath,
    suggestedOwner: entry.suggestedOwner,
    detectedAt: entry.detectedAt,
    lastEvent: entry.lastEvent,
    guidance: entry.suggestedOwner
      ? `建議先開啟 ${entry.suggestedOwner} 記憶卡，確認是否要把這個檔案加入 Tracked Files。`
      : "先判斷這個新檔案屬於哪張記憶卡，再開啟對應記憶卡加入 Tracked Files。",
  };
}

function buildCartridgeGuidance(id: string, entry: CartridgeEntry): string {
  const pending = entry.pendingChanges?.length ?? 0;
  const ghosts = entry.ghostFiles?.length ?? 0;
  const indirect = entry.indirectStaleness ?? 0;
  const compaction = entry.compaction;
  if (entry.mainFile?.type === "conflict" || entry.mainFileType === "conflict") {
    return `${id} 同時存在 MEMORY.md 與 SKILL.md，需先人工解決雙主檔衝突；候選：${entry.mainFile?.candidatePaths.join(", ") ?? "未知"}`;
  }
  if (entry.mainFile?.type === "missing" || entry.mainFileType === "missing") {
    return `${id} 缺少作用中記憶主檔，需先恢復 MEMORY.md 或 legacy SKILL.md。`;
  }
  if (entry.legacyCompatibility) {
    return `${id} 仍使用 legacy SKILL.md；相容期可讀寫，但需遷移到 MEMORY.md 後才算新版標準。`;
  }
  if (
    entry.contentQuality?.status &&
    entry.contentQuality.status !== "complete"
  ) {
    return `${id} 內容品質狀態為 ${entry.contentQuality.label}，需補齊欄位、段落或驗證證據。`;
  }
  if (compaction?.needsCompaction) {
    if (compaction.reasons.includes("cycleEventLimitExceeded")) {
      return `${id} 的 Cycle Events 已超過 ${compaction.cycleEventLimit} 筆，必須先彙整後再同步。`;
    }
    return `先彙整 ${id} 記憶卡；目前大小 ${compaction.sizeBytes}/${compaction.sizeLimitBytes} bytes，週期事件 ${compaction.cycleEventCount}/${compaction.cycleEventLimit}。`;
  }
  if (pending > 0 && ghosts > 0) {
    return `先更新 ${id} 記憶卡內容，再清理已不存在的追蹤檔案。`;
  }
  if (pending > 0) {
    return `開啟 ${id} 記憶卡，依待處理檔案更新內容或確認變更已無影響。`;
  }
  if (ghosts > 0) {
    return `開啟 ${id} 記憶卡，從 Tracked Files 移除已不存在的檔案路徑。`;
  }
  if (indirect > 0) {
    return `檢查 ${id} 是否受上游記憶卡變更影響；若內容仍正確，可保留不改。`;
  }
  if (compaction?.isLegacy) {
    return `${id} 是舊格式記憶卡；下次修改時再懶升級為 schema v2。`;
  }
  if ((entry.trackedFiles?.length ?? 0) > 8) {
    return `${id} 追蹤檔案數偏高，這是拆分建議，不會單獨阻擋。`;
  }
  return "目前沒有需要處理的記憶問題。";
}

function getEventLabel(eventType: FileEventType): string {
  if (eventType === "add") return "新增";
  if (eventType === "unlink") return "刪除";
  return "變更";
}

function getProjectStatus(args: {
  enabled: boolean;
  error?: string | null;
  blocking: number;
  review: number;
}): DesktopProjectStatus {
  if (!args.enabled) return "paused";
  if (args.error) return "error";
  if (args.blocking > 0) return "blocked";
  if (args.review > 0) return "warning";
  return "ready";
}
