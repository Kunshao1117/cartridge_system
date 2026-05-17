import type { ContextInventory } from "./context-types.js";
import type { CartridgeIndex } from "./types.js";

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
  const entries = Object.values(args.index.cartridges);
  const blockers = args.contextFindings.filter((item) => item.severity === "error");
  const warnings = args.contextFindings.filter(
    (item) => item.severity === "warning",
  );
  const memory = {
    total: entries.length,
    stale: entries.filter((entry) => entry.staleness > 0).length,
    critical: entries.filter((entry) => entry.staleness >= 100).length,
    ghostFiles: entries.reduce(
      (sum, entry) => sum + (entry.ghostFiles?.length ?? 0),
      0,
    ),
    untrackedFiles: args.index.untrackedFiles?.length ?? 0,
    pendingChanges: entries.reduce(
      (sum, entry) => sum + (entry.pendingChanges?.length ?? 0),
      0,
    ),
  };

  const status =
    blockers.length > 0 || memory.critical > 0
      ? "blocked"
      : warnings.length > 0 ||
          memory.stale > 0 ||
          memory.ghostFiles > 0 ||
          memory.untrackedFiles > 0
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
