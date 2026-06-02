import path from "node:path";
import { CartridgeProjectMonitor } from "./project-monitor.js";
import type { DesktopProjectSnapshot } from "./project-snapshot.js";

export type MultiProjectListener = (
  snapshots: DesktopProjectSnapshot[],
) => void;

export class MultiProjectMonitor {
  private monitors = new Map<string, CartridgeProjectMonitor>();
  private listeners = new Set<MultiProjectListener>();

  async addProject(
    projectRoot: string,
    options?: { start?: boolean },
  ): Promise<DesktopProjectSnapshot[]> {
    const normalizedRoot = path.resolve(projectRoot);
    const existing = this.monitors.get(normalizedRoot);
    if (existing) {
      if (options?.start !== false) await existing.start();
      this.notify();
      return this.getSnapshots();
    }

    const monitor = new CartridgeProjectMonitor(normalizedRoot);
    monitor.subscribe(() => this.notify());
    this.monitors.set(normalizedRoot, monitor);
    if (options?.start === false) {
      await monitor.stop();
    } else {
      await monitor.start();
    }
    this.notify();
    return this.getSnapshots();
  }

  async removeProject(projectRoot: string): Promise<DesktopProjectSnapshot[]> {
    const normalizedRoot = path.resolve(projectRoot);
    const monitor = this.monitors.get(normalizedRoot);
    if (monitor) {
      await monitor.stop();
      this.monitors.delete(normalizedRoot);
    }
    this.notify();
    return this.getSnapshots();
  }

  async pauseProject(projectRoot: string): Promise<DesktopProjectSnapshot[]> {
    const monitor = this.monitors.get(path.resolve(projectRoot));
    await monitor?.stop();
    this.notify();
    return this.getSnapshots();
  }

  async resumeProject(projectRoot: string): Promise<DesktopProjectSnapshot[]> {
    const monitor = this.monitors.get(path.resolve(projectRoot));
    await monitor?.start();
    this.notify();
    return this.getSnapshots();
  }

  async rescanProject(projectRoot: string): Promise<DesktopProjectSnapshot[]> {
    const monitor = this.monitors.get(path.resolve(projectRoot));
    await monitor?.rescan();
    this.notify();
    return this.getSnapshots();
  }

  async rescanAll(): Promise<DesktopProjectSnapshot[]> {
    await Promise.all([...this.monitors.values()].map((monitor) => monitor.rescan()));
    this.notify();
    return this.getSnapshots();
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.monitors.values()].map((monitor) => monitor.stop()));
    this.notify();
  }

  getProjectRoots(): string[] {
    return [...this.monitors.keys()];
  }

  getSnapshots(): DesktopProjectSnapshot[] {
    return [...this.monitors.values()]
      .map((monitor) => monitor.getSnapshot())
      .sort((a, b) => statusRank(b.status) - statusRank(a.status) || a.name.localeCompare(b.name));
  }

  subscribe(listener: MultiProjectListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshots());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const snapshots = this.getSnapshots();
    for (const listener of this.listeners) listener(snapshots);
  }
}

function statusRank(status: DesktopProjectSnapshot["status"]): number {
  switch (status) {
    case "blocked":
      return 5;
    case "error":
      return 4;
    case "warning":
      return 3;
    case "paused":
      return 2;
    case "ready":
      return 1;
  }
}
