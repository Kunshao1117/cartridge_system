import type { CartridgeIndex } from "./types.js";
import { classifyMemoryWarnings } from "./staleness.js";
import { createVisibleCartridgeIndex } from "./visible-index.js";

export type CanonicalProjectHealthStatus = "ready" | "warning" | "blocked";

export interface CanonicalProjectHealth {
  status: CanonicalProjectHealthStatus;
  syncWarning: string | null;
  blocking: number;
  review: number;
  advisory: number;
  info: number;
}

/** Pure shared projection consumed by both Desktop and VS Code surfaces. */
export function projectCanonicalHealth(
  source: CartridgeIndex,
  syncWarning: string | null = null,
): CanonicalProjectHealth {
  const warnings = classifyMemoryWarnings(createVisibleCartridgeIndex(source));
  const canonicalStatus: CanonicalProjectHealthStatus =
    warnings.blocking.length > 0
      ? "blocked"
      : warnings.review.length > 0 || warnings.advisory.length > 0
        ? "warning"
        : "ready";
  return {
    status:
      canonicalStatus === "ready" && syncWarning ? "warning" : canonicalStatus,
    syncWarning,
    blocking: warnings.blocking.length,
    review: warnings.review.length,
    advisory: warnings.advisory.length,
    info: warnings.info.length,
  };
}
