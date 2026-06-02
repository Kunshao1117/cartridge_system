import fs from "node:fs/promises";
import path from "node:path";

export interface StoredDesktopProject {
  root: string;
  enabled: boolean;
}

export interface DesktopSettings {
  minimizeToTray: boolean;
  notificationsEnabled: boolean;
  showIntro: boolean;
}

export interface DesktopStoreState {
  projects: StoredDesktopProject[];
  settings: DesktopSettings;
}

export const DEFAULT_DESKTOP_SETTINGS: DesktopSettings = {
  minimizeToTray: true,
  notificationsEnabled: true,
  showIntro: true,
};

interface StoreFile {
  projects: StoredDesktopProject[];
  settings?: Partial<DesktopSettings>;
}

export class DesktopProjectStore {
  private readonly filePath: string;

  constructor(userDataDir: string) {
    this.filePath = path.join(userDataDir, "desktop-projects.json");
  }

  async read(): Promise<StoredDesktopProject[]> {
    return (await this.readState()).projects;
  }

  async readSettings(): Promise<DesktopSettings> {
    return (await this.readState()).settings;
  }

  async readState(): Promise<DesktopStoreState> {
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(raw) as StoreFile;
      return {
        projects: normalizeProjects(parsed.projects ?? []),
        settings: normalizeSettings(parsed.settings),
      };
    } catch {
      return {
        projects: [],
        settings: { ...DEFAULT_DESKTOP_SETTINGS },
      };
    }
  }

  async write(projects: StoredDesktopProject[]): Promise<void> {
    const state = await this.readState();
    await this.writeState({ ...state, projects });
  }

  async writeSettings(settings: Partial<DesktopSettings>): Promise<DesktopSettings> {
    const state = await this.readState();
    const nextSettings = normalizeSettings({ ...state.settings, ...settings });
    await this.writeState({ ...state, settings: nextSettings });
    return nextSettings;
  }

  async writeState(state: DesktopStoreState): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const content = JSON.stringify(
      {
        projects: normalizeProjects(state.projects),
        settings: normalizeSettings(state.settings),
      },
      null,
      2,
    );
    await fs.writeFile(this.filePath, content, "utf-8");
  }
}

function normalizeProjects(
  projects: StoredDesktopProject[],
): StoredDesktopProject[] {
  const seen = new Set<string>();
  const normalized: StoredDesktopProject[] = [];
  for (const project of projects) {
    if (!project.root) continue;
    const root = path.resolve(project.root);
    const key = root.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ root, enabled: project.enabled !== false });
  }
  return normalized;
}

function normalizeSettings(settings?: Partial<DesktopSettings>): DesktopSettings {
  return {
    minimizeToTray: settings?.minimizeToTray !== false,
    notificationsEnabled: settings?.notificationsEnabled !== false,
    showIntro: settings?.showIntro !== false,
  };
}
