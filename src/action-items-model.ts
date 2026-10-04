import type { ContextAuditFinding, ContextInventory } from "./context-types.js";
import { createVisibleCartridgeIndex } from "./visible-index.js";
import { classifyMemoryWarnings, type MemoryWarningItem } from "./staleness.js";
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
  const mainType = entry?.mainFile?.type ?? entry?.mainFileType;
  if (!entry || mainType === "conflict" || mainType === "missing" || entry.idConflictPaths?.length) {
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
        label: `複審缺失來源：${filePath}`,
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

  for (const item of [...memoryWarnings.blocking, ...memoryWarnings.review, ...memoryWarnings.advisory]) {
    // These warnings already have richer per-file entries above.
    if (item.code === "memory_stale" || item.code === "memory_ghost_files" || item.code === "memory_untracked_files") continue;
    const target = index.cartridges[item.target];
    if (item.code === "memory_main_file_conflict" || item.code === "memory_main_file_missing") {
      const expectedCode = item.code === "memory_main_file_conflict" ? "context_memory_main_file_conflict" : "context_memory_main_file_missing";
      const targetPaths = new Set([target?.skillPath, target?.skillPath.replace(/\/[^/]*$/, ""), ...(target?.mainFile?.candidatePaths ?? [])]);
      if (args.contextFindings.some(finding => finding.code === expectedCode && (
        finding.paths?.some(file => targetPaths.has(file)) ||
        finding.assets.some(id => {
          const assetPath = assetById.get(id)?.path;
          return assetPath !== undefined && targetPaths.has(assetPath);
        })
      ))) continue;
    }
    const guidance = warningGuidance(item);
    items.push({
      kind: item.tier === "blocking" ? (item.code.includes("compaction") || item.code === "memory_archive_volume_due" ? "compaction" : "review") : item.tier === "advisory" ? "advisory" : "review",
      label: item.label,
      description: guidance.description,
      reason: item.reason,
      recommendedAction: guidance.action,
      affectedPath: item.target,
      targetPath: memoryMainTargetPath(target),
      cartridgeId: item.target,
      severity: item.tier === "blocking" ? "error" : "warning",
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

function warningGuidance(item: MemoryWarningItem): { description: string; action: string } {
  switch (item.code) {
    case "memory_main_file_conflict": return { description: "雙主檔衝突", action: "比較候選主檔與授權後再處理，不自動選邊或遷移。" };
    case "memory_main_file_missing": return { description: "缺少記憶主檔", action: "確認需恢復的 MEMORY.md 或 legacy SKILL.md，僅執行已授權的修正。" };
    case "memory_quality_conflict": return { description: "品質衝突", action: "比較主卡主張、來源及驗證證據，確認衝突後僅執行已授權的修正。" };
    case "memory_quality_missing_fields": return { description: "品質缺欄位", action: "依缺漏原因檢查主卡 frontmatter 欄位與來源，確認後補齊已授權的內容。" };
    case "memory_quality_missing_sections": return { description: "品質缺段落", action: "依缺漏原因檢查主卡段落與來源，確認後補齊已授權的內容。" };
    case "memory_quality_pending_review": return { description: "品質證據待複審", action: "檢查 verification_status 與驗證證據；不可只為清除警告宣告已驗證。" };
    case "memory_quality_superseded": return { description: "確認已取代主卡", action: "確認替代卡、作用範圍與目前來源，再決定需授權的追蹤調整。" };
    case "memory_dependency_sync_partial": return { description: "依賴同步未完成", action: "檢查依賴重算診斷；保留上一個可信衍生值，不能視為完整同步成功。修正後僅執行已授權的同步。" };
    case "memory_dependency_diagnostic": return { description: "依賴宣告待複審", action: "比較來源與 Current Truth/Active Constraints 中的依賴理由；純 Relations 或 Applicable Skills 不代表傳播邊。" };
    case "memory_child_review": return { description: "子卡需要檢查", action: "檢查原因列出的子卡；父卡內容未必需要更新。" };
    case "memory_indirect_stale": return { description: "上游影響待複審", action: "使用 memory_deps 檢查上游來源；僅在內容或追蹤資訊需調整且已獲授權時修改，no-write 不會自動清除 stale 或同步索引。" };
    case "memory_compaction_due":
    case "memory_compaction_invalid": return { description: "壓縮治理阻擋", action: "先確認需彙整的 Cycle Events 或主卡內容，再執行已授權的整理與同步。" };
    case "memory_archive_volume_due": return { description: "歸檔卷超限", action: "確認原因列出的歸檔卷，經授權後開啟下一個 archive-###.md 歸檔卷。" };
    case "memory_main_file_legacy":
    case "memory_legacy_schema": return { description: "舊卡相容提醒", action: "舊卡仍可讀取；僅在需要且已核准結構標準化時升級，一般修正維持最小範圍。" };
    case "memory_archive_migration": return { description: "舊式歸檔路徑", action: "確認舊歸檔引用，僅在已授權遷移時改為 archive-001.md 平面檔名。" };
    case "memory_language_ratio": return { description: "記憶卡語言建議", action: "檢查主體語言，中文保留在摘要與觸發描述；需要且已授權才調整。" };
    case "memory_granularity_advisory": return { description: "拆分建議", action: "只在維護困難或語義混雜時拆卡；此提醒不阻擋提交。" };
    default: return { description: item.label, action: "依具體原因比較來源與記憶卡；僅執行已授權的修正，不為清除警告直接改卡。" };
  }
}
