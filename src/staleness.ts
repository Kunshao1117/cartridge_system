import type { CartridgeConfig, StalenessLevel } from "./types.js";

const STALENESS_THRESHOLDS = { significant: 10, critical: 30 };

export function stalenessToLevel(staleness: number): string {
  if (staleness <= 0) return "healthy";
  if (staleness < STALENESS_THRESHOLDS.significant) return "mild";
  if (staleness < STALENESS_THRESHOLDS.critical) return "significant";
  return "critical";
}

export function getStalenessLevel(
  staleness: number,
  config: CartridgeConfig,
): StalenessLevel {
  if (staleness <= 0) return "healthy";
  if (staleness < config.thresholds.significant) return "mild";
  if (staleness < config.thresholds.critical) return "significant";
  return "critical";
}
