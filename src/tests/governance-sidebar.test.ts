import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { buildGovernanceActionItems } from "../action-items-model.js";
import { buildGovernanceSummary } from "../governance-summary.js";
import type { ContextInventory } from "../context-types.js";
import type { CartridgeIndex } from "../types.js";

function fixtureIndex(): CartridgeIndex {
  return {
    version: 1,
    lastScanned: "2026-05-17T00:00:00.000Z",
    cartridges: {
      extension: {
        skillPath: ".agents/memory/extension/SKILL.md",
        description: "Extension UI",
        trackedFiles: ["src/extension.ts"],
        staleness: 30,
        lastUpdated: "2026-05-17T00:00:00.000Z",
        pendingChanges: [{ filePath: "src/extension.ts", eventType: "change", timestamp: "now" }],
        depth: 1,
        parent: null,
        ghostFiles: ["src/old-panel.ts"],
        dependencies: [],
        indirectStaleness: 0,
      },
    },
    fileMap: {},
    untrackedFiles: [
      { filePath: "src/new-panel.ts", suggestedOwner: "extension", detectedAt: "now", lastEvent: "add" },
    ],
  };
}

function fixtureInventory(): ContextInventory {
  return {
    assets: [
      {
        id: "codex.agents",
        type: "instruction",
        path: "AGENTS.md",
        exists: true,
        owner: "codex",
        scope: "project",
        priority: 100,
        supportedAgents: ["codex"],
        trackedFiles: [],
        dependencies: [],
        staleness: 0,
        risk: "medium",
        signals: ["language:zh-TW"],
      },
    ],
    totals: {
      assets: 2,
      existing: 1,
      missing: 1,
      byOwner: { codex: 1 },
      byType: { instruction: 1 },
    },
  };
}

describe("governance sidebar manifest", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"),
  );

  it("應宣告獨立 Activity Bar container 與四個 Cartridge views", () => {
    expect(packageJson.contributes.viewsContainers.activitybar).toContainEqual({
      id: "cartridgeGovernance",
      title: "Cartridge",
      icon: "assets/cartridge-activity.svg",
    });

    const views = packageJson.contributes.views.cartridgeGovernance;
    expect(views.map((view: { id: string }) => view.id)).toEqual([
      "cartridgeGovernanceOverview",
      "cartridgeExplorer",
      "cartridgeContextExplorer",
      "cartridgeActionItems",
    ]);
    expect(packageJson.contributes.views.explorer).toBeUndefined();
  });

  it("應宣告治理側邊欄公開 commands", () => {
    const commands = packageJson.contributes.commands.map(
      (command: { command: string }) => command.command,
    );
    expect(commands).toContain("cartridge.openGovernanceDashboard");
    expect(commands).toContain("cartridge.refreshGovernance");
    expect(commands).toContain("cartridge.contextAudit");
  });
});

describe("governance sidebar models", () => {
  it("治理總覽應彙整 memory 與 context readiness", () => {
    const summary = buildGovernanceSummary({
      index: fixtureIndex(),
      inventory: fixtureInventory(),
      contextFindings: [{ severity: "warning" }],
    });

    expect(summary.status).toBe("warning");
    expect(summary.memory.stale).toBe(1);
    expect(summary.memory.ghostFiles).toBe(1);
    expect(summary.memory.untrackedFiles).toBe(1);
    expect(summary.context.warnings).toBe(1);
  });

  it("待處理項目應包含 stale、ghost、untracked 與 context finding", () => {
    const items = buildGovernanceActionItems({
      index: fixtureIndex(),
      inventory: fixtureInventory(),
      contextFindings: [
        {
          severity: "error",
          code: "context_commit_policy_conflict",
          message: "Commit policy conflict",
          explanation: "提交規則互相衝突。",
          recommendedAction: "統一提交規則。",
          assets: ["codex.agents"],
        },
      ],
    });

    expect(items.map((item) => item.kind)).toEqual([
      "stale",
      "ghost",
      "untracked",
      "context",
    ]);
    expect(items[3].targetPath).toBe("AGENTS.md");
    expect(items[0].label).toBe("更新記憶卡：extension");
    expect(items[1].affectedPath).toBe("src/old-panel.ts");
    expect(items[2].recommendedAction).toContain("歸到合適的記憶卡");
    expect(items[3].reason).toBeDefined();
  });
});
