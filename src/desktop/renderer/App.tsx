import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { useEffect, useMemo, useState } from "react";
import type {
  DesktopCartridgeSnapshot,
  DesktopProjectSnapshot,
} from "../../monitoring/project-snapshot";
import type { DesktopSettings } from "../project-store";
import { desktopApi } from "./desktop-api";
import { useDesktopStyles } from "./desktopStyles";
import { Overview } from "./overview";
import { ProjectDetail } from "./project-detail";
import { Sidebar } from "./sidebar";
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

  useEffect(() => {
    void Promise.all([desktopApi.listProjects(), desktopApi.getSettings()]).then(
      ([snapshots, nextSettings]) => {
        setProjects(snapshots);
        setSettings(nextSettings);
        setSelectedId((current) => current ?? snapshots[0]?.id ?? null);
      },
    );
    const disposeSnapshots = desktopApi.onSnapshotsChanged((snapshots) => {
      setProjects(snapshots);
      setSelectedId((current) => current ?? snapshots[0]?.id ?? null);
    });
    const disposeSettingsRequest = desktopApi.onSettingsRequested(() => {
      setSettingsOpen(true);
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

  async function refresh(action: Promise<DesktopProjectSnapshot[]>): Promise<void> {
    const snapshots = await action;
    setProjects(snapshots);
    if (!snapshots.some((project) => project.id === selectedId)) {
      setSelectedId(snapshots[0]?.id ?? null);
    }
  }

  async function updateSetting(patch: Partial<DesktopSettings>): Promise<void> {
    setSettings(await desktopApi.updateSettings(patch));
  }

  function selectIssue(issue: IssueKind): void {
    setActiveIssue(issue);
    if (selected) {
      setIssueSelection(normalizeIssueSelection(selected, issue, null));
    }
  }

  function selectCartridge(kind: IssueKind, cartridgeId: string): void {
    setActiveIssue(kind);
    setIssueSelection({ kind, cartridgeId, filePath: null });
  }

  function selectUntracked(filePath: string): void {
    setActiveIssue("untracked");
    setIssueSelection({ kind: "untracked", cartridgeId: null, filePath });
  }

  return (
    <FluentProvider theme={webLightTheme}>
      <div className={styles.shell}>
        <Sidebar
          projects={projects}
          selectedId={selected?.id ?? null}
          onSelectProject={setSelectedId}
          onAddProjects={() => void refresh(desktopApi.addProjects())}
          onToggleSettings={() => setSettingsOpen((open) => !open)}
        />
        <Overview
          projects={projects}
          project={selected}
          actionItems={actionItems}
          activeIssue={activeIssue}
          showIntro={settings.showIntro}
          onSelectIssue={selectIssue}
          onDismissIntro={() => void updateSetting({ showIntro: false })}
          onAddProjects={() => void refresh(desktopApi.addProjects())}
          onRescanAll={() => void refresh(desktopApi.rescanAll())}
        />
        <ProjectDetail
          project={selected}
          settings={settings}
          settingsOpen={settingsOpen}
          issueSelection={issueSelection}
          onSettingsOpenChange={setSettingsOpen}
          onSettingsChange={(patch) => void updateSetting(patch)}
          onRefresh={(action) => void refresh(action)}
          onSelectCartridge={selectCartridge}
          onSelectUntracked={selectUntracked}
          onCloseIssue={() => setIssueSelection(null)}
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
