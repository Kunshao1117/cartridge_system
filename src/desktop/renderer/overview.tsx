import {
  Button,
  Text,
  Title3,
  Toolbar,
  ToolbarButton,
  Tooltip,
} from "@fluentui/react-components";
import {
  Add20Regular,
  ArrowClockwise20Regular,
  CheckmarkCircle20Regular,
  Dismiss20Regular,
  Info20Regular,
  Warning20Regular,
} from "@fluentui/react-icons";
import type { DesktopProjectSnapshot } from "../../monitoring/project-snapshot";
import { EmptyState, ScrollPane } from "./common";
import { cx, toneClass, useDesktopStyles } from "./desktopStyles";
import type { ActionItem, IssueKind } from "./status";

export function Overview(props: {
  projects: DesktopProjectSnapshot[];
  project: DesktopProjectSnapshot | undefined;
  actionItems: ActionItem[];
  activeIssue: IssueKind;
  showIntro: boolean;
  onSelectIssue: (issue: IssueKind) => void;
  onDismissIntro: () => void;
  onAddProjects: () => void;
  onRescanAll: () => void;
}) {
  const styles = useDesktopStyles();
  return (
    <main className={styles.centerColumn}>
      <div className={styles.centerHeader}>
        <div className={styles.brandBlock}>
          <Title3 className={styles.pageTitle}>
            {props.project ? `${props.project.name} 待處理` : "待處理"}
          </Title3>
          <Text className={styles.muted}>
            {props.project
              ? `${props.projects.length} 個專案背景監控中；目前顯示這個專案的處理入口。`
              : "加入監控專案後，這裡會顯示目前專案的處理入口。"}
          </Text>
        </div>
        <Toolbar className={styles.compactToolbar}>
          <ToolbarButton
            icon={<ArrowClockwise20Regular />}
            onClick={props.onRescanAll}
          >
            重新掃描
          </ToolbarButton>
        </Toolbar>
      </div>

      <ScrollPane className={styles.centerScroll} ariaLabel="監控總覽">
        {props.showIntro && <IntroStrip onDismiss={props.onDismissIntro} />}
        {props.projects.length === 0 ? (
          <EmptyProjectPanel onAddProjects={props.onAddProjects} />
        ) : (
          <ActionPanel
            actionItems={props.actionItems}
            activeIssue={props.activeIssue}
            onSelectIssue={props.onSelectIssue}
          />
        )}
      </ScrollPane>
    </main>
  );
}

function IntroStrip(props: { onDismiss: () => void }) {
  const styles = useDesktopStyles();
  return (
    <div className={styles.introStrip}>
      <Info20Regular />
      <div className={styles.introContent}>
        <Text weight="semibold">此工具在背景追蹤專案記憶狀態</Text>
        <Text size={200} className={styles.muted}>
          左側選專案，中間選問題類型，右側開啟記憶卡、檔案與處理導引。
        </Text>
      </div>
      <Tooltip content="隱藏說明" relationship="label">
        <Button
          icon={<Dismiss20Regular />}
          appearance="subtle"
          size="small"
          onClick={props.onDismiss}
        />
      </Tooltip>
    </div>
  );
}

function EmptyProjectPanel(props: { onAddProjects: () => void }) {
  const styles = useDesktopStyles();
  return (
    <div className={styles.panel}>
      <EmptyState>
        <div>
          <Text weight="semibold">尚未監控任何專案</Text>
          <br />
          <Text className={styles.muted}>
            選擇一個或多個專案資料夾後，這裡會顯示記憶卡健康狀態。
          </Text>
          <div style={{ marginTop: 12 }}>
            <Button
              icon={<Add20Regular />}
              appearance="primary"
              onClick={props.onAddProjects}
            >
              加入監控專案
            </Button>
          </div>
        </div>
      </EmptyState>
    </div>
  );
}

function ActionPanel(props: {
  actionItems: ActionItem[];
  activeIssue: IssueKind;
  onSelectIssue: (issue: IssueKind) => void;
}) {
  const styles = useDesktopStyles();
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <Text weight="semibold">處理順序</Text>
        <Text size={200} className={styles.muted}>
          點選一個問題類型，右側會顯示對應記憶卡、檔案與處理導引。
        </Text>
      </div>
      <div className={styles.actionList}>
        {props.actionItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={cx(
              styles.actionRow,
              item.key === props.activeIssue && styles.actionRowSelected,
            )}
            onClick={() => props.onSelectIssue(item.key)}
          >
            {item.kind === "ok" ? <CheckmarkCircle20Regular /> : <Warning20Regular />}
            <div className={styles.brandBlock}>
              <Text weight="semibold">{item.title}</Text>
              <Text size={200} className={styles.muted}>
                {item.description}
              </Text>
            </div>
            <span className={cx(styles.statusPill, toneClass(styles, item.tone))}>
              {item.count}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
