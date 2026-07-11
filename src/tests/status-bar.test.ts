import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CartridgeIndex } from "../types.js";

const statusItem = {
  text: "",
  tooltip: "",
  command: "",
  backgroundColor: undefined as unknown,
  show: vi.fn(),
  dispose: vi.fn(),
};

vi.mock("vscode", () => ({
  StatusBarAlignment: { Left: 1 },
  ThemeColor: class ThemeColor {
    constructor(readonly id: string) {}
  },
  window: {
    createStatusBarItem: vi.fn(() => statusItem),
  },
}));

import { CartridgeStatusBar } from "../status-bar.js";

describe("CartridgeStatusBar", () => {
  beforeEach(() => {
    statusItem.text = "";
    statusItem.tooltip = "";
    statusItem.command = "";
    statusItem.backgroundColor = undefined;
    statusItem.show.mockClear();
    statusItem.dispose.mockClear();
  });

  it("狀態列應排除記憶內部歸檔卷但保留產品未歸屬檔案", () => {
    const subscriptions = { push: vi.fn() };
    const bar = new CartridgeStatusBar({ subscriptions } as never);

    bar.update(createIndex());

    expect(statusItem.text).toContain("需要處理");
    expect(statusItem.text).toContain("1 未歸屬");
    expect(statusItem.tooltip).toContain("src/new.ts");
    expect(statusItem.tooltip).not.toContain("archive-001.md");
    expect(statusItem.show).toHaveBeenCalled();
  });

  it("canonical ready 但有同步警告時應與 Desktop 同樣顯示 warning", () => {
    const subscriptions = { push: vi.fn() };
    const bar = new CartridgeStatusBar({ subscriptions } as never);

    bar.update(
      {
        version: 1,
        lastScanned: "now",
        cartridges: {},
        fileMap: {},
        untrackedFiles: [],
      },
      "canonical index reload failed",
    );

    expect(statusItem.text).toContain("需要複審");
    expect(statusItem.backgroundColor).toMatchObject({
      id: "statusBarItem.warningBackground",
    });
  });
});

function createIndex(): CartridgeIndex {
  return {
    version: 1,
    lastScanned: "2026-06-04T10:00:00+08:00",
    fileMap: {},
    cartridges: {
      extension: {
        skillPath: ".agents/memory/extension/SKILL.md",
        description: "Extension",
        trackedFiles: ["src/extension.ts"],
        staleness: 0,
        lastUpdated: "2026-06-04T10:00:00+08:00",
        pendingChanges: [],
        depth: 1,
        parent: null,
        ghostFiles: [],
        dependencies: [],
        indirectStaleness: 0,
      },
    },
    untrackedFiles: [
      {
        filePath: ".agents/memory/extension/archive-001.md",
        suggestedOwner: null,
        detectedAt: "2026-06-04T10:00:00+08:00",
        lastEvent: "add",
      },
      {
        filePath: "src/new.ts",
        suggestedOwner: "extension",
        detectedAt: "2026-06-04T10:00:00+08:00",
        lastEvent: "add",
      },
    ],
  };
}
