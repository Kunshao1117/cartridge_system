import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Text,
  Title3,
  ToolbarButton,
} from "@fluentui/react-components";
import {
  ArrowClockwise20Regular,
  Delete20Regular,
  FolderOpen20Regular,
  Pause20Regular,
  Play20Regular,
} from "@fluentui/react-icons";
import { useState } from "react";
import type {
  DesktopCartridgeSnapshot,
  DesktopProjectSnapshot,
} from "../../monitoring/project-snapshot";
import type { DesktopOperationResult } from "../ipc-channels";
import type { DesktopSettings } from "../project-store";
import { desktopApi } from "./desktop-api";
import { cx, useDesktopStyles } from "./desktopStyles";
import { useDetailStyles } from "./detailStyles";
import {
  EmptyState,
  ScrollPane,
  StatusPill,
  CartridgeStatusPill,
  type OperationStatusKind,
} from "./common";
import { IssueDrawer } from "./issue-drawer";
import { SettingsPanel } from "./settings-panel";
import type { IssueKind, IssueSelection } from "./status";

export function ProjectDetail(props: {
  project: DesktopProjectSnapshot | undefined;
  settings: DesktopSettings;
  settingsOpen: boolean;
  issueSelection: IssueSelection | null;
  onSettingsOpenChange: (open: boolean) => void;
  onSettingsChange: (patch: Partial<DesktopSettings>) => void;
  onProjectOperation: (
    pendingMessage: string,
    action: Promise<DesktopOperationResult<DesktopProjectSnapshot[]>>,
  ) => void;
  onOperation: (
    pendingMessage: string,
    action: Promise<DesktopOperationResult>,
  ) => void;
  onLocalFeedback: (status: OperationStatusKind, message: string) => void;
  onCopyText: (text: string) => void;
  onSelectCartridge: (kind: IssueKind, cartridgeId: string) => void;
  onSelectUntracked: (filePath: string) => void;
  onCloseIssue: () => void;
}) {
  const styles = useDesktopStyles();
  const project = props.project;
  const [pendingRemove, setPendingRemove] =
    useState<DesktopProjectSnapshot | null>(null);

  function cancelRemove(): void {
    setPendingRemove(null);
    props.onLocalFeedback("cancelled", "已取消移除監控專案。");
  }

  function confirmRemove(projectToRemove: DesktopProjectSnapshot): void {
    setPendingRemove(null);
    props.onProjectOperation(
      "正在移除監控專案...",
      desktopApi.removeProject(projectToRemove.root),
    );
  }

  if (!project) {
    return (
      <aside className={styles.detailColumn}>
        <div className={styles.detailHeader}>
          <Text weight="semibold">專案詳情</Text>
        </div>
        <ScrollPane className={styles.detailScroll} ariaLabel="專案詳情">
          <EmptyState>選擇左側專案後，這裡會顯示單一專案詳情。</EmptyState>
        </ScrollPane>
      </aside>
    );
  }

  return (
    <aside className={styles.detailColumn}>
      <div className={styles.detailHeader}>
        <div className={styles.detailTitleLine}>
          <div className={styles.brandBlock}>
            <Title3 className={styles.pageTitle}>{project.name}</Title3>
            <Text className={cx(styles.ellipsis, styles.muted)}>{project.root}</Text>
          </div>
          <StatusPill status={project.status} />
        </div>
        <div className={styles.compactToolbar}>
          <ToolbarButton
            icon={<ArrowClockwise20Regular />}
            onClick={() =>
              props.onProjectOperation(
                "正在掃描專案...",
                desktopApi.rescanProject(project.root),
              )
            }
          >
            掃描
          </ToolbarButton>
          <ToolbarButton
            icon={<FolderOpen20Regular />}
            onClick={() =>
              props.onOperation(
                "正在開啟專案資料夾...",
                desktopApi.openProject(project.root),
              )
            }
          >
            開啟
          </ToolbarButton>
          <ToolbarButton
            icon={project.enabled ? <Pause20Regular /> : <Play20Regular />}
            onClick={() =>
              props.onProjectOperation(
                project.enabled ? "正在暫停監控..." : "正在恢復監控...",
                project.enabled
                  ? desktopApi.pauseProject(project.root)
                  : desktopApi.resumeProject(project.root),
              )
            }
          >
            {project.enabled ? "暫停" : "恢復"}
          </ToolbarButton>
          <ToolbarButton
            icon={<Delete20Regular />}
            onClick={() => setPendingRemove(project)}
          >
            移除
          </ToolbarButton>
        </div>
      </div>

      <ScrollPane className={styles.detailScroll} ariaLabel={`${project.name} 詳情`}>
        <CartridgeTable
          project={project}
          selectedCartridgeId={props.issueSelection?.cartridgeId ?? null}
          activeIssue={props.issueSelection?.kind ?? "blocking"}
          onSelectCartridge={props.onSelectCartridge}
          onOperation={props.onOperation}
        />
        <UntrackedFiles
          project={project}
          selectedFilePath={props.issueSelection?.filePath ?? null}
          onSelectUntracked={props.onSelectUntracked}
          onOperation={props.onOperation}
        />
      </ScrollPane>

      {props.issueSelection && (
        <IssueDrawer
          project={project}
          selection={props.issueSelection}
          onClose={props.onCloseIssue}
          onOperation={props.onOperation}
          onCopyText={props.onCopyText}
        />
      )}
      {props.settingsOpen && (
        <SettingsPanel
          settings={props.settings}
          onClose={() => props.onSettingsOpenChange(false)}
          onChange={props.onSettingsChange}
        />
      )}
      <RemoveProjectDialog
        project={pendingRemove}
        onCancel={cancelRemove}
        onConfirm={confirmRemove}
      />
    </aside>
  );
}

