import type { DesktopProjectSnapshot } from "../monitoring/project-snapshot.js";
import type { DesktopSettings } from "./project-store.js";

export const DesktopIpc = {
  listProjects: "desktop:list-projects",
  getSettings: "desktop:get-settings",
  updateSettings: "desktop:update-settings",
  addProjects: "desktop:add-projects",
  removeProject: "desktop:remove-project",
  pauseProject: "desktop:pause-project",
  resumeProject: "desktop:resume-project",
  rescanProject: "desktop:rescan-project",
  rescanAll: "desktop:rescan-all",
  openProject: "desktop:open-project",
  openFile: "desktop:open-file",
  settingsRequested: "desktop:settings-requested",
  snapshotsChanged: "desktop:snapshots-changed",
} as const;

export interface DesktopBridge {
  listProjects(): Promise<DesktopProjectSnapshot[]>;
  getSettings(): Promise<DesktopSettings>;
  updateSettings(settings: Partial<DesktopSettings>): Promise<DesktopSettings>;
  addProjects(): Promise<DesktopProjectSnapshot[]>;
  removeProject(projectRoot: string): Promise<DesktopProjectSnapshot[]>;
  pauseProject(projectRoot: string): Promise<DesktopProjectSnapshot[]>;
  resumeProject(projectRoot: string): Promise<DesktopProjectSnapshot[]>;
  rescanProject(projectRoot: string): Promise<DesktopProjectSnapshot[]>;
  rescanAll(): Promise<DesktopProjectSnapshot[]>;
  openProject(projectRoot: string): Promise<void>;
  openFile(projectRoot: string, relativePath: string): Promise<void>;
  onSnapshotsChanged(
    listener: (snapshots: DesktopProjectSnapshot[]) => void,
  ): () => void;
  onSettingsRequested(listener: () => void): () => void;
}
