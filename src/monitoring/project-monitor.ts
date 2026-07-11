import path from "node:path";
import { createConfig } from "../config.js";
import { GitignoreFilter } from "../gitignore-filter.js";
import { CartridgeIndexManager } from "../index-manager.js";
import { refreshMemoryIndex } from "../memory-reindex.js";
import { StalenessAnalyzer } from "../analyzer.js";
import { MemoryWriter } from "../writer.js";
import type { CartridgeConfig, CartridgeIndex } from "../types.js";
import { handleProjectFileEvent } from "./project-event-handler.js";
import { NodeProjectWatcher } from "./node-project-watcher.js";
import { reloadProjectIndexFromDisk } from "../project-index-transaction.js";
import {
  buildDesktopProjectSnapshot,
  createProjectId,
  type DesktopProjectSnapshot,
} from "./project-snapshot.js";

export type ProjectMonitorListener = (
  snapshot: DesktopProjectSnapshot,
) => void;

export class CartridgeProjectMonitor {
  readonly id: string;
  readonly projectRoot: string;
  private readonly config: CartridgeConfig;
  private readonly indexManager: CartridgeIndexManager;
  private readonly writer: MemoryWriter;
  private readonly analyzer: StalenessAnalyzer;
  private gitignoreFilter: GitignoreFilter;
  private watcher: NodeProjectWatcher | undefined;
  private heartbeat: NodeJS.Timeout | undefined;
  private rescanTimer: NodeJS.Timeout | undefined;
  private listeners = new Set<ProjectMonitorListener>();
  private enabled = true;
  private error: string | null = null;
  private syncWarning: string | null = null;

  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
    this.id = createProjectId(this.projectRoot);
    this.config = createConfig(this.projectRoot);
    this.indexManager = new CartridgeIndexManager(this.config);
    this.writer = new MemoryWriter(this.config);
    this.analyzer = new StalenessAnalyzer(
      this.config,
      this.indexManager,
      this.writer,
    );
    this.gitignoreFilter = new GitignoreFilter(this.projectRoot);
  }

  async start(): Promise<DesktopProjectSnapshot> {
    this.enabled = true;
    await this.rescan();
    this.startWatcher();
    this.heartbeat = setInterval(() => {
      void this.indexManager.flushIfDirty().catch((error) =>
        this.setError(error),
      );
    }, 300_000);
    this.rescanTimer = setInterval(() => {
      void this.rescan().catch((error) => this.setError(error));
    }, 60_000);
    return this.getSnapshot();
  }

  async stop(): Promise<void> {
    this.enabled = false;
    this.watcher?.stop();
    this.watcher = undefined;
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.rescanTimer) clearInterval(this.rescanTimer);
    await this.indexManager.flushIfDirty();
    this.notify();
  }

  async rescan(): Promise<DesktopProjectSnapshot> {
    try {
      const { index } = await refreshMemoryIndex({
        projectRoot: this.projectRoot,
        config: this.config,
        indexManager: this.indexManager,
        gitignoreFilter: this.gitignoreFilter,
        detectMissedChanges: true,
        includeProjectFiles: true,
        persist: true,
      });
      await this.injectStartupWarnings(index);
      this.error = null;
      this.syncWarning = null;
    } catch (error) {
      this.setError(error);
    }
    this.notify();
    return this.getSnapshot();
  }

  getSnapshot(): DesktopProjectSnapshot {
    return buildDesktopProjectSnapshot({
      projectRoot: this.projectRoot,
      index: this.indexManager.getVisibleIndex(),
      enabled: this.enabled,
      error: this.error,
      syncWarning: this.syncWarning ?? this.indexManager.getSyncWarning(),
    });
  }

  subscribe(listener: ProjectMonitorListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  private startWatcher(): void {
    this.watcher?.stop();
    this.watcher = new NodeProjectWatcher({
      projectRoot: this.projectRoot,
      onEvent: (absPath, eventType) => {
        void handleProjectFileEvent({
          config: this.config,
          indexManager: this.indexManager,
          analyzer: this.analyzer,
          gitignoreFilter: this.gitignoreFilter,
          writer: this.writer,
          absFilePath: absPath,
          eventType,
          onUpdate: () => this.notify(),
        }).catch((error) => this.setError(error));
      },
      onRescan: () => {
        void this.rescan().catch((error) => this.setError(error));
      },
      onIndexChanged: () => {
        void reloadProjectIndexFromDisk(
          this.projectRoot,
          this.indexManager,
        )
          .then((result) => {
            if (result.status === "self-write") return;
            this.syncWarning =
              result.status === "missing" || result.status === "invalid"
                ? result.warning
                : null;
            this.notify();
          })
          .catch((error) => this.setError(error));
      },
      onError: (error) => this.setError(error),
    });
    this.watcher.start();
  }

  private async injectStartupWarnings(index: CartridgeIndex): Promise<void> {
    for (const entry of Object.values(index.cartridges)) {
      if (
        entry.staleness >= this.config.thresholds.significant &&
        entry.pendingChanges.length > 0
      ) {
        await this.writer.injectWarning(
          entry.mainFile?.activePath ?? entry.skillPath,
          entry.pendingChanges.map((change) => change.filePath),
          entry.staleness,
        );
      }
    }
  }

  private setError(error: unknown): void {
    this.error = error instanceof Error ? error.message : String(error);
    this.notify();
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}
