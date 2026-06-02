import path from "node:path";
import { classifyMemoryWarnings } from "../staleness.js";
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
  description: string;
  staleness: number;
  indirectStaleness: number;
  pendingChanges: number;
  ghostFiles: number;
  trackedFiles: string[];
  pendingChangeFiles: DesktopPendingChangeSnapshot[];
  ghostFilePaths: string[];
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
    info: number;
    stale: number;
    ghostFiles: number;
    untrackedFiles: number;
    pendingChanges: number;
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
  const warnings = classifyMemoryWarnings(args.index);
  const cartridges = Object.entries(args.index.cartridges)
    .map(([id, entry]) => toCartridgeSnapshot(id, entry))
    .sort((a, b) => b.staleness - a.staleness || a.id.localeCompare(b.id));
  const ghostFiles = cartridges.reduce((sum, item) => sum + item.ghostFiles, 0);
  const pendingChanges = cartridges.reduce(
    (sum, item) => sum + item.pendingChanges,
    0,
  );
  const status = getProjectStatus({
    enabled: args.enabled,
    error: args.error,
    blocking: warnings.blocking.length,
    review: warnings.review.length,
  });

  return {
    id: createProjectId(args.projectRoot),
    name: path.basename(args.projectRoot),
    root: path.resolve(args.projectRoot),
    status,
    enabled: args.enabled,
    lastScanned: args.index.lastScanned,
    error: args.error ?? null,
    counts: {
      cartridges: cartridges.length,
      blocking: warnings.blocking.length,
      review: warnings.review.length,
      info: warnings.info.length,
      stale: cartridges.filter((item) => item.staleness > 0).length,
      ghostFiles,
      untrackedFiles: args.index.untrackedFiles?.length ?? 0,
      pendingChanges,
    },
    cartridges,
    untrackedFiles: (args.index.untrackedFiles ?? []).map(toUntrackedFileSnapshot),
  };
}

function toCartridgeSnapshot(
  id: string,
  entry: CartridgeEntry,
): DesktopCartridgeSnapshot {
  return {
    id,
    skillPath: entry.skillPath,
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
    guidance: buildCartridgeGuidance(id, entry),
  };
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
