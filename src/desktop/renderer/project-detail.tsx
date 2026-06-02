import { Button, Text, Title3, ToolbarButton } from "@fluentui/react-components";
import {
  ArrowClockwise20Regular,
  Delete20Regular,
  FolderOpen20Regular,
  Pause20Regular,
  Play20Regular,
} from "@fluentui/react-icons";
import type {
  DesktopCartridgeSnapshot,
  DesktopProjectSnapshot,
} from "../../monitoring/project-snapshot";
import type { DesktopSettings } from "../project-store";
import { desktopApi } from "./desktop-api";
import { cx, useDesktopStyles } from "./desktopStyles";
import { useDetailStyles } from "./detailStyles";
import { EmptyState, ScrollPane, StatusPill, CartridgeStatusPill } from "./common";
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
  onRefresh: (action: Promise<DesktopProjectSnapshot[]>) => void;
  onSelectCartridge: (kind: IssueKind, cartridgeId: string) => void;
  onSelectUntracked: (filePath: string) => void;
  onCloseIssue: () => void;
}) {
  const styles = useDesktopStyles();
  const project = props.project;

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
            onClick={() => props.onRefresh(desktopApi.rescanProject(project.root))}
          >
            掃描
          </ToolbarButton>
          <ToolbarButton
            icon={<FolderOpen20Regular />}
            onClick={() => void desktopApi.openProject(project.root)}
          >
            開啟
          </ToolbarButton>
          <ToolbarButton
            icon={project.enabled ? <Pause20Regular /> : <Play20Regular />}
            onClick={() =>
              props.onRefresh(
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
            onClick={() => props.onRefresh(desktopApi.removeProject(project.root))}
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
        />
        <UntrackedFiles
          project={project}
          selectedFilePath={props.issueSelection?.filePath ?? null}
          onSelectUntracked={props.onSelectUntracked}
        />
      </ScrollPane>

      {props.issueSelection && (
        <IssueDrawer
          project={project}
          selection={props.issueSelection}
          onClose={props.onCloseIssue}
        />
      )}
      {props.settingsOpen && (
        <SettingsPanel
          settings={props.settings}
          onClose={() => props.onSettingsOpenChange(false)}
          onChange={props.onSettingsChange}
        />
      )}
    </aside>
  );
}

function CartridgeTable(props: {
  project: DesktopProjectSnapshot;
  selectedCartridgeId: string | null;
  activeIssue: IssueKind;
  onSelectCartridge: (kind: IssueKind, cartridgeId: string) => void;
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
}) {
  const detail = useDetailStyles();
  const kind = pickIssueForCartridge(props.cartridge, props.activeIssue);
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
          void desktopApi.openFile(props.project.root, props.cartridge.skillPath);
        }}
      >
        開啟
      </Button>
    </button>
  );
}

function formatCartridgeMetrics(cartridge: DesktopCartridgeSnapshot): string {
  return `過期 ${cartridge.staleness} · 待 ${cartridge.pendingChanges} · 幽 ${cartridge.ghostFiles}`;
}

function UntrackedFiles(props: {
  project: DesktopProjectSnapshot;
  selectedFilePath: string | null;
  onSelectUntracked: (filePath: string) => void;
}) {
  const styles = useDesktopStyles();
  const detail = useDetailStyles();
  return (
    <section className={detail.tablePanel}>
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
          {props.project.untrackedFiles.slice(0, 12).map((file) => (
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
                  void desktopApi.openFile(props.project.root, file.filePath);
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
  if (preferred === "review" && cartridge.indirectStaleness > 0) return "review";
  if (cartridge.ghostFiles > 0) return "ghost";
  if (
    cartridge.staleness > 0 ||
    cartridge.pendingChanges > 0 ||
    preferred === "blocking"
  ) {
    return "blocking";
  }
  if (cartridge.indirectStaleness > 0) return "review";
  return "blocking";
}
