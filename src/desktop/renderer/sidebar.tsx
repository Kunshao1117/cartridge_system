import { Button, Text, Title3, Tooltip } from "@fluentui/react-components";
import { Add20Regular, Settings20Regular } from "@fluentui/react-icons";
import type { DesktopProjectSnapshot } from "../../monitoring/project-snapshot";
import { cx, useDesktopStyles } from "./desktopStyles";
import { EmptyState, ScrollPane, StatusPill } from "./common";

export function Sidebar(props: {
  projects: DesktopProjectSnapshot[];
  selectedId: string | null;
  onSelectProject: (projectId: string) => void;
  onAddProjects: () => void;
  onToggleSettings: () => void;
}) {
  const styles = useDesktopStyles();
  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <div className={styles.brandBlock}>
          <Title3 className={styles.brandTitle}>Cartridge</Title3>
          <Text size={200} className={styles.muted}>
            跨工具記憶監控
          </Text>
        </div>
        <Tooltip content="加入監控專案" relationship="label">
          <Button
            icon={<Add20Regular />}
            appearance="primary"
            onClick={props.onAddProjects}
          />
        </Tooltip>
      </div>

      <ScrollPane className={styles.projectList} ariaLabel="監控專案清單">
        {props.projects.map((project) => (
          <ProjectListRow
            key={project.id}
            project={project}
            selected={project.id === props.selectedId}
            onSelect={() => props.onSelectProject(project.id)}
          />
        ))}
        {props.projects.length === 0 && (
          <EmptyState>尚未加入專案。請按上方加號選擇要監控的資料夾。</EmptyState>
        )}
      </ScrollPane>

      <div className={styles.sidebarFooter}>
        <Button
          icon={<Settings20Regular />}
          appearance="subtle"
          onClick={props.onToggleSettings}
        >
          設定
        </Button>
      </div>
    </aside>
  );
}

function ProjectListRow(props: {
  project: DesktopProjectSnapshot;
  selected: boolean;
  onSelect: () => void;
}) {
  const styles = useDesktopStyles();
  const project = props.project;
  return (
    <button
      className={cx(
        styles.projectRow,
        styles.projectRowHover,
        props.selected && styles.projectRowSelected,
      )}
      type="button"
      onClick={props.onSelect}
    >
      <div className={styles.projectTitleLine}>
        <Text weight="semibold" className={styles.ellipsis}>
          {project.name}
        </Text>
        <StatusPill status={project.status} />
      </div>
      <div className={styles.projectMetaLine}>
        <Text size={200} className={cx(styles.ellipsis, styles.muted)}>
          {project.root}
        </Text>
        <div className={styles.countLine}>
          <span className={styles.countPill}>阻塞 {project.counts.blocking}</span>
          <span className={styles.countPill}>
            未歸屬 {project.counts.untrackedFiles}
          </span>
        </div>
      </div>
    </button>
  );
}
