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

const BACKGROUND_RESCAN_INTERVAL_MS = 900_000;

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
  private startupPromise: Promise<DesktopProjectSnapshot> | undefined;
  private activeRescan: Promise<DesktopProjectSnapshot> | undefined;
  private trailingRescan:
    | { generation: number; injectStartupWarnings: boolean }
    | undefined;
  private isRunningTrailingRescan = false;
  private runningRescanGeneration: number | undefined;
  private lifecycleGeneration = 0;
  private started = false;
  private stopped = false;
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

  start(): Promise<DesktopProjectSnapshot> {
    if (this.startupPromise) return this.startupPromise;
    if (this.started && !this.stopped) return this.rescan();

    const generation = ++this.lifecycleGeneration;
    this.started = true;
    this.stopped = false;
    this.enabled = true;
    const startupPromise = this.startGeneration(generation);
    this.startupPromise = startupPromise;

    const releaseStartup = () => {
      if (this.startupPromise === startupPromise) {
        this.startupPromise = undefined;
      }
    };
    void startupPromise.then(releaseStartup, releaseStartup);
    return startupPromise;
  }

  async stop(): Promise<void> {
    const generation = ++this.lifecycleGeneration;
    this.started = false;
    this.stopped = true;
    this.enabled = false;
    this.startupPromise = undefined;
    this.trailingRescan = undefined;

    const watcher = this.watcher;
    this.watcher = undefined;
    try {
      watcher?.stop();
    } finally {
      this.clearTimers();
    }

    await this.activeRescan?.catch(() => undefined);
    await this.indexManager.flushIfDirty();
    if (generation !== this.lifecycleGeneration || !this.stopped) return;
    this.notify();
  }

  rescan(): Promise<DesktopProjectSnapshot> {
    return this.requestRescan(this.lifecycleGeneration);
  }

  private async startGeneration(
    generation: number,
  ): Promise<DesktopProjectSnapshot> {
    await this.requestRescan(generation, true);
    if (!this.isActiveGeneration(generation)) return this.getSnapshot();

    try {
      this.startWatcher(generation);
      this.startTimers(generation);
    } catch (error) {
      if (this.isActiveGeneration(generation)) {
        this.started = false;
        this.watcher?.stop();
        this.watcher = undefined;
        this.clearTimers();
        this.setError(error, generation);
      }
      throw error;
    }

    return this.getSnapshot();
  }

  private requestRescan(
    generation: number,
    injectStartupWarnings = false,
  ): Promise<DesktopProjectSnapshot> {
    if (!this.isCurrentGeneration(generation)) {
      return Promise.resolve(this.getSnapshot());
    }

    if (this.activeRescan) {
      if (
        this.isRunningTrailingRescan &&
        generation <= (this.runningRescanGeneration ?? generation)
      ) {
        return this.activeRescan;
      }

      const trailingRescan = this.trailingRescan;
      if (!trailingRescan || generation > trailingRescan.generation) {
        this.trailingRescan = { generation, injectStartupWarnings };
      } else if (generation === trailingRescan.generation) {
        trailingRescan.injectStartupWarnings ||= injectStartupWarnings;
      }
      return this.activeRescan;
    }

    const activeRescan = this.runRescanQueue(
      generation,
      injectStartupWarnings,
    );
    this.activeRescan = activeRescan;
    const releaseRescan = () => {
      if (this.activeRescan === activeRescan) {
        this.activeRescan = undefined;
      }
    };
    void activeRescan.then(releaseRescan, releaseRescan);
    return activeRescan;
  }

  private async runRescanQueue(
    initialGeneration: number,
    injectStartupWarnings: boolean,
  ): Promise<DesktopProjectSnapshot> {
    let generation = initialGeneration;
    let shouldInjectStartupWarnings = injectStartupWarnings;

    this.trailingRescan = undefined;
    await this.performRescan(generation, shouldInjectStartupWarnings);

    while (true) {
      const trailingRescan = this.takeTrailingRescan();
      if (!trailingRescan) break;

      this.isRunningTrailingRescan = true;
      generation = trailingRescan.generation;
      shouldInjectStartupWarnings = trailingRescan.injectStartupWarnings;
      this.runningRescanGeneration = generation;
      try {
        await this.performRescan(generation, shouldInjectStartupWarnings);
      } finally {
        this.isRunningTrailingRescan = false;
      }
    }

    this.runningRescanGeneration = undefined;
    return this.getSnapshot();
  }

  private async performRescan(
    generation: number,
    injectStartupWarnings: boolean,
  ): Promise<void> {
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
      if (!this.isCurrentGeneration(generation)) return;

      if (injectStartupWarnings) {
        await this.injectStartupWarnings(index, generation);
        if (!this.isCurrentGeneration(generation)) return;
      }

      this.error = null;
      this.syncWarning = null;
      this.notify();
    } catch (error) {
      this.setError(error, generation);
    }
  }

  private takeTrailingRescan():
    | { generation: number; injectStartupWarnings: boolean }
    | undefined {
    const trailingRescan = this.trailingRescan;
    this.trailingRescan = undefined;
    return trailingRescan;
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
    try {
      listener(this.getSnapshot());
    } catch {
      this.listeners.delete(listener);
      return () => undefined;
    }
    return () => this.listeners.delete(listener);
  }

  private startWatcher(generation: number): void {
    if (!this.isActiveGeneration(generation)) return;

    this.watcher?.stop();
    this.watcher = new NodeProjectWatcher({
      projectRoot: this.projectRoot,
      onEvent: (absPath, eventType) => {
        if (!this.isActiveGeneration(generation)) return;
        void handleProjectFileEvent({
          config: this.config,
          indexManager: this.indexManager,
          analyzer: this.analyzer,
          gitignoreFilter: this.gitignoreFilter,
          writer: this.writer,
          absFilePath: absPath,
          eventType,
          onUpdate: () => this.notifyIfCurrent(generation),
        }).catch((error) => this.setError(error, generation));
      },
      onRescan: () => {
        if (!this.isActiveGeneration(generation)) return;
        void this.requestRescan(generation).catch((error) =>
          this.setError(error, generation),
        );
      },
      onIndexChanged: () => {
        if (!this.isActiveGeneration(generation)) return;
        void reloadProjectIndexFromDisk(
          this.projectRoot,
          this.indexManager,
        )
          .then((result) => {
            if (!this.isActiveGeneration(generation)) return;
            if (result.status === "self-write") return;
            this.syncWarning =
              result.status === "missing" || result.status === "invalid"
                ? result.warning
                : null;
            this.notify();
          })
          .catch((error) => this.setError(error, generation));
      },
      onError: (error) => this.setError(error, generation),
    });
    this.watcher.start();
  }

  private startTimers(generation: number): void {
    this.clearTimers();
    if (!this.isActiveGeneration(generation)) return;

    this.heartbeat = setInterval(() => {
      if (!this.isActiveGeneration(generation)) return;
      void this.indexManager.flushIfDirty().catch((error) =>
        this.setError(error, generation),
      );
    }, 300_000);
    this.rescanTimer = setInterval(() => {
      if (!this.isActiveGeneration(generation)) return;
      void this.requestRescan(generation).catch((error) =>
        this.setError(error, generation),
      );
    }, BACKGROUND_RESCAN_INTERVAL_MS);
  }

  private clearTimers(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.rescanTimer) clearInterval(this.rescanTimer);
    this.heartbeat = undefined;
    this.rescanTimer = undefined;
  }

  private async injectStartupWarnings(
    index: CartridgeIndex,
    generation: number,
  ): Promise<void> {
    for (const entry of Object.values(index.cartridges)) {
      if (!this.isCurrentGeneration(generation)) return;
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

  private isCurrentGeneration(generation: number): boolean {
    return generation === this.lifecycleGeneration;
  }

  private isActiveGeneration(generation: number): boolean {
    return (
      !this.stopped &&
      this.started &&
      this.isCurrentGeneration(generation)
    );
  }

  private setError(error: unknown, generation: number): void {
    if (!this.isCurrentGeneration(generation)) return;
    this.error = error instanceof Error ? error.message : String(error);
    this.notify();
  }

  private notifyIfCurrent(generation: number): void {
    if (this.isCurrentGeneration(generation)) this.notify();
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // Listener failures must not alter monitor state or block other listeners.
      }
    }
  }
}
