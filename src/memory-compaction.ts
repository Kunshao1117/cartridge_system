import matter from "gray-matter";

export const MEMORY_SCHEMA_VERSION = 2;
export const DEFAULT_MAIN_CARD_SIZE_LIMIT_BYTES = 16 * 1024;
export const DEFAULT_ARCHIVE_CARD_SIZE_LIMIT_BYTES = 32 * 1024;
export const DEFAULT_ROOT_INDEX_SIZE_LIMIT_BYTES = 8 * 1024;
export const DEFAULT_MAIN_CARD_LINE_LIMIT = 120;
export const DEFAULT_ARCHIVE_CARD_LINE_LIMIT = 200;
export const DEFAULT_CYCLE_EVENT_LIMIT = 30;
export const DEFAULT_CHINESE_RATIO_WARNING = 0.35;

export type CompactionStatus = "ready" | "due" | "blocked" | "legacy";
export type MemoryCardKind = "main" | "root_index" | "archive_volume";
export type CompactionCompliance = "ok" | "advisory" | "due" | "invalid";

export type CompactionRecommendedAction =
  | "none"
  | "compact"
  | "split_or_archive"
  | "open_next_archive"
  | "lazy_upgrade";

export interface MemoryArchiveVolumeMetrics {
  filePath: string;
  sizeBytes: number;
  lineCount: number;
  sizeLimitBytes: number;
  lineLimit: number;
  needsCompaction: boolean;
  recommendedAction: CompactionRecommendedAction;
  reasons: string[];
}

export interface MemoryCompactionMetrics {
  cardKind: MemoryCardKind;
  limitKind: MemoryCardKind;
  compliance: CompactionCompliance;
  schemaVersion: number | null;
  isLegacy: boolean;
  contentLanguage: string;
  humanLanguage: string;
  sizeBytes: number;
  lineCount: number;
  chineseCharCount: number;
  bodyCharCount: number;
  chineseRatio: number;
  cycleId: string;
  cycleEventCount: number;
  cycleEventLimit: number;
  sizeLimitBytes: number;
  lineLimit: number | null;
  archivePolicy: string;
  compactionStatus: CompactionStatus;
  needsCompaction: boolean;
  recommendedAction: CompactionRecommendedAction;
  reasons: string[];
  archiveVolumes?: MemoryArchiveVolumeMetrics[];
  archiveMigrationWarnings?: string[];
}

interface MetricsOptions {
  archiveCard?: boolean;
  cardKind?: MemoryCardKind;
  cardPath?: string;
  archiveVolumes?: MemoryArchiveVolumeMetrics[];
  archiveMigrationWarnings?: string[];
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function normalize(content: string): string {
  return content.replace(/\r\n/g, "\n");
}

function hasFiniteLineLimit(lineLimit: number | null): lineLimit is number {
  return typeof lineLimit === "number" && Number.isFinite(lineLimit);
}

function normalizePathForKind(cardPath: string | undefined): string {
  return (cardPath ?? "").replace(/\\/g, "/").toLowerCase();
}

export function detectMemoryCardKind(cardPath?: string): MemoryCardKind {
  const normalizedPath = normalizePathForKind(cardPath);
  if (/\/archive-\d{3}\.md$/.test(normalizedPath)) return "archive_volume";
  if (/\/\.agents\/memory\/_map\/skill\.md$/.test(normalizedPath)) {
    return "root_index";
  }
  if (/^\.agents\/memory\/_map\/skill\.md$/.test(normalizedPath)) {
    return "root_index";
  }
  return "main";
}

function limitsForKind(kind: MemoryCardKind): {
  sizeBytes: number;
  lines: number | null;
} {
  if (kind === "archive_volume") {
    return {
      sizeBytes: DEFAULT_ARCHIVE_CARD_SIZE_LIMIT_BYTES,
      lines: DEFAULT_ARCHIVE_CARD_LINE_LIMIT,
    };
  }
  if (kind === "root_index") {
    return {
      sizeBytes: DEFAULT_ROOT_INDEX_SIZE_LIMIT_BYTES,
      lines: null,
    };
  }
  return {
    sizeBytes: DEFAULT_MAIN_CARD_SIZE_LIMIT_BYTES,
    lines: DEFAULT_MAIN_CARD_LINE_LIMIT,
  };
}

export function extractSection(content: string, heading: string): string {
  const normalized = normalize(content);
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(?:^|\\n)## ${escaped}[ \\t]*\\n([\\s\\S]*?)(?=\\n## |$)`,
  );
  return pattern.exec(normalized)?.[1] ?? "";
}

function stripSection(content: string, heading: string): string {
  const normalized = normalize(content);
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return normalized.replace(
    new RegExp(`(?:^|\\n)## ${escaped}[ \\t]*\\n[\\s\\S]*?(?=\\n## |$)`, "g"),
    "\n",
  );
}

