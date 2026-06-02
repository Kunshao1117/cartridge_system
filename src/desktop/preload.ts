import { contextBridge, ipcRenderer } from "electron";
import { DesktopIpc, type DesktopBridge } from "./ipc-channels.js";
import type { DesktopProjectSnapshot } from "../monitoring/project-snapshot.js";

const bridge: DesktopBridge = {
  listProjects: () => ipcRenderer.invoke(DesktopIpc.listProjects),
  getSettings: () => ipcRenderer.invoke(DesktopIpc.getSettings),
  updateSettings: (settings) =>
    ipcRenderer.invoke(DesktopIpc.updateSettings, settings),
  addProjects: () => ipcRenderer.invoke(DesktopIpc.addProjects),
  removeProject: (projectRoot) =>
    ipcRenderer.invoke(DesktopIpc.removeProject, projectRoot),
  pauseProject: (projectRoot) =>
    ipcRenderer.invoke(DesktopIpc.pauseProject, projectRoot),
  resumeProject: (projectRoot) =>
    ipcRenderer.invoke(DesktopIpc.resumeProject, projectRoot),
  rescanProject: (projectRoot) =>
    ipcRenderer.invoke(DesktopIpc.rescanProject, projectRoot),
  rescanAll: () => ipcRenderer.invoke(DesktopIpc.rescanAll),
  openProject: (projectRoot) =>
    ipcRenderer.invoke(DesktopIpc.openProject, projectRoot),
  openFile: (projectRoot, relativePath) =>
    ipcRenderer.invoke(DesktopIpc.openFile, projectRoot, relativePath),
  onSnapshotsChanged: (listener) => {
    const handler = (_event: unknown, snapshots: DesktopProjectSnapshot[]) => {
      listener(snapshots);
    };
    ipcRenderer.on(DesktopIpc.snapshotsChanged, handler);
    return () => ipcRenderer.off(DesktopIpc.snapshotsChanged, handler);
  },
  onSettingsRequested: (listener) => {
    const handler = () => listener();
    ipcRenderer.on(DesktopIpc.settingsRequested, handler);
    return () => ipcRenderer.off(DesktopIpc.settingsRequested, handler);
  },
};

contextBridge.exposeInMainWorld("cartridgeDesktop", bridge);
