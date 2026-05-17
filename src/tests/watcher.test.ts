import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  workspace: {
    createFileSystemWatcher: vi.fn(),
  },
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
            skillPath: ".agents/memory/mem-test/SKILL.md",
          },
        },
      })),
      clearPendingChanges: vi.fn(),
      scan: vi.fn(async () => undefined),
      refilterUntrackedFiles: vi.fn(),
      markDirty: vi.fn(),
      flushIfDirty: vi.fn(async () => undefined),
      getAffectedCartridges: vi.fn(() => []),
      addUntrackedFile: vi.fn(),
    } as unknown as CartridgeIndexManager;
    const writer = {
      checkAndCleanWarning: vi.fn(async () => undefined),
    } as unknown as MemoryWriter;
    const gitignoreFilter = {
      isIgnored: vi.fn(() => args?.ignored ?? false),
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

  it("SKILL.md 變更後應 scan、refilter untracked、flush 並觸發刷新", async () => {
    const { watcher, indexManager, writer, gitignoreFilter, onUpdate } =
      createWatcherFixture();

    await (watcher as unknown as SkillChangeHandler).handleSkillFileChange(
      ".agents/memory/mem-test/SKILL.md",
    );

    expect(indexManager.clearPendingChanges).toHaveBeenCalledWith("mem-test");
    expect(writer.checkAndCleanWarning).toHaveBeenCalledWith(
      ".agents/memory/mem-test/SKILL.md",
    );
    expect(indexManager.scan).toHaveBeenCalled();
    expect(indexManager.refilterUntrackedFiles).toHaveBeenCalledWith(
      gitignoreFilter,
    );
    expect(indexManager.markDirty).toHaveBeenCalled();
    expect(indexManager.flushIfDirty).toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalled();
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
    expect(indexManager.refilterUntrackedFiles).toHaveBeenCalledWith(
      gitignoreFilter,
    );
  });
});
