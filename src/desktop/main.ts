import path from "node:path";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  shell,
  Tray,
} from "electron";
import { MultiProjectMonitor } from "../monitoring/multi-project-monitor.js";
import type { DesktopProjectSnapshot } from "../monitoring/project-snapshot.js";
import { DesktopIpc } from "./ipc-channels.js";
import {
  DEFAULT_DESKTOP_SETTINGS,
  type DesktopSettings,
  DesktopProjectStore,
  type StoredDesktopProject,
} from "./project-store.js";
import { DesktopNotifier } from "./desktop-notifier.js";
import {
  isKnownProjectRoot,
  resolveProjectFilePath,
} from "./path-guard.js";
import { shouldHideWindowOnClose } from "./window-behavior.js";

let mainWindow: BrowserWindow | undefined;
let tray: Tray | undefined;
const monitor = new MultiProjectMonitor();
const notifier = new DesktopNotifier();
let store: DesktopProjectStore;
let settings: DesktopSettings = { ...DEFAULT_DESKTOP_SETTINGS };
let isQuitting = false;

app.setName("Cartridge Desktop Console");

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  store = new DesktopProjectStore(app.getPath("userData"));
  settings = await store.readSettings();
  registerIpcHandlers();
  monitor.subscribe((snapshots) => {
    mainWindow?.webContents.send(DesktopIpc.snapshotsChanged, snapshots);
    updateTray(snapshots);
    notifier.notifyChanges(snapshots, { enabled: settings.notificationsEnabled });
  });
  await restoreProjects();
  createWindow();
  createTray();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  isQuitting = true;
  void monitor.stopAll();
});

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 780,
    minWidth: 980,
    minHeight: 640,
    title: "Cartridge Desktop Console",
    backgroundColor: "#f7f7f8",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devUrl = process.env.CARTRIDGE_DESKTOP_RENDERER_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  }

  mainWindow.on("close", (event) => {
    if (!shouldHideWindowOnClose({ settings, isQuitting })) return;
    event.preventDefault();
    mainWindow?.hide();
    updateTray(monitor.getSnapshots());
  });

  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });
}

function createTray(): void {
  const iconPath = path.resolve(__dirname, "..", "..", "assets", "logo.png");
  const image = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(image);
  tray.setToolTip("Cartridge Desktop Console");
  updateTray(monitor.getSnapshots());
}

function updateTray(snapshots: DesktopProjectSnapshot[]): void {
  if (!tray) return;
  const blocked = snapshots.filter((item) => item.status === "blocked").length;
  const warning = snapshots.filter((item) => item.status === "warning").length;
  const label = blocked > 0 ? `阻塞 ${blocked}` : warning > 0 ? `警告 ${warning}` : "全部健康";
  tray.setToolTip(`Cartridge Desktop Console - ${label}`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label, enabled: false },
      { type: "separator" },
      { label: "開啟監控台", click: () => showWindow() },
      { label: "重新掃描全部", click: () => void monitor.rescanAll() },
      {
        label: "設定",
        click: () => {
          showWindow();
          mainWindow?.webContents.send(DesktopIpc.settingsRequested);
        },
      },
      { type: "separator" },
      { label: "退出", click: () => quitApp() },
    ]),
  );
}

function showWindow(): void {
  if (!mainWindow) createWindow();
  mainWindow?.show();
  mainWindow?.focus();
}

function registerIpcHandlers(): void {
  ipcMain.handle(DesktopIpc.listProjects, () => monitor.getSnapshots());
  ipcMain.handle(DesktopIpc.getSettings, () => settings);
  ipcMain.handle(
    DesktopIpc.updateSettings,
    async (_event, patch: Partial<DesktopSettings>) => {
      settings = await store.writeSettings(patch);
      updateTray(monitor.getSnapshots());
      return settings;
    },
  );
  ipcMain.handle(DesktopIpc.addProjects, async () => {
    const result = await dialog.showOpenDialog({
      title: "加入監控專案",
      properties: ["openDirectory", "multiSelections"],
    });
    if (result.canceled) return monitor.getSnapshots();
    for (const root of result.filePaths) await monitor.addProject(root);
    await persistProjects();
    return monitor.getSnapshots();
  });
  ipcMain.handle(DesktopIpc.removeProject, async (_event, root: string) => {
    const snapshots = await monitor.removeProject(root);
    await persistProjects();
    return snapshots;
  });
  ipcMain.handle(DesktopIpc.pauseProject, async (_event, root: string) => {
    const snapshots = await monitor.pauseProject(root);
    await persistProjects();
    return snapshots;
  });
  ipcMain.handle(DesktopIpc.resumeProject, async (_event, root: string) => {
    const snapshots = await monitor.resumeProject(root);
    await persistProjects();
    return snapshots;
  });
  ipcMain.handle(DesktopIpc.rescanProject, (_event, root: string) =>
    monitor.rescanProject(root),
  );
  ipcMain.handle(DesktopIpc.rescanAll, () => monitor.rescanAll());
  ipcMain.handle(DesktopIpc.openProject, async (_event, root: string) => {
    if (!isKnownProjectRoot(root, getKnownRoots())) return;
    await shell.openPath(path.resolve(root));
  });
  ipcMain.handle(
    DesktopIpc.openFile,
    async (_event, root: string, relativePath: string) => {
      if (!isKnownProjectRoot(root, getKnownRoots())) return;
      const target = resolveProjectFilePath(root, relativePath);
      if (!target) return;
      await shell.openPath(target);
    },
  );
}

function quitApp(): void {
  isQuitting = true;
  app.quit();
}

function getKnownRoots(): string[] {
  return monitor.getSnapshots().map((snapshot) => snapshot.root);
}

async function restoreProjects(): Promise<void> {
  const projects = await store.read();
  for (const project of projects) {
    await monitor.addProject(project.root, { start: project.enabled });
  }
}

async function persistProjects(): Promise<void> {
  const projects: StoredDesktopProject[] = monitor.getSnapshots().map((item) => ({
    root: item.root,
    enabled: item.enabled,
  }));
  await store.write(projects);
}
