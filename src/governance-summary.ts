import type { ContextInventory } from "./context-types.js";
import { classifyMemoryWarnings } from "./staleness.js";
import type { CartridgeIndex } from "./types.js";
import { createVisibleCartridgeIndex } from "./index-manager.js";

export type GovernanceStatus = "ready" | "warning" | "blocked";

export interface GovernanceSummary {
  status: GovernanceStatus;
  memory: {
    total: number;
    stale: number;
    critical: number;
    ghostFiles: number;
    untrackedFiles: number;
    pendingChanges: number;
    blockingItems: number;
    reviewItems: number;
    advisoryItems: number;
    compactionDue: number;
  };
  context: {
    assets: number;
    existing: number;
    missing: number;
    blockers: number;
    warnings: number;
    informational: number;
  };
}

export function buildGovernanceSummary(args: {
  index: CartridgeIndex;
  inventory: ContextInventory;
  contextFindings: Array<{ severity: "info" | "warning" | "error" }>;
}): GovernanceSummary {
  const index = createVisibleCartridgeIndex(args.index);
  const entries = Object.values(index.cartridges);
  const blockers = args.contextFindings.filter((item) => item.severity === "error");
  const warnings = args.contextFindings.filter(
    (item) => item.severity === "warning",
  );
  const memoryWarnings = classifyMemoryWarnings(index);
  const memory = {
    total: entries.length,
    stale: entries.filter((entry) => entry.staleness > 0).length,
    critical: entries.filter((entry) => entry.staleness >= 100).length,
    ghostFiles: entries.reduce(
      (sum, entry) => sum + (entry.ghostFiles?.length ?? 0),
      0,
    ),
    untrackedFiles: index.untrackedFiles?.length ?? 0,
    pendingChanges: entries.reduce(
      (sum, entry) => sum + (entry.pendingChanges?.length ?? 0),
      0,
    ),
    blockingItems: memoryWarnings.blocking.length,
    reviewItems: memoryWarnings.review.length,
    advisoryItems: memoryWarnings.advisory.length,
    compactionDue: entries.filter((entry) => entry.compaction?.needsCompaction)
      .length,
  };

  const status =
    blockers.length > 0 || memory.blockingItems > 0
      ? "blocked"
      : warnings.length > 0 ||
          memory.reviewItems > 0 ||
          memory.advisoryItems > 0
        ? "warning"
        : "ready";

  return {
    status,
    memory,
    context: {
      assets: args.inventory.totals.assets,
      existing: args.inventory.totals.existing,
      missing: args.inventory.totals.missing,
      blockers: blockers.length,
      warnings: warnings.length,
      informational: args.contextFindings.filter((item) => item.severity === "info")
        .length,
    },
  };
}
