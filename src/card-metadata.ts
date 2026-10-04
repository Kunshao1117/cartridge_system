/** Shared runtime metadata contract for index ingestion and read-only quality tools. */
export function normalizeCardMetadata(data: Record<string, unknown>): { description: string; lastUpdated: string; warnings: string[] } {
  const warnings: string[] = [];
  const description = typeof data.description === "string" ? data.description : "";
  if (data.description != null && typeof data.description !== "string") warnings.push("Invalid description: expected a string.");
  const rawDate = data.last_updated;
  let lastUpdated = "";
  if (rawDate instanceof Date && Number.isFinite(rawDate.getTime())) lastUpdated = rawDate.toISOString();
  else if (typeof rawDate === "string" && (!rawDate || Number.isFinite(Date.parse(rawDate)))) lastUpdated = rawDate;
  else if (rawDate != null) warnings.push("Invalid last_updated: expected a valid date string or YAML timestamp.");
  if (lastUpdated && Date.parse(lastUpdated) > Date.now()) warnings.push("Invalid last_updated: future timestamps do not reduce staleness.");
  return { description, lastUpdated, warnings };
}
