import type { DesktopProjectSnapshot } from "../monitoring/project-snapshot.js";
import { canonicalProjectRoot } from "../monitoring/project-identity.js";
import type { DesktopOperationResult } from "./ipc-channels.js";

export function projectTrayLabel(snapshots: DesktopProjectSnapshot[]): string {
  if (snapshots.length === 0) return "尚未加入專案";
  for (const [status, label] of [["error", "錯誤"], ["blocked", "阻塞"], ["warning", "警告"]] as const) {
    const count = snapshots.filter(item => item.status === status).length;
    if (count) return `${label} ${count}`;
  }
  const paused = snapshots.filter(item => item.status === "paused").length;
  if (paused === snapshots.length) return "全部暫停";
  if (paused) return `暫停 ${paused}`;
  return "全部健康";
}

export function scanOperationResult(
  snapshots: DesktopProjectSnapshot[], root?: string,
): DesktopOperationResult<DesktopProjectSnapshot[]> {
  const targets = root ? snapshots.filter(item => canonicalProjectRoot(item.root) === canonicalProjectRoot(root)) : snapshots;
  const errors = targets.filter(item => item.error);
  if (errors.length) return { outcome: "error", message: `掃描失敗，保留上次成功資料：${errors.map(item => `${item.name}: ${item.error}`).join("；")}`, data: snapshots };
  const warnings = targets.filter(item => item.syncWarning);
  if (warnings.length) return { outcome: "blocked", message: `掃描完成但同步未完成：${warnings.map(item => `${item.name}: ${item.syncWarning}`).join("；")}`, data: snapshots };
  if (!targets.length) return { outcome: "cancelled", message: "沒有可掃描的監控專案。", data: snapshots };
  return { outcome: "success", message: root ? "專案掃描已完成。" : "全部專案掃描已完成。", data: snapshots };
}
