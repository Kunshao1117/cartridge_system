import type { ContextAuditFinding, ContextInventory } from "./context-types.js";
import { createVisibleCartridgeIndex } from "./visible-index.js";
import { classifyMemoryWarnings } from "./staleness.js";
import type { CartridgeEntry, CartridgeIndex } from "./types.js";

export type ActionItemKind =
  | "stale"
  | "ghost"
  | "untracked"
  | "compaction"
  | "review"
  | "advisory"
  | "context";

export interface GovernanceActionItem {
  kind: ActionItemKind;
  label: string;
  description?: string;
  reason?: string;
  recommendedAction?: string;
  affectedPath?: string;
  targetPath?: string;
  cartridgeId?: string;
  severity: "info" | "warning" | "error";
}

function memoryMainTargetPath(entry: CartridgeEntry | undefined): string | undefined {
  if (!entry || entry.mainFile?.type === "conflict" || entry.mainFile?.type === "missing") {
    return undefined;
  }
  return entry.mainFile?.activePath ?? entry.skillPath;
}

export function buildGovernanceActionItems(args: {
  index: CartridgeIndex;
  inventory: ContextInventory;
  contextFindings: ContextAuditFinding[];
}): GovernanceActionItem[] {
  const items: GovernanceActionItem[] = [];
  const index = createVisibleCartridgeIndex(args.index);
  const assetById = new Map(args.inventory.assets.map((asset) => [asset.id, asset]));
  const memoryWarnings = classifyMemoryWarnings(index);

  for (const [id, entry] of Object.entries(index.cartridges)) {
    if (entry.staleness > 0) {
      items.push({
        kind: "stale",
        label: `複審來源與記憶卡：${id}`,
        description: `過期指數 ${entry.staleness}`,
        reason: "來源有變動，需比較最新相關來源與卡片；stale 本身不證明內容失真。",
        recommendedAction: "先比較來源與卡片版本、owner/scope 和主張；只有內容或追蹤需調整且已獲授權時才修改。no-write 不會自動清除 stale 或同步索引。",
        targetPath: memoryMainTargetPath(entry),
        cartridgeId: id,
        severity: entry.staleness >= 100 ? "error" : "warning",
      });
    }
    for (const filePath of entry.ghostFiles ?? []) {
      items.push({
        kind: "ghost",
        label: `清理幽靈檔案：${filePath}`,
        description: id,
        reason: "記憶卡仍追蹤這個檔案，但磁碟上已找不到它。",
        recommendedAction: "先確認來源是否暫時不可用；經授權恢復檔案或修正不再適用的追蹤路徑。",
        affectedPath: filePath,
        cartridgeId: id,
        targetPath: memoryMainTargetPath(entry),
        severity: "warning",
      });
    }
  }

  for (const entry of index.untrackedFiles ?? []) {
    items.push({
      kind: "untracked",
      label: `歸屬檔案：${entry.filePath}`,
      description: entry.suggestedOwner ?? "未歸屬",
      reason: "這個檔案還沒有被任何記憶卡追蹤。",
      recommendedAction: "將檔案歸到合適的記憶卡。",
      affectedPath: entry.filePath,
      targetPath: entry.filePath,
      severity: "warning",
    });
  }

  for (const item of memoryWarnings.blocking) {
    if (
      ![
        "memory_compaction_due",
        "memory_compaction_invalid",
        "memory_archive_volume_due",
      ].includes(item.code)
    ) {
      continue;
    }
    const target = index.cartridges[item.target];
    items.push({
      kind: "compaction",
      label: item.label,
      description: item.code === "memory_archive_volume_due" ? "歸檔卷超限" : "壓縮治理阻擋",
      reason: item.reason,
      recommendedAction:
        item.code === "memory_archive_volume_due"
          ? "開啟下一個 archive-###.md 歸檔卷。"
          : "先彙整 Cycle Events 或拆分/歸檔主卡內容，再同步記憶卡。",
      affectedPath: item.target,
      targetPath: memoryMainTargetPath(target),
      cartridgeId: item.target,
      severity: "error",
    });
  }

  for (const item of memoryWarnings.review) {
    const target = index.cartridges[item.target];
    items.push({
      kind: "review",
      label: item.label,
      description:
        item.code === "memory_dependency_sync_partial" ? "依賴同步未完成"
          : item.code === "memory_dependency_diagnostic" ? "依賴宣告待複審"
          : item.code === "memory_child_review" ? "子卡需要檢查" : "上游影響待複審",
      reason:
        item.code === "memory_dependency_sync_partial" || item.code === "memory_dependency_diagnostic"
          ? item.reason
          : item.code === "memory_child_review"
            ? "子卡存在待檢查訊號，父卡只顯示衍生提醒。"
            : "這張記憶卡的上游依賴有變動，請判斷是否真的影響本卡內容。",
      recommendedAction:
        item.code === "memory_dependency_sync_partial"
          ? "檢查依賴重算診斷；保留上一個可信衍生值，不能視為完整同步成功。修正後僅執行已授權的同步。"
          : item.code === "memory_dependency_diagnostic"
            ? "比較來源與 Current Truth/Active Constraints 中的依賴理由；純 Relations 或 Applicable Skills 不代表傳播邊。"
            : item.code === "memory_child_review"
              ? "檢查子卡狀態；父卡內容未必需要更新。"
              : "使用 memory_deps 檢查上游來源；僅在內容或追蹤資訊需調整且已獲授權時修改，no-write 不會自動清除 stale 或同步索引。",
      affectedPath: item.target,
      targetPath: memoryMainTargetPath(target),
      cartridgeId: item.target,
      severity: "warning",
    });
  }

  for (const item of memoryWarnings.advisory) {
    const target = index.cartridges[item.target];
    items.push({
      kind: "advisory",
      label: item.label,
      description:
        item.code === "memory_granularity_advisory"
          ? "拆分建議"
          : item.code === "memory_legacy_schema"
            ? "舊卡相容提醒"
            : item.code === "memory_archive_migration"
              ? "舊式歸檔路徑"
              : "記憶卡內容建議",
      reason: item.reason,
      recommendedAction:
        item.code === "memory_granularity_advisory"
          ? "只在維護困難或語義混雜時拆卡；此提醒不阻擋提交。"
          : item.code === "memory_legacy_schema"
            ? "舊卡仍可讀取；僅在需要且已核准結構標準化時升級，一般修正維持最小範圍。"
            : item.code === "memory_archive_migration"
              ? "將 archive/001/SKILL.md 類路徑改為 archive-001.md 平面檔名。"
              : "將主體維持英文，中文保留在摘要與觸發描述。",
      affectedPath: item.target,
      targetPath: memoryMainTargetPath(target),
      cartridgeId: item.target,
      severity: "warning",
    });
  }

  for (const finding of args.contextFindings) {
    if (finding.severity === "info") continue;
    const target = finding.assets
      .map((id) => assetById.get(id))
      .find((asset) => asset?.exists && (!asset.mainFile || Boolean(asset.mainFile.activePath)));
    items.push({
      kind: "context",
      label:
        finding.severity === "error"
          ? `處理規則檔衝突：${finding.code}`
          : `檢查規則檔提醒：${finding.code}`,
      description: finding.message,
      reason: finding.explanation,
      recommendedAction: finding.recommendedAction,
      targetPath: target?.path,
      severity: finding.severity,
    });
  }

  return items;
}
