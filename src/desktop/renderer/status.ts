import type {
  DesktopCartridgeSnapshot,
  DesktopProjectSnapshot,
} from "../../monitoring/project-snapshot";

export type Tone = "success" | "warning" | "danger" | "neutral";

export type IssueKind = "blocking" | "untracked" | "ghost" | "review";

export interface IssueSelection {
  kind: IssueKind;
  cartridgeId: string | null;
  filePath: string | null;
}

export interface ActionItem {
  key: IssueKind;
  kind: "ok" | "warning";
  title: string;
  description: string;
  count: number;
  tone: Tone;
}

export function buildProjectActionItems(
  project: DesktopProjectSnapshot | undefined,
): ActionItem[] {
  if (!project) {
    return [
      {
        key: "blocking",
        kind: "ok",
        title: "先選擇要處理的專案",
        description: "左側選取專案後，這裡會列出該專案的記憶處理順序。",
        count: 0,
        tone: "neutral",
      },
    ];
  }
  const counts = project.counts;
  return [
    {
      key: "blocking",
      kind: counts.blocking > 0 ? "warning" : "ok",
      title: counts.blocking > 0 ? "先處理阻塞記憶卡" : "沒有阻塞記憶卡",
      description:
        counts.blocking > 0
          ? "找出哪張記憶卡因檔案變動、雙主檔、缺主檔或壓縮門檻而需要處理。"
          : "這個專案目前沒有會阻擋 AI 使用記憶的問題。",
      count: counts.blocking,
      tone: counts.blocking > 0 ? "danger" : "success",
    },
    {
      key: "untracked",
      kind: counts.untrackedFiles > 0 ? "warning" : "ok",
      title: counts.untrackedFiles > 0 ? "歸屬新檔案" : "沒有未歸屬檔案",
      description:
        counts.untrackedFiles > 0
          ? "這個專案有新檔案尚未被記憶卡追蹤，應該決定要歸到哪張卡。"
          : "這個專案目前沒有需要分配歸屬的新檔案。",
      count: counts.untrackedFiles,
      tone: counts.untrackedFiles > 0 ? "warning" : "success",
    },
    {
      key: "ghost",
      kind: counts.ghostFiles > 0 ? "warning" : "ok",
      title: counts.ghostFiles > 0 ? "清理幽靈檔案" : "沒有幽靈檔案",
      description:
        counts.ghostFiles > 0
          ? "這個專案的記憶卡仍追蹤已不存在的路徑，應該開卡清理。"
          : "這個專案目前沒有已刪除但仍被追蹤的檔案。",
      count: counts.ghostFiles,
      tone: counts.ghostFiles > 0 ? "danger" : "success",
    },
    {
      key: "review",
      kind: counts.review > 0 || counts.advisory > 0 ? "warning" : "ok",
      title:
        counts.review > 0 || counts.advisory > 0
          ? "查看複審與建議"
          : "沒有複審提醒",
      description:
        counts.review > 0 || counts.advisory > 0
          ? "這個專案有上游影響、舊主檔、品質待審、語言比例或拆分建議，建議確認但不一定要立刻修。"
          : "這個專案目前沒有需要額外確認的間接影響。",
      count: counts.review + counts.advisory,
      tone: counts.review > 0 || counts.advisory > 0 ? "warning" : "success",
    },
  ];
}

export function getProjectStatus(status: DesktopProjectSnapshot["status"]): {
  label: string;
  tone: Tone;
} {
  const map = {
    ready: { label: "健康", tone: "success" as const },
    warning: { label: "複審", tone: "warning" as const },
    blocked: { label: "阻塞", tone: "danger" as const },
    paused: { label: "暫停", tone: "neutral" as const },
    error: { label: "錯誤", tone: "danger" as const },
  };
  return map[status];
}

export function getCartridgeStatus(cartridge: DesktopCartridgeSnapshot): {
  label: string;
  tone: Tone;
} {
  if (
    cartridge.mainFileType === "conflict" ||
    cartridge.mainFileType === "missing" ||
    cartridge.contentQualityStatus === "conflict"
  ) {
    return { label: "阻塞", tone: "danger" };
  }
  if (cartridge.compaction?.needsCompaction) {
    return { label: "阻塞", tone: "danger" };
  }
  if (
    cartridge.ghostFiles > 0 ||
    cartridge.pendingChanges > 0 ||
    cartridge.staleness > 0
  ) {
    return { label: "阻塞", tone: "danger" };
  }
  if (
    cartridge.indirectStaleness > 0 ||
    cartridge.legacyCompatibility ||
    cartridge.contentQualityStatus !== "complete"
  ) {
    return { label: "複審", tone: "warning" };
  }
  if (hasCompactionAdvisory(cartridge)) {
    return { label: "建議", tone: "warning" };
  }
  return { label: "健康", tone: "success" };
}

export function cartridgesForIssue(
  project: DesktopProjectSnapshot,
  issue: IssueKind,
): DesktopCartridgeSnapshot[] {
  if (issue === "review") {
    return project.cartridges.filter(
      (item) =>
        item.indirectStaleness > 0 ||
        item.legacyCompatibility ||
        item.contentQualityStatus !== "complete" ||
        hasCompactionAdvisory(item),
    );
  }
  if (issue === "ghost") {
    return project.cartridges.filter((item) => item.ghostFiles > 0);
  }
  if (issue === "blocking") {
    return project.cartridges.filter(
      (item) =>
        item.staleness > 0 ||
        item.pendingChanges > 0 ||
        item.ghostFiles > 0 ||
        item.mainFileType === "conflict" ||
        item.mainFileType === "missing" ||
        item.contentQualityStatus === "conflict" ||
        Boolean(item.compaction?.needsCompaction),
    );
  }
  return [];
}

function hasCompactionAdvisory(cartridge: DesktopCartridgeSnapshot): boolean {
  return Boolean(
    cartridge.compaction?.isLegacy ||
      cartridge.legacyCompatibility ||
      cartridge.contentQualityStatus !== "complete" ||
      cartridge.compaction?.reasons.includes("highChineseRatio") ||
      cartridge.trackedFiles.length > 8 ||
      (cartridge.compaction?.archiveMigrationWarnings?.length ?? 0) > 0,
  );
}
