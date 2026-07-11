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
    const indexManager = {
      getIndex: vi.fn(() => ({
        cartridges: {
          "mem-test": {
            skillPath: ".agents\\memory\\mem-test\\SKILL.md",
          },
        },
      })),
      clearPendingChanges: vi.fn(),
      clearGhostFiles: vi.fn(),
      scan: vi.fn(async () => undefined),
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
    const onUpdate = vi.fn();
    const watcher = new CartridgeWatcher(
      createConfig("d:/test-project"),
      indexManager,
      {} as StalenessAnalyzer,
      gitignoreFilter,
      writer,
      onUpdate,
    );
    return { watcher, indexManager, writer, gitignoreFilter, onUpdate };
  }

  it("SKILL.md 變更後應 scan、reconcile untracked 並在交易完成後刷新", async () => {
    const { watcher, indexManager, writer, gitignoreFilter, onUpdate } =
      createWatcherFixture();

    await (watcher as unknown as SkillChangeHandler).handleSkillFileChange(
      ".agents/memory/mem-test/SKILL.md",
    );

    expect(indexManager.clearPendingChanges).toHaveBeenCalledWith("mem-test");
    expect(indexManager.clearGhostFiles).toHaveBeenCalledWith("mem-test");
    expect(writer.checkAndCleanWarning).toHaveBeenCalledWith(
      ".agents/memory/mem-test/SKILL.md",
    );
    expect(indexManager.scan).toHaveBeenCalled();
    expect(gitignoreFilter.discoverProjectFiles).toHaveBeenCalled();
    expect(indexManager.reconcileUntrackedFiles).toHaveBeenCalledWith([]);
    expect(indexManager.markDirty).toHaveBeenCalled();
    expect(indexManager.flushIfDirty).not.toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalled();
  });

  it("索引 skillPath 使用 Windows 分隔符時仍應清除同一卡匣的 pending 與 ghost", async () => {
    const { watcher, indexManager } = createWatcherFixture();

    await (watcher as unknown as SkillChangeHandler).handleSkillFileChange(
      ".agents/memory/mem-test/SKILL.md",
    );

    expect(indexManager.clearPendingChanges).toHaveBeenCalledWith("mem-test");
    expect(indexManager.clearGhostFiles).toHaveBeenCalledWith("mem-test");
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
    expect(indexManager.scan).toHaveBeenCalled();
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
