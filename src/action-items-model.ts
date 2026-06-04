import type { ContextAuditFinding, ContextInventory } from "./context-types.js";
import { createVisibleCartridgeIndex } from "./index-manager.js";
import { classifyMemoryWarnings } from "./staleness.js";
import type { CartridgeIndex } from "./types.js";

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
        label: `更新記憶卡：${id}`,
        description: `過期指數 ${entry.staleness}`,
        reason: "這張記憶卡追蹤的檔案已變更，AI 可能讀到舊說明。",
        recommendedAction: "開啟 SKILL.md 更新內容後執行 memory_commit。",
        targetPath: entry.skillPath,
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
        recommendedAction: "查看修復說明，確認要從記憶卡移除或恢復檔案。",
        affectedPath: filePath,
        cartridgeId: id,
        targetPath: entry.skillPath,
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
      targetPath: target?.skillPath,
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
        item.code === "memory_child_review" ? "子卡需要檢查" : "上游影響待複審",
      reason:
        item.code === "memory_child_review"
          ? "子卡存在待檢查訊號，父卡只顯示衍生提醒。"
          : "這張記憶卡的上游依賴有變動，請判斷是否真的影響本卡內容。",
      recommendedAction:
        item.code === "memory_child_review"
          ? "檢查子卡狀態；父卡內容未必需要更新。"
          : "使用 memory_deps 檢查上游來源；只有內容失真時才更新記憶卡。",
      affectedPath: item.target,
      targetPath: target?.skillPath,
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
            ? "舊卡待懶升級"
            : item.code === "memory_archive_migration"
              ? "舊式歸檔路徑"
              : "記憶卡內容建議",
      reason: item.reason,
      recommendedAction:
        item.code === "memory_granularity_advisory"
          ? "只在維護困難或語義混雜時拆卡；此提醒不阻擋提交。"
          : item.code === "memory_legacy_schema"
            ? "下次修改此卡時升級為 schema v2。"
            : item.code === "memory_archive_migration"
              ? "將 archive/001/SKILL.md 類路徑改為 archive-001.md 平面檔名。"
              : "將主體維持英文，中文保留在摘要與觸發描述。",
      affectedPath: item.target,
      targetPath: target?.skillPath,
      cartridgeId: item.target,
      severity: "warning",
    });
  }

  for (const finding of args.contextFindings) {
    if (finding.severity === "info") continue;
    const target = finding.assets
      .map((id) => assetById.get(id))
      .find((asset) => asset?.exists);
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
