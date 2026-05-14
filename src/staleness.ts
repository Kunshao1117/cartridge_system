const STALENESS_THRESHOLDS = { significant: 10, critical: 30 };

export function stalenessToLevel(staleness: number): string {
  if (staleness <= 0) return "healthy";
  if (staleness < STALENESS_THRESHOLDS.significant) return "mild";
  if (staleness < STALENESS_THRESHOLDS.critical) return "significant";
  return "critical";
}
