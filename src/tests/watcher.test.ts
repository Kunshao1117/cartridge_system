import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  workspace: {
    createFileSystemWatcher: vi.fn(),
  },
}));

vi.mock("../project-index-transaction.js", () => ({
  ProjectIndexInvalidError: class ProjectIndexInvalidError extends Error {},
  ProjectIndexMissingError: class ProjectIndexMissingError extends Error {},
  runProjectIndexTransaction: vi.fn(async ({
    mutation,
  }: {
    mutation: () => Promise<unknown>;
  }) => ({
    value: await mutation(),
    repairedInvalidIndex: false,
    fingerprint: "test",
  })),
  reloadProjectIndexFromDisk: vi.fn(async () => ({
    status: "self-write",
    fingerprint: "test",
  })),
}));

import { createConfig } from "../config.js";
import { CartridgeWatcher } from "../watcher.js";
import type { StalenessAnalyzer } from "../analyzer.js";
import type { GitignoreFilter } from "../gitignore-filter.js";
import type { CartridgeIndexManager } from "../index-manager.js";
import type { MemoryWriter } from "../writer.js";

type SkillChangeHandler = {
  handleSkillFileChange(relPath: string): Promise<void>;
};

type EventHandler = {
  handleEvent(absPath: string, eventType: "add" | "change" | "unlink"): Promise<void>;
};