export function countCycleEvents(content: string): number {
  const section = extractSection(content, "Cycle Events");
  if (!section.trim()) return 0;
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^(?:[-*]\s+|\d+[.)]\s+)/.test(line)).length;
}

export function estimateChineseRatio(content: string): {
  chineseCharCount: number;
  bodyCharCount: number;
  chineseRatio: number;
} {
  let body = normalize(content).replace(/^---\n[\s\S]*?\n---\n?/, "");
  body = stripSection(body, "中文摘要");
  body = stripSection(body, "Tracked Files");
  body = body
    .split("\n")
    .filter((line) => !/^\s*(description|trigger keywords?)\s*:/i.test(line))
    .join("\n");
  const chars = [...body].filter((char) => /\S/u.test(char));
  const chineseCharCount = chars.filter((char) => /\p{Script=Han}/u.test(char))
    .length;
  const bodyCharCount = chars.length;
  return {
    chineseCharCount,
    bodyCharCount,
    chineseRatio: bodyCharCount === 0 ? 0 : chineseCharCount / bodyCharCount,
  };
}

function reasonForSize(kind: MemoryCardKind): string {
  if (kind === "archive_volume") return "archiveVolumeOversize";
  if (kind === "root_index") return "rootIndexOversize";
  return "mainCardOversize";
}

function reasonForLines(kind: MemoryCardKind): string {
  if (kind === "archive_volume") return "archiveVolumeLineLimit";
  return "mainCardLineLimit";
}

function actionForHardLimit(kind: MemoryCardKind): CompactionRecommendedAction {
  if (kind === "archive_volume") return "open_next_archive";
  return "split_or_archive";
}

export function buildArchiveVolumeMetrics(
  rawContent: string,
  filePath: string,
): MemoryArchiveVolumeMetrics {
  const normalized = normalize(rawContent);
  const sizeBytes = Buffer.byteLength(rawContent, "utf-8");
  const lineCount = normalized.length === 0 ? 0 : normalized.split("\n").length;
  const sizeLimitBytes = DEFAULT_ARCHIVE_CARD_SIZE_LIMIT_BYTES;
  const lineLimit = DEFAULT_ARCHIVE_CARD_LINE_LIMIT;
  const reasons: string[] = [];

  if (sizeBytes > sizeLimitBytes) reasons.push("archiveVolumeOversize");
  if (lineCount > lineLimit) reasons.push("archiveVolumeLineLimit");

  return {
    filePath,
    sizeBytes,
    lineCount,
    sizeLimitBytes,
    lineLimit,
    needsCompaction: reasons.length > 0,
    recommendedAction: reasons.length > 0 ? "open_next_archive" : "none",
    reasons,
  };
}

