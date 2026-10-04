import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { canonicalProjectRoot } from "../monitoring/project-identity.js";

// One queue per file also serializes multiple store objects in the same process.
const writes = new Map<string, Promise<unknown>>();

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
    const nextProjects = normalizeProjects(projects);
    return this.enqueue(async () => {
      const state = await this.readState();
      await this.replaceState({ ...state, projects: nextProjects });
    });
  }

  async writeSettings(settings: Partial<DesktopSettings>): Promise<DesktopSettings> {
    const patch = { ...settings };
    return this.enqueue(async () => {
      const state = await this.readState();
      const nextSettings = normalizeSettings({ ...state.settings, ...patch });
      await this.replaceState({ ...state, settings: nextSettings });
      return nextSettings;
    });
  }

  async writeState(state: DesktopStoreState): Promise<void> {
    const next = { projects: normalizeProjects(state.projects), settings: normalizeSettings(state.settings) };
    return this.enqueue(() => this.replaceState(next));
  }

  private enqueue<T>(action: () => Promise<T>): Promise<T> {
    const key = canonicalProjectRoot(this.filePath);
    const current = (writes.get(key) ?? Promise.resolve()).catch(() => undefined).then(action);
    writes.set(key, current);
    void current.finally(() => { if (writes.get(key) === current) writes.delete(key); }).catch(() => undefined);
    return current;
  }

  private async replaceState(state: DesktopStoreState): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, JSON.stringify(state, null, 2), "utf-8");
      await fs.rename(temporary, this.filePath);
    } finally {
      await fs.rm(temporary, { force: true }).catch(() => undefined);
    }
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
    const key = canonicalProjectRoot(root);
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
