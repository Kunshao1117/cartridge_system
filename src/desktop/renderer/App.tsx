import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { useEffect, useMemo, useState } from "react";
import type {
  DesktopCartridgeSnapshot,
  DesktopProjectSnapshot,
} from "../../monitoring/project-snapshot";
import type { DesktopOperationResult } from "../ipc-channels";
import type { DesktopSettings } from "../project-store";
import { desktopApi } from "./desktop-api";
import { useDesktopStyles } from "./desktopStyles";
import { Overview } from "./overview";
import { ProjectDetail } from "./project-detail";
import { Sidebar } from "./sidebar";
import {
  OperationStatusBar,
  type OperationStatusKind,
} from "./common";
import {
  buildProjectActionItems,
  cartridgesForIssue,
  type IssueKind,
  type IssueSelection,
} from "./status";

const defaultSettings: DesktopSettings = {
  minimizeToTray: true,
  notificationsEnabled: true,
  showIntro: true,
};

interface OperationState {
  status: OperationStatusKind;
  message: string;
}

export function App() {
  const styles = useDesktopStyles();
  const [projects, setProjects] = useState<DesktopProjectSnapshot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settings, setSettings] = useState<DesktopSettings>(defaultSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeIssue, setActiveIssue] = useState<IssueKind>("blocking");
  const [issueSelection, setIssueSelection] = useState<IssueSelection | null>(
    null,
  );
  const [operation, setOperation] = useState<OperationState>({
    status: "idle",
    message: "準備就緒。",
  });

  useEffect(() => {
    void Promise.all([desktopApi.listProjects(), desktopApi.getSettings()]).then(
      ([snapshots, nextSettings]) => {
        applyProjectSnapshots(snapshots);
        setSettings(nextSettings);
      },
    ).catch((error) => {
      showLocalFeedback("error", `載入桌面監控狀態失敗：${formatErrorMessage(error)}`);
    });
    const disposeSnapshots = desktopApi.onSnapshotsChanged((snapshots) => {
      applyProjectSnapshots(snapshots);
    });
    const disposeSettingsRequest = desktopApi.onSettingsRequested(() => {
      setSettingsOpen(true);
      showLocalFeedback("success", "已開啟設定。");
    });
    return () => {
      disposeSnapshots();
      disposeSettingsRequest();
    };
  }, []);

  const selected = projects.find((project) => project.id === selectedId) ?? projects[0];
  const actionItems = useMemo(() => buildProjectActionItems(selected), [selected]);

  useEffect(() => {
    if (!selected) {
      setIssueSelection(null);
      return;
    }
    setIssueSelection((current) =>
      current ? normalizeIssueSelection(selected, current.kind, current) : null,
    );
  }, [selected?.id, selected?.lastScanned]);

  function applyProjectSnapshots(snapshots: DesktopProjectSnapshot[]): void {
    setProjects(snapshots);
    setSelectedId((current) =>
      current && snapshots.some((project) => project.id === current)
        ? current
        : snapshots[0]?.id ?? null,
    );
  }

  function runProjectOperation(
    pendingMessage: string,
    action: Promise<DesktopOperationResult<DesktopProjectSnapshot[]>>,
  ): void {
    void runOperation(pendingMessage, action, applyProjectSnapshots);
  }

  function runDesktopOperation(
    pendingMessage: string,
    action: Promise<DesktopOperationResult>,
  ): void {
    void runOperation(pendingMessage, action);
  }

  async function runOperation<T>(
    pendingMessage: string,
    action: Promise<DesktopOperationResult<T>>,
    onData?: (data: T) => void,
  ): Promise<void> {
    setOperation({ status: "pending", message: pendingMessage });
    try {
      const result = await action;
      if (result.data !== undefined && onData) onData(result.data);
      setOperation({ status: result.outcome, message: result.message });
    } catch (error) {
      setOperation({
        status: "error",
        message: `操作失敗：${formatErrorMessage(error)}`,
      });
    }
  }

  function updateSetting(patch: Partial<DesktopSettings>): void {
    void runOperation("正在更新設定...", desktopApi.updateSettings(patch), setSettings);
  }

  function showLocalFeedback(status: OperationStatusKind, message: string): void {
    setOperation({ status, message });
  }

  function selectProject(projectId: string): void {
    const project = projects.find((item) => item.id === projectId);
    setSelectedId(projectId);
    showLocalFeedback("success", `已選取專案：${project?.name ?? projectId}。`);
  }

  function selectIssue(issue: IssueKind): void {
    setActiveIssue(issue);
    if (selected) {
      setIssueSelection(normalizeIssueSelection(selected, issue, null));
    }
    showLocalFeedback("success", `已切換處理類型：${issueLabel(issue)}。`);
  }

  function selectCartridge(kind: IssueKind, cartridgeId: string): void {
    setActiveIssue(kind);
    setIssueSelection({ kind, cartridgeId, filePath: null });
    showLocalFeedback("success", `已選取記憶卡匣：${cartridgeId}。`);
  }

  function selectUntracked(filePath: string): void {
    setActiveIssue("untracked");
    setIssueSelection({ kind: "untracked", cartridgeId: null, filePath });
    showLocalFeedback("success", `已選取未歸屬檔案：${filePath}。`);
  }

  function setSettingsPanel(open: boolean): void {
    setSettingsOpen(open);
    showLocalFeedback("success", open ? "已開啟設定。" : "已關閉設定。");
  }

  function toggleSettings(): void {
    setSettingsPanel(!settingsOpen);
  }

  function closeIssue(): void {
    setIssueSelection(null);
    showLocalFeedback("success", "已關閉處理導引。");
  }

  async function copyText(text: string): Promise<void> {
    setOperation({ status: "pending", message: "正在複製提示..." });
    try {
      if (!navigator.clipboard) {
        throw new Error("剪貼簿 API 不可用");
      }
      await navigator.clipboard.writeText(text);
      showLocalFeedback("success", "提示已複製到剪貼簿。");
    } catch (error) {
      showLocalFeedback("error", `複製提示失敗：${formatErrorMessage(error)}`);
    }
  }

  return (
    <FluentProvider theme={webLightTheme}>
      <div className={styles.appFrame}>
        <div className={styles.shell}>
          <Sidebar
            projects={projects}
            selectedId={selected?.id ?? null}
            onSelectProject={selectProject}
            onAddProjects={() =>
              runProjectOperation("正在加入監控專案...", desktopApi.addProjects())
            }
            onToggleSettings={toggleSettings}
          />
          <Overview
            projects={projects}
            project={selected}
            actionItems={actionItems}
            activeIssue={activeIssue}
            showIntro={settings.showIntro}
            onSelectIssue={selectIssue}
            onDismissIntro={() => updateSetting({ showIntro: false })}
            onAddProjects={() =>
              runProjectOperation("正在加入監控專案...", desktopApi.addProjects())
            }
            onRescanAll={() =>
              runProjectOperation(
                "正在重新掃描全部專案...",
                desktopApi.rescanAll(),
              )
            }
          />
          <ProjectDetail
            project={selected}
            settings={settings}
            settingsOpen={settingsOpen}
            issueSelection={issueSelection}
            onSettingsOpenChange={setSettingsPanel}
            onSettingsChange={updateSetting}
            onProjectOperation={runProjectOperation}
            onOperation={runDesktopOperation}
            onLocalFeedback={showLocalFeedback}
            onCopyText={(text) => void copyText(text)}
            onSelectCartridge={selectCartridge}
            onSelectUntracked={selectUntracked}
            onCloseIssue={closeIssue}
          />
        </div>
        <OperationStatusBar
          status={operation.status}
          message={operation.message}
        />
      </div>
    </FluentProvider>
  );
}

function normalizeIssueSelection(
  project: DesktopProjectSnapshot,
  issue: IssueKind,
  current: IssueSelection | null,
): IssueSelection | null {
  if (issue === "untracked") {
    const file = current?.filePath
      ? project.untrackedFiles.find((item) => item.filePath === current.filePath)
      : project.untrackedFiles[0];
    return file
      ? { kind: "untracked", cartridgeId: null, filePath: file.filePath }
      : null;
  }
  const cartridge = pickCartridge(project, issue, current?.cartridgeId ?? null);
  return cartridge ? { kind: issue, cartridgeId: cartridge.id, filePath: null } : null;
}

function pickCartridge(
  project: DesktopProjectSnapshot,
  issue: IssueKind,
  currentId: string | null,
): DesktopCartridgeSnapshot | null {
  const candidates = cartridgesForIssue(project, issue);
  return (
    candidates.find((item) => item.id === currentId) ??
    candidates[0] ??
    project.cartridges[0] ??
    null
  );
}

function issueLabel(issue: IssueKind): string {
  if (issue === "untracked") return "未歸屬檔案";
  if (issue === "ghost") return "幽靈檔案";
  if (issue === "review") return "複審提醒";
  return "阻塞記憶卡";
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
