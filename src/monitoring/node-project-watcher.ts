import fs, { type FSWatcher } from "node:fs";
import path from "node:path";
import type { FileEventType } from "../types.js";

export interface NodeProjectWatcherOptions {
  projectRoot: string;
  debounceMs?: number;
  onEvent: (absPath: string, eventType: FileEventType) => void;
  onIndexChanged?: (eventType: FileEventType) => void;
  onRescan: () => void;
  onError?: (error: Error) => void;
}

export class NodeProjectWatcher {
  private watcher: FSWatcher | undefined;
  private debounceMap = new Map<string, NodeJS.Timeout>();
  private readonly debounceMs: number;
  private readonly options: NodeProjectWatcherOptions;

  constructor(options: NodeProjectWatcherOptions) {
    this.options = options;
    this.debounceMs = options.debounceMs ?? 300;
  }

  start(): void {
    this.stop();
    try {
      this.watcher = fs.watch(
        this.options.projectRoot,
        { recursive: true },
        (eventType, filename) => {
          if (!filename) {
            this.options.onRescan();
            return;
          }
          const relPath = normalizeFilename(filename);
          const absPath = path.resolve(this.options.projectRoot, relPath);
          if (relPath.toLowerCase() === ".cartridge/index.json") {
            this.debounceIndex(mapNodeEvent(absPath, eventType));
            return;
          }
          if (isProjectIndexArtifact(relPath)) return;
          this.debounce(absPath, mapNodeEvent(absPath, eventType));
        },
      );
      this.watcher.on("error", (error) => this.options.onError?.(error));
    } catch (error) {
      this.options.onError?.(asError(error));
    }
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = undefined;
    for (const timer of this.debounceMap.values()) {
      clearTimeout(timer);
    }
    this.debounceMap.clear();
  }

  private debounce(absPath: string, eventType: FileEventType): void {
    const existing = this.debounceMap.get(absPath);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.debounceMap.delete(absPath);
      this.options.onEvent(absPath, eventType);
    }, this.debounceMs);
    this.debounceMap.set(absPath, timer);
  }

  private debounceIndex(eventType: FileEventType): void {
    const key = "<project-index>";
    const existing = this.debounceMap.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.debounceMap.delete(key);
      this.options.onIndexChanged?.(eventType);
    }, 150);
    this.debounceMap.set(key, timer);
  }
}

function mapNodeEvent(absPath: string, eventType: string): FileEventType {
  if (eventType === "change") return "change";
  return fs.existsSync(absPath) ? "add" : "unlink";
}

function normalizeFilename(filename: string | Buffer): string {
  return filename.toString().replace(/\\/g, "/");
}

function isProjectIndexArtifact(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, "/").toLowerCase();
  return (
    normalized === ".cartridge/index.lock" ||
    normalized.startsWith(".cartridge/index.lock/") ||
    /^\.cartridge\/index\.\d+\.[0-9a-f-]+\.tmp$/i.test(normalized) ||
    normalized.startsWith(".cartridge/index.lock.stale-")
  );
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