export function buildCompactionMetrics(
  rawContent: string,
  frontmatterInput?: Record<string, unknown>,
  options: MetricsOptions = {},
): MemoryCompactionMetrics {
  const parsed = frontmatterInput ? null : matter(rawContent);
  const frontmatter = frontmatterInput ?? (parsed?.data as Record<string, unknown>);
  const body = parsed?.content ?? rawContent.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const normalized = normalize(rawContent);
  const cardKind =
    options.cardKind ??
    (options.archiveCard ? "archive_volume" : detectMemoryCardKind(options.cardPath));
  const limitKind = cardKind;
  const defaultLimits = limitsForKind(limitKind);
  const schemaVersion =
    "memory_schema_version" in frontmatter
      ? asNumber(frontmatter.memory_schema_version, NaN)
      : null;
  const isLegacy =
    cardKind !== "archive_volume" && schemaVersion !== MEMORY_SCHEMA_VERSION;
  const sizeLimitBytes =
    cardKind === "main"
      ? asNumber(frontmatter.size_limit_bytes, defaultLimits.sizeBytes)
      : defaultLimits.sizeBytes;
  const lineLimit =
    cardKind === "main" && hasFiniteLineLimit(defaultLimits.lines)
      ? asNumber(frontmatter.line_limit, defaultLimits.lines)
      : defaultLimits.lines;
  const cycleEventLimit = asNumber(
    frontmatter.cycle_event_limit,
    DEFAULT_CYCLE_EVENT_LIMIT,
  );
  const actualCycleEventCount = countCycleEvents(body);
  const declaredCycleEventCount = asNumber(frontmatter.cycle_event_count, NaN);
  const cycleEventCount = asNumber(
    Number.isFinite(declaredCycleEventCount)
      ? Math.max(declaredCycleEventCount, actualCycleEventCount)
      : actualCycleEventCount,
    actualCycleEventCount,
  );
  const sizeBytes = Buffer.byteLength(rawContent, "utf-8");
  const lineCount = normalized.length === 0 ? 0 : normalized.split("\n").length;
  const language = estimateChineseRatio(body);
  const reasons: string[] = [];

  if (isLegacy) reasons.push("legacySchema");
  const skipHardLimits = isLegacy && cardKind === "main";
  const sizeExceeded = !skipHardLimits && sizeBytes > sizeLimitBytes;
  const lineExceeded =
    !skipHardLimits && hasFiniteLineLimit(lineLimit) && lineCount > lineLimit;
  if (sizeExceeded) reasons.push(reasonForSize(limitKind));
  if (lineExceeded) reasons.push(reasonForLines(limitKind));
  if (!skipHardLimits && cardKind !== "archive_volume") {
    if (cycleEventCount > cycleEventLimit) {
      reasons.push("cycleEventLimitExceeded", "cycleEventLimit");
    } else if (cycleEventCount === cycleEventLimit) {
      reasons.push("cycleEventLimitReached", "cycleEventLimit");
    }
  }
  if (
    asString(frontmatter.content_language, "en") === "en" &&
    language.chineseRatio > DEFAULT_CHINESE_RATIO_WARNING
  ) {
    reasons.push("highChineseRatio");
  }

  const needsCompaction =
    !skipHardLimits &&
    (sizeExceeded ||
      lineExceeded ||
      reasons.includes("cycleEventLimitReached") ||
      reasons.includes("cycleEventLimitExceeded"));
  const compliance: CompactionCompliance = reasons.includes("cycleEventLimitExceeded")
      ? "invalid"
      : needsCompaction
        ? "due"
        : isLegacy
          ? "advisory"
        : reasons.includes("highChineseRatio")
          ? "advisory"
          : "ok";
  const declaredStatus = asString(frontmatter.compaction_status, "ready");
  const compactionStatus: CompactionStatus = isLegacy && !needsCompaction
    ? "legacy"
    : compliance === "invalid"
      ? "blocked"
    : declaredStatus === "blocked"
      ? "blocked"
      : needsCompaction
        ? "due"
        : "ready";
  const recommendedAction: CompactionRecommendedAction = needsCompaction
    ? sizeExceeded || lineExceeded
      ? actionForHardLimit(limitKind)
      : "compact"
    : isLegacy
      ? "lazy_upgrade"
      : language.chineseRatio > DEFAULT_CHINESE_RATIO_WARNING
        ? "compact"
        : "none";

  return {
    cardKind,
    limitKind,
    compliance,
    schemaVersion: Number.isFinite(schemaVersion) ? schemaVersion : null,
    isLegacy,
    contentLanguage: asString(frontmatter.content_language, "en"),
    humanLanguage: asString(frontmatter.human_language, "zh-TW"),
    sizeBytes,
    lineCount,
    chineseCharCount: language.chineseCharCount,
    bodyCharCount: language.bodyCharCount,
    chineseRatio: Number(language.chineseRatio.toFixed(4)),
    cycleId: asString(frontmatter.cycle_id, ""),
    cycleEventCount,
    cycleEventLimit,
    sizeLimitBytes,
    lineLimit,
    archivePolicy: asString(frontmatter.archive_policy, "volume"),
    compactionStatus,
    needsCompaction,
    recommendedAction,
    reasons,
    archiveVolumes: options.archiveVolumes,
    archiveMigrationWarnings: options.archiveMigrationWarnings,
  };
}

export function formatCompactionWarnings(
  moduleName: string,
  metrics: MemoryCompactionMetrics,
): string[] {
  const warnings: string[] = [];
  if (metrics.isLegacy) {
    warnings.push(
      `⚠️ [MEMORY_LEGACY_SCHEMA] "${moduleName}" 使用舊記憶格式；可讀取，但下次更新前應懶升級為 memory_schema_version: 2。`,
    );
  }
  if (metrics.needsCompaction) {
    warnings.push(
      `⚠️ [MEMORY_COMPACTION_DUE] "${moduleName}" 需要先彙整：size=${metrics.sizeBytes}/${metrics.sizeLimitBytes} bytes, lines=${metrics.lineCount}/${metrics.lineLimit}, cycleEvents=${metrics.cycleEventCount}/${metrics.cycleEventLimit}。`,
    );
  }
  if (metrics.reasons.includes("cycleEventLimitExceeded")) {
    warnings.push(
      `⛔ [MEMORY_CYCLE_EVENTS_INVALID] "${moduleName}" Cycle Events 已超過 ${metrics.cycleEventLimit} 筆；請先彙整後再同步。`,
    );
  }
  if (metrics.reasons.includes("highChineseRatio")) {
    warnings.push(
      `⚠️ [MEMORY_LANGUAGE_RATIO] "${moduleName}" 主體中文比例 ${(metrics.chineseRatio * 100).toFixed(1)}%，新格式建議英文主體、中文只保留摘要與索引。`,
    );
  }
  return warnings;
}
