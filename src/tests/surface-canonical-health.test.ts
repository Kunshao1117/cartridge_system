import { describe, expect, it, vi } from "vitest";
import { buildCabinetWorkbenchModel } from "../cabinet-workbench-model.js";
import { buildGovernanceActionItems } from "../action-items-model.js";
import { CartridgeTreeProvider } from "../treeview-provider.js";
import { buildDesktopProjectSnapshot } from "../monitoring/project-snapshot.js";
import { cartridgesForIssue, getCartridgeStatus, pickIssueForCartridge } from "../desktop/renderer/status.js";
import type { CartridgeIndexManager } from "../index-manager.js";
import type { ContextInventory } from "../context-types.js";
import type { CartridgeEntry } from "../types.js";
import { surfaceEntry, surfaceIndex } from "./surface-regression-fixtures.js";
vi.mock("vscode", () => ({
  TreeItem: class { constructor(public label: string) {} },
  TreeItemCollapsibleState: { Collapsed: 1, None: 0 },
  EventEmitter: class { event = () => {}; fire() {} dispose() {} },
}));
const inventory: ContextInventory = { assets: [], totals: { assets: 0, existing: 0, missing: 0, byOwner: {}, byType: {} } };
const archive = {
  needsCompaction: false, reasons: [], isLegacy: false, archiveVolumes: [{
    filePath: ".agents/memory/core/archive-001.md", needsCompaction: true, reasons: ["maxSizeExceeded"],
    sizeBytes: 99999, sizeLimitBytes: 100, lineCount: 99, lineLimit: 10,
  }],
} as unknown as NonNullable<CartridgeEntry["compaction"]>;
describe("canonical warnings across user surfaces", () => {
  const blockingCases: Array<[string, Partial<CartridgeEntry>]> = [
    ["missing", { mainFileType: "missing" }], ["main conflict", { mainFileType: "conflict" }],
    ["quality conflict", { contentQualityStatus: "conflict" }], ["ghost", { ghostFiles: ["gone.ts"] }],
    ["staleness one", { staleness: 1 }], ["archive only", { compaction: archive }],
  ];
  it.each(blockingCases)("never renders green for %s and provides a drilldown", (_label, patch) => {
    const index = surfaceIndex({ core: surfaceEntry(patch) });
    const model = buildCabinetWorkbenchModel(index);
    expect(model.cards[0].status).toBe("critical");
    expect(model.cards[0].warnings.some(item => item.tier === "blocking")).toBe(true);
    const tree = new CartridgeTreeProvider({ getVisibleIndex: () => index } as unknown as CartridgeIndexManager, "/demo");
    expect(tree.getChildren()[0].label).toContain("🔴");
    const project = buildDesktopProjectSnapshot({ projectRoot: "/demo", enabled: true, index });
    const card = project.cartridges[0];
    expect(getCartridgeStatus(card).tone).toBe("danger");
    expect(card.guidance).not.toBe("目前沒有需要處理的記憶問題。");
    expect(cartridgesForIssue(project, pickIssueForCartridge(card, "blocking"))).toContain(card);
  });
  it("shows dependency-only review in cabinet and tree without inventing stale heat", () => {
    const index = surfaceIndex({ core: surfaceEntry({ dependencySyncWarning: "sync incomplete" }) });
    const card = buildCabinetWorkbenchModel(index).cards[0];
    expect(card.status).toBe("mild"); expect(card.reviewScore).toBeGreaterThan(0); expect(card.staleness).toBe(0);
    const tree = new CartridgeTreeProvider({ getVisibleIndex: () => index } as unknown as CartridgeIndexManager, "/demo");
    expect(tree.getChildren()[0].label).toContain("🟡");
  });
  it.each(["conflict", "missing_fields", "missing_sections", "pending_review", "superseded"] as const)("preserves quality %s reasons and actionable guidance", status => {
    const index = surfaceIndex({ core: surfaceEntry({ contentQualityStatus: status }) });
    const items = buildGovernanceActionItems({ index, inventory, contextFindings: [] });
    const quality = items.find(item => item.cartridgeId === "core");
    expect(quality).toBeDefined(); expect(quality?.reason).toBeTruthy();
    expect(quality?.recommendedAction).not.toContain("memory_deps");
    expect(quality?.severity).toBe(status === "conflict" ? "error" : "warning");
  });
});

it("does not duplicate an existing main-file conflict finding or hide an unrelated conflict", () => {
  const path = ".agents/memory/core/MEMORY.md";
  const index = surfaceIndex({ core: surfaceEntry({ mainFileType: "conflict" }) });
  const duplicate = buildGovernanceActionItems({ index, inventory, contextFindings: [{
    code: "context_memory_main_file_conflict", severity: "error", message: "conflicting main files", assets: [], paths: [path],
  }] });
  expect(duplicate).toHaveLength(1); expect(duplicate[0].kind).toBe("context");
  const separate = buildGovernanceActionItems({ index, inventory, contextFindings: [{
    code: "context_memory_main_file_conflict", severity: "error", message: "another card conflict", assets: [], paths: [".agents/memory/other/MEMORY.md"],
  }] });
  expect(separate).toHaveLength(2); expect(separate.find(item => item.cartridgeId === "core")?.targetPath).toBeUndefined();
});