describe("CartridgeWatcher — 記憶卡變更後未歸屬清理", () => {
  function createWatcherFixture(args?: { ignored?: boolean }) {
    const entry = {
      skillPath: ".agents\\memory\\mem-test\\SKILL.md",
      pendingChanges: [{ filePath: "src/missing.ts", eventType: "unlink", timestamp: "2026-01-01T00:00:00Z" }],
      ghostFiles: ["src/missing.ts"],
      staleness: 20,
    };
    const indexManager = {
      getIndex: vi.fn(() => ({ cartridges: { "mem-test": entry } })),
      clearPendingChanges: vi.fn(),
      clearGhostFiles: vi.fn(),
      scan: vi.fn(async () => undefined),
      reconcileTrackedState: vi.fn(),
      buildAndMergeDependencies: vi.fn(() => true),
      reconcileUntrackedFiles: vi.fn(() => false),
      markDirty: vi.fn(),
      flushIfDirty: vi.fn(async () => undefined),
      getAffectedCartridges: vi.fn(() => []),
      addUntrackedFile: vi.fn(),
      removeUntrackedFile: vi.fn(() => false),
    } as unknown as CartridgeIndexManager;
    const writer = {
      checkAndCleanWarning: vi.fn(async () => undefined),
    } as unknown as MemoryWriter;
    const gitignoreFilter = {
      isIgnored: vi.fn(() => args?.ignored ?? false),
      checkIgnored: vi.fn(async () => ({
        ignored: args?.ignored ?? false,
        mode: "git-standard",
        diagnostics: [],
      })),
      reload: vi.fn(),
      discoverProjectFiles: vi.fn(async () => ({
        files: [],
        mode: "git-standard",
        diagnostics: [],
      })),
    } as unknown as GitignoreFilter;
    const analyzer = {
      refreshWarnings: vi.fn(async () => undefined),
      processFileEvent: vi.fn(async () => false),
    } as unknown as StalenessAnalyzer;
    const onUpdate = vi.fn();
    const watcher = new CartridgeWatcher(
      createConfig("d:/test-project"),
      indexManager,
      analyzer,
      gitignoreFilter,
      writer,
      onUpdate,
    );
    return { watcher, indexManager, writer, analyzer, entry, gitignoreFilter, onUpdate };
  }

  it("SKILL.md 變更後應 scan、reconcile untracked 並在交易完成後刷新", async () => {
    const { watcher, indexManager, writer, analyzer, entry, gitignoreFilter, onUpdate } =
      createWatcherFixture();

    await (watcher as unknown as SkillChangeHandler).handleSkillFileChange(
      ".agents/memory/mem-test/SKILL.md",
    );

    expect(indexManager.clearPendingChanges).not.toHaveBeenCalled();
    expect(indexManager.clearGhostFiles).not.toHaveBeenCalled();
    expect(writer.checkAndCleanWarning).not.toHaveBeenCalled();
    expect(entry.pendingChanges).toHaveLength(1);
    expect(entry.ghostFiles).toEqual(["src/missing.ts"]);
    expect(indexManager.scan).toHaveBeenCalledWith({ deriveDependencies: false });
    expect(indexManager.reconcileTrackedState).toHaveBeenCalledWith("mem-test");
    expect(indexManager.buildAndMergeDependencies).toHaveBeenCalledOnce();
    expect(analyzer.refreshWarnings).toHaveBeenCalledWith("mem-test");
    expect(vi.mocked(indexManager.scan).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(indexManager.reconcileTrackedState).mock.invocationCallOrder[0],
    );
    expect(vi.mocked(indexManager.reconcileTrackedState).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(indexManager.buildAndMergeDependencies).mock.invocationCallOrder[0],
    );
    expect(gitignoreFilter.discoverProjectFiles).toHaveBeenCalled();
    expect(indexManager.reconcileUntrackedFiles).toHaveBeenCalledWith([]);
    expect(indexManager.markDirty).toHaveBeenCalled();
    expect(indexManager.flushIfDirty).not.toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalled();
  });

  it("索引 skillPath 使用 Windows 分隔符時仍應對同一卡匣收斂，保留未解決的 pending 與 ghost", async () => {
    const { watcher, indexManager, analyzer, entry } = createWatcherFixture();

    await (watcher as unknown as SkillChangeHandler).handleSkillFileChange(
      ".agents/memory/mem-test/SKILL.md",
    );

    expect(indexManager.reconcileTrackedState).toHaveBeenCalledWith("mem-test");
    expect(analyzer.refreshWarnings).toHaveBeenCalledWith("mem-test");
    expect(indexManager.clearPendingChanges).not.toHaveBeenCalled();
    expect(indexManager.clearGhostFiles).not.toHaveBeenCalled();
    expect(entry.pendingChanges[0].filePath).toBe("src/missing.ts");
    expect(entry.ghostFiles).toEqual(["src/missing.ts"]);
  });

  it("被 .gitignore 忽略的 .agents/memory/SKILL.md 仍應進入記憶卡同步流程", async () => {
    const { watcher, indexManager, gitignoreFilter } = createWatcherFixture({
      ignored: true,
    });

    await (watcher as unknown as EventHandler).handleEvent(
      "d:/test-project/.agents/memory/mem-test/SKILL.md",
      "change",
    );

    expect(gitignoreFilter.isIgnored).not.toHaveBeenCalled();
    expect(gitignoreFilter.checkIgnored).not.toHaveBeenCalled();
    expect(indexManager.scan).toHaveBeenCalledWith({ deriveDependencies: false });
    expect(indexManager.reconcileTrackedState).toHaveBeenCalledWith("mem-test");
    expect(indexManager.clearPendingChanges).not.toHaveBeenCalled();
    expect(indexManager.clearGhostFiles).not.toHaveBeenCalled();
    expect(gitignoreFilter.discoverProjectFiles).toHaveBeenCalled();
    expect(indexManager.reconcileUntrackedFiles).toHaveBeenCalledWith([]);
  });

  it("nested .gitignore 事件應觸發 canonical candidate reconciliation", async () => {
    const { watcher, indexManager, gitignoreFilter } = createWatcherFixture();
    vi.mocked(gitignoreFilter.discoverProjectFiles).mockResolvedValue({
      files: ["src/visible.ts"],
      mode: "git-standard",
      diagnostics: [],
    });

    await (watcher as unknown as EventHandler).handleEvent(
      "d:/test-project/nested/.gitignore",
      "change",
    );

    expect(indexManager.reconcileUntrackedFiles).toHaveBeenCalledWith([
      "src/visible.ts",
    ]);
  });
});