function CartridgeTable(props: {
  project: DesktopProjectSnapshot;
  selectedCartridgeId: string | null;
  activeIssue: IssueKind;
  onSelectCartridge: (kind: IssueKind, cartridgeId: string) => void;
  onOperation: (
    pendingMessage: string,
    action: Promise<DesktopOperationResult>,
  ) => void;
}) {
  const styles = useDesktopStyles();
  const detail = useDetailStyles();
  return (
    <section className={cx(detail.tablePanel, detail.cartridgePanel)}>
      <div className={detail.tableHeader}>
        <Text weight="semibold">記憶卡匣</Text>
        <Text size={200} className={styles.muted}>
          {props.project.counts.cartridges} 張卡匣，依過期程度排序；點選列可查看原因。
        </Text>
      </div>
      <div className={detail.cartridgeListViewport}>
        <div className={detail.cartridgeGrid} role="list" aria-label="記憶卡匣">
          <div className={detail.cartridgeHeaderRow}>
            <span>卡匣</span>
            <span>狀態</span>
            <span>指標</span>
            <span>操作</span>
          </div>
          {props.project.cartridges.map((cartridge) => (
            <CartridgeRow
              key={cartridge.id}
              project={props.project}
              cartridge={cartridge}
              selected={cartridge.id === props.selectedCartridgeId}
              activeIssue={props.activeIssue}
              onSelect={props.onSelectCartridge}
              onOperation={props.onOperation}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function CartridgeRow(props: {
  project: DesktopProjectSnapshot;
  cartridge: DesktopCartridgeSnapshot;
  selected: boolean;
  activeIssue: IssueKind;
  onSelect: (kind: IssueKind, cartridgeId: string) => void;
  onOperation: (
    pendingMessage: string,
    action: Promise<DesktopOperationResult>,
  ) => void;
}) {
  const detail = useDetailStyles();
  const kind = pickIssueForCartridge(props.cartridge, props.activeIssue);
  const hasMainFileConflict = props.cartridge.mainFileType === "conflict";
  return (
    <button
      className={cx(
        detail.cartridgeRow,
        props.selected && detail.cartridgeRowSelected,
      )}
      type="button"
      role="listitem"
      onClick={() => props.onSelect(kind, props.cartridge.id)}
    >
      <Text weight="semibold" className={detail.cartridgeNameCell} title={props.cartridge.id}>
        {props.cartridge.id}
      </Text>
      <CartridgeStatusPill cartridge={props.cartridge} />
      <span className={detail.cartridgeMetricSummary}>
        {formatCartridgeMetrics(props.cartridge)}
      </span>
      <Button
        size="small"
        className={detail.tableButton}
        onClick={(event) => {
          event.stopPropagation();
          if (hasMainFileConflict) {
            props.onSelect("blocking", props.cartridge.id);
            return;
          }
          props.onOperation(
            "正在開啟記憶卡...",
            desktopApi.openFile(
              props.project.root,
              props.cartridge.mainFilePath ?? props.cartridge.skillPath,
            ),
          );
        }}
      >
        {hasMainFileConflict ? "衝突" : "開啟"}
      </Button>
    </button>
  );
}

function formatCartridgeMetrics(cartridge: DesktopCartridgeSnapshot): string {
  const compaction = cartridge.compaction;
  const base =
    `主檔 ${cartridge.mainFileType} · 品質 ${cartridge.contentQualityLabel} · ` +
    `過期 ${cartridge.staleness} · 待 ${cartridge.pendingChanges} · 幽 ${cartridge.ghostFiles}`;
  if (!compaction) return base;
  return `${base} · ${Math.ceil(compaction.sizeBytes / 1024)}KB · ${compaction.lineCount} 行 · 週期 ${compaction.cycleEventCount}/${compaction.cycleEventLimit}`;
}

function UntrackedFiles(props: {
  project: DesktopProjectSnapshot;
  selectedFilePath: string | null;
  onSelectUntracked: (filePath: string) => void;
  onOperation: (
    pendingMessage: string,
    action: Promise<DesktopOperationResult>,
  ) => void;
}) {
  const styles = useDesktopStyles();
  const detail = useDetailStyles();
  return (
    <section className={cx(detail.tablePanel, detail.untrackedPanel)}>
      <div className={detail.tableHeader}>
        <Text weight="semibold">未歸屬檔案</Text>
        <Text size={200} className={styles.muted}>
          新檔案尚未被任何記憶卡追蹤；點選列可查看歸屬導引。
        </Text>
      </div>
      {props.project.untrackedFiles.length === 0 ? (
        <EmptyState>目前沒有未歸屬檔案。</EmptyState>
      ) : (
        <div className={detail.untrackedList}>
          {props.project.untrackedFiles.map((file) => (
            <button
              key={file.filePath}
              type="button"
              className={cx(
                detail.fileRow,
                file.filePath === props.selectedFilePath && detail.fileRowSelected,
              )}
              onClick={() => props.onSelectUntracked(file.filePath)}
            >
              <div className={styles.brandBlock}>
                <Text weight="semibold" className={detail.pathCell}>
                  {file.filePath}
                </Text>
                <Text size={200} className={styles.muted}>
                  建議歸屬：{file.suggestedOwner ?? "尚無建議"}
                </Text>
              </div>
              <Button
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  props.onOperation(
                    "正在開啟未歸屬檔案...",
                    desktopApi.openFile(props.project.root, file.filePath),
                  );
                }}
              >
                開啟
              </Button>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function pickIssueForCartridge(
  cartridge: DesktopCartridgeSnapshot,
  preferred: IssueKind,
): IssueKind {
  if (preferred === "ghost" && cartridge.ghostFiles > 0) return "ghost";
  if (
    preferred === "review" &&
    (cartridge.indirectStaleness > 0 ||
      cartridge.legacyCompatibility ||
      cartridge.contentQualityStatus !== "complete" ||
      hasCompactionAdvisory(cartridge))
  ) {
    return "review";
  }
  if (cartridge.ghostFiles > 0) return "ghost";
  if (
    cartridge.mainFileType === "conflict" ||
    cartridge.mainFileType === "missing" ||
    cartridge.contentQualityStatus === "conflict" ||
    cartridge.compaction?.needsCompaction ||
    cartridge.staleness > 0 ||
    cartridge.pendingChanges > 0 ||
    preferred === "blocking"
  ) {
    return "blocking";
  }
  if (
    cartridge.indirectStaleness > 0 ||
    cartridge.legacyCompatibility ||
    cartridge.contentQualityStatus !== "complete"
  ) {
    return "review";
  }
  if (hasCompactionAdvisory(cartridge)) return "review";
  return "blocking";
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

function RemoveProjectDialog(props: {
  project: DesktopProjectSnapshot | null;
  onCancel: () => void;
  onConfirm: (project: DesktopProjectSnapshot) => void;
}) {
  return (
    <Dialog
      open={Boolean(props.project)}
      onOpenChange={(_event, data) => {
        if (!data.open && props.project) props.onCancel();
      }}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>移除監控專案？</DialogTitle>
          <DialogContent>
            {props.project
              ? `將停止監控 ${props.project.name}（${props.project.root}）。專案檔案不會被刪除。`
              : ""}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={props.onCancel}>
              取消
            </Button>
            <Button
              appearance="primary"
              onClick={() => props.project && props.onConfirm(props.project)}
            >
              移除
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
