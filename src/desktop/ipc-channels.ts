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

export type DesktopOperationOutcome =
  | "success"
  | "cancelled"
  | "blocked"
  | "error";

export interface DesktopOperationResult<T = undefined> {
  outcome: DesktopOperationOutcome;
  message: string;
  data?: T;
}

export interface DesktopBridge {
  listProjects(): Promise<DesktopProjectSnapshot[]>;
  getSettings(): Promise<DesktopSettings>;
  updateSettings(
    settings: Partial<DesktopSettings>,
  ): Promise<DesktopOperationResult<DesktopSettings>>;
  addProjects(): Promise<DesktopOperationResult<DesktopProjectSnapshot[]>>;
  removeProject(
    projectRoot: string,
  ): Promise<DesktopOperationResult<DesktopProjectSnapshot[]>>;
  pauseProject(
    projectRoot: string,
  ): Promise<DesktopOperationResult<DesktopProjectSnapshot[]>>;
  resumeProject(
    projectRoot: string,
  ): Promise<DesktopOperationResult<DesktopProjectSnapshot[]>>;
  rescanProject(
    projectRoot: string,
  ): Promise<DesktopOperationResult<DesktopProjectSnapshot[]>>;
  rescanAll(): Promise<DesktopOperationResult<DesktopProjectSnapshot[]>>;
  openProject(projectRoot: string): Promise<DesktopOperationResult>;
  openFile(
    projectRoot: string,
    relativePath: string,
  ): Promise<DesktopOperationResult>;
  onSnapshotsChanged(
    listener: (snapshots: DesktopProjectSnapshot[]) => void,
  ): () => void;
  onSettingsRequested(listener: () => void): () => void;
}
