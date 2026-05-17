import type { ContextAuditFinding, ContextInventory } from "./context-types.js";
import type { CartridgeIndex } from "./types.js";

export type ActionItemKind = "stale" | "ghost" | "untracked" | "context";

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
  const assetById = new Map(args.inventory.assets.map((asset) => [asset.id, asset]));

  for (const [id, entry] of Object.entries(args.index.cartridges)) {
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

  for (const entry of args.index.untrackedFiles ?? []) {
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
