import * as fs from "fs/promises";
import * as path from "path";
import * as z from "zod";
import matter from "gray-matter";
import {
  buildDependencyGraph,
  detectCycles,
  type DependencyGraph,
} from "./dependency-propagator.js";
import { validateDependencySemantics } from "./dependency-semantics.js";
import type { CompatibilityMode } from "./memory-compatibility.js";
import {
  createToolEnvelope,
  createToolErrorEnvelope,
  toMcpTextResult,
  type CartridgeFinding,
  type CartridgeToolStatus,
  type McpToolResult,
} from "./mcp-response.js";
import {
  filterVisibleUntrackedFiles,
  parseTrackedFiles,
  shouldWarnEmptyTrackedFiles,
} from "./index-manager.js";
import {
  buildArchiveVolumeMetrics,
  buildCompactionMetrics,
  type MemoryArchiveVolumeMetrics,
  type MemoryCompactionMetrics,
} from "./memory-compaction.js";
import {
  analyzeMemoryContentQuality,
  countLegacyMainFileReferences,
  hasChildMemoryCardDirectory,
  moduleNameFromMemoryMainPath,
  resolveMemoryMainFileInDirectory,
  type MemoryMainFileInfo,
  type MemoryQualityReport,
} from "./memory-main-file.js";
import { validateProjectRoot } from "./path-guard.js";
import type { CartridgeEntry, CartridgeIndex } from "./types.js";

type CycleSource = "frontmatter" | "engineering" | "persistedIndex";

interface MemoryAuditCycle {
  source: CycleSource;
  path: string[];
}

export interface MemoryAuditFinding {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  module?: string;
  file?: string;
}

export interface MemoryAuditReport {
  compatibility: {
    mode: CompatibilityMode;
    warningCount: number;
  };
  summary: {
    cards: number;
    stale: number;
    ghostFiles: number;
    untrackedFiles: number;
    oversized: number;
    pendingWithZeroStaleness: number;
    cycles: number;
    persistedIndexCycles: number;
    dependencySemanticWarnings: number;
    legacyCards: number;
    compactionDue: number;
    cycleLimitReached: number;
    invalidCycleEvents: number;
    oversizedContent: number;
    archiveVolumeDue: number;
    archiveMigrationWarnings: number;
    memoryMainFiles: number;
    legacyMainFiles: number;
    mainFileConflicts: number;
    missingMainFiles: number;
    legacyPathReferences: number;
    missingQualityFields: number;
    missingQualitySections: number;
    evidenceWarnings: number;
    pendingQualityReview: number;
    supersededQuality: number;
    granularityAdvisories: number;
    languageWarnings: number;
  };
  findings: MemoryAuditFinding[];
  cycles: string[][];
  cycleDetails: MemoryAuditCycle[];
  persistedIndexCycles: string[][];
}

interface AuditIndexEntry {
  skillPath?: string;
  staleness?: number;
  trackedFiles?: string[];
  pendingChanges?: unknown[];
  ghostFiles?: string[];
  indirectStaleness?: number;
  dependencies?: string[];
  parent?: string | null;
  compaction?: MemoryCompactionMetrics;
  mainFile?: MemoryMainFileInfo;
  mainFileType?: string;
  contentQuality?: MemoryQualityReport;
  contentQualityStatus?: string;
  migrationRequired?: boolean;
  legacyCompatibility?: boolean;
}

interface AuditIndex {
  cartridges?: Record<string, AuditIndexEntry>;
  fileMap?: Record<string, string[]>;
  untrackedFiles?: unknown[];
}

interface MemoryCard {
  module: string;
  skillPath: string;
  absolutePath: string;
  raw: string;
  body: string;
  frontmatter: Record<string, unknown>;
  trackedFiles: string[];
  compaction: MemoryCompactionMetrics;
  mainFile: MemoryMainFileInfo;
  contentQuality: MemoryQualityReport;
  legacyPathReferenceCount: number;
}

const projectRootField = z
  .string()
  .min(1)
  .refine((p) => path.isAbsolute(p) && !p.includes(".."), {
    message: "必須為絕對路徑且不含路徑穿越符號",
  });

export const memoryAuditSchema = z.object({
  projectRoot: projectRootField,
});

const TOOL_NAME = "memory_audit";
const REQUIRED_FRONTMATTER = ["name", "description", "last_updated", "staleness"];
const REQUIRED_INDEX_ENTRY_FIELDS = [
  "ghostFiles",
  "dependencies",
  "indirectStaleness",
];

function normalizeRelative(projectRoot: string, absolutePath: string): string {
  return path.relative(projectRoot, absolutePath).replace(/\\/g, "/");
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function collectMemoryCardDirectories(
  projectRoot: string,
  root: string,
  requireMemPrefix: boolean,
): Promise<string[]> {
  if (!(await pathExists(root))) return [];
  const results: string[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 5) return;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.toLowerCase() === "archive") continue;
        if (depth === 1 && requireMemPrefix && !entry.name.startsWith("mem-")) {
          continue;
        }
        const resolution = await resolveMemoryMainFileInDirectory(
          projectRoot,
          fullPath,
        );
        if (
          resolution.mainFile.type !== "missing" ||
          (await hasChildMemoryCardDirectory(projectRoot, fullPath))
        ) {
          results.push(fullPath);
        }
        await walk(fullPath, depth + 1);
      }
    }
  }

  await walk(root, 1);
  return results;
}

async function readIndex(projectRoot: string): Promise<{
  index: AuditIndex;
  findings: MemoryAuditFinding[];
}> {
  const indexPath = path.join(projectRoot, ".cartridge", "index.json");
  try {
    const raw = await fs.readFile(indexPath, "utf-8");
    const parsed = JSON.parse(raw) as AuditIndex;
    if (Array.isArray(parsed.untrackedFiles)) {
      parsed.untrackedFiles = filterVisibleUntrackedFiles(
        parsed.untrackedFiles,
      );
    }
    const findings: MemoryAuditFinding[] = [];
    if (!parsed.cartridges || typeof parsed.cartridges !== "object") {
      findings.push({
        severity: "warning",
        code: "INDEX_CARTRIDGES_MISSING",
        message: ".cartridge/index.json 缺少 cartridges，將降低記憶卡判讀精度。",
        file: ".cartridge/index.json",
      });
    }
    if (!parsed.fileMap || typeof parsed.fileMap !== "object") {
      findings.push({
        severity: "warning",
        code: "INDEX_FILEMAP_MISSING",
        message: ".cartridge/index.json 缺少 fileMap，無法完整比對檔案歸屬。",
        file: ".cartridge/index.json",
      });
    }
    if (!Array.isArray(parsed.untrackedFiles)) {
      findings.push({
        severity: "warning",
        code: "INDEX_UNTRACKED_MISSING",
        message: ".cartridge/index.json 缺少 untrackedFiles，可能是舊索引格式。",
        file: ".cartridge/index.json",
      });
    }
    return { index: parsed, findings };
  } catch {
    return {
      index: { cartridges: {}, fileMap: {}, untrackedFiles: [] },
      findings: [
        {
          severity: "warning",
          code: "INDEX_MISSING",
          message:
            "找不到 .cartridge/index.json，工具將以 SKILL.md 掃描結果進入相容模式。",
          file: ".cartridge/index.json",
        },
      ],
    };
  }
}

async function readMemoryCards(projectRoot: string): Promise<MemoryCard[]> {
  const memoryDirs = await collectMemoryCardDirectories(
    projectRoot,
    path.join(projectRoot, ".agents", "memory"),
    false,
  );
  const legacySkillDirs = await collectMemoryCardDirectories(
    projectRoot,
    path.join(projectRoot, ".agents", "skills"),
    true,
  );
  const cardDirs = [...memoryDirs, ...legacySkillDirs];

  const cards: MemoryCard[] = [];
  for (const cardDir of cardDirs) {
    const resolution = await resolveMemoryMainFileInDirectory(projectRoot, cardDir);
    const mainFile = resolution.mainFile;
    const activeRelativePath =
      mainFile.activePath ?? mainFile.candidatePaths[0] ?? resolution.relativeDirectory;
    const absolutePath = mainFile.activePath
      ? path.join(projectRoot, mainFile.activePath)
      : cardDir;
    const archiveVolumes = await readArchiveVolumes(projectRoot, cardDir);
    const archiveMigrationWarnings = await findLegacyArchiveSkillPaths(
      projectRoot,
      cardDir,
    );
    if (mainFile.type === "conflict" || !mainFile.activePath) {
      const raw = "";
      const contentQuality = analyzeMemoryContentQuality(raw, mainFile);
      cards.push({
        module: moduleNameFromMemoryMainPath(activeRelativePath),
        skillPath: activeRelativePath,
        absolutePath,
        raw,
        body: "",
        frontmatter: {},
        trackedFiles: [],
        compaction: buildCompactionMetrics(raw, {}, {
          cardPath: absolutePath,
          archiveVolumes,
          archiveMigrationWarnings,
        }),
        mainFile,
        contentQuality,
        legacyPathReferenceCount: 0,
      });
      continue;
    }

    const raw = await fs.readFile(absolutePath, "utf-8");
    const parsed = matter(raw);
    const frontmatter = parsed.data as Record<string, unknown>;
    const contentQuality = analyzeMemoryContentQuality(raw, mainFile);
    cards.push({
      module: moduleNameFromMemoryMainPath(activeRelativePath),
      skillPath: activeRelativePath,
      absolutePath,
      raw,
      body: parsed.content,
      frontmatter,
      trackedFiles: parseTrackedFiles(raw),
      compaction: buildCompactionMetrics(raw, frontmatter, {
        cardPath: absolutePath,
        archiveVolumes,
        archiveMigrationWarnings,
      }),
      mainFile,
      contentQuality,
      legacyPathReferenceCount: countLegacyMainFileReferences(raw),
    });
  }
  return cards;
}

async function readArchiveVolumes(
  projectRoot: string,
  cardDir: string,
): Promise<MemoryArchiveVolumeMetrics[]> {
  let entries: Array<{ name: string; isFile: () => boolean }>;
  try {
    entries = await fs.readdir(cardDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const volumes = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && /^archive-\d{3}\.md$/i.test(entry.name))
      .map(async (entry) => {
        const archivePath = path.join(cardDir, entry.name);
        const raw = await fs.readFile(archivePath, "utf-8");
        return buildArchiveVolumeMetrics(
          raw,
          normalizeRelative(projectRoot, archivePath),
        );
      }),
  );
  return volumes;
}

async function findLegacyArchiveSkillPaths(
  projectRoot: string,
  cardDir: string,
): Promise<string[]> {
  const archiveDir = path.join(cardDir, "archive");
  if (!(await pathExists(archiveDir))) return [];

  const warnings: string[] = [];
  const stack = [archiveDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    let entries: Array<{
      name: string;
      isDirectory: () => boolean;
      isFile: () => boolean;
    }>;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase() === "skill.md") {
        warnings.push(normalizeRelative(projectRoot, entryPath));
      }
    }
  }
  return warnings;
}

function parseTrackedFilesLoosely(content: string): string[] {
  const normalized = content.replace(/\r\n/g, "\n");
  const trackedSection = normalized.match(
    /## Tracked Files\S*[ \t]*\n([\s\S]*?)(?=\n## |\n---|\s*$)/,
  )?.[1];
  if (!trackedSection) return [];
  return trackedSection
    .split("\n")
    .map((line) =>
      line
        .replace(/^-\s*/, "")
        .replace(/`/g, "")
        .replace(/\s.*$/, "")
        .trim(),
    )
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function auditFrontmatter(card: MemoryCard): MemoryAuditFinding[] {
  if (card.mainFile.type === "conflict" || card.mainFile.type === "missing") {
    return [];
  }
  const findings: MemoryAuditFinding[] = [];
  for (const field of REQUIRED_FRONTMATTER) {
    if (!(field in card.frontmatter)) {
      findings.push({
        severity: "warning",
        code: "FRONTMATTER_FIELD_MISSING",
        message: `${card.module} frontmatter 缺少 ${field} 欄位。`,
        module: card.module,
        file: card.skillPath,
      });
    }
  }
  if (!card.frontmatter.metadata) {
    findings.push({
      severity: "warning",
      code: "FRONTMATTER_METADATA_MISSING",
      message: `${card.module} frontmatter 缺少 metadata 區塊，可能是舊記憶卡格式。`,
      module: card.module,
      file: card.skillPath,
    });
  }
  return findings;
}

function auditTrackedFiles(card: MemoryCard): MemoryAuditFinding[] {
  if (card.mainFile.type === "conflict" || card.mainFile.type === "missing") {
    return [];
  }
  const findings: MemoryAuditFinding[] = [];
  const normalized = card.raw.replace(/\r\n/g, "\n");
  if (!/^## Tracked Files[ \t]*$/m.test(normalized)) {
    findings.push({
      severity: "warning",
      code: "TRACKED_FILES_SECTION_MISSING",
      message: `${card.module} 缺少 ## Tracked Files 區塊。`,
      module: card.module,
      file: card.skillPath,
    });
  }
  if (/^## Tracked Files\S+/m.test(normalized)) {
    findings.push({
      severity: "warning",
      code: "TRACKED_FILES_HEADING_TYPO",
      message: `${card.module} 的 Tracked Files 標題疑似拼寫錯誤。`,
      module: card.module,
      file: card.skillPath,
    });
  }
  if (shouldWarnEmptyTrackedFiles(card.raw)) {
    findings.push({
      severity: "warning",
      code: "TRACKED_FILES_EMPTY",
      message: `${card.module} 的 Tracked Files 區塊為空。`,
      module: card.module,
      file: card.skillPath,
    });
  }
  const trackedFiles =
    card.trackedFiles.length > 0 ? card.trackedFiles : parseTrackedFilesLoosely(card.raw);
  if (trackedFiles.length > 8) {
    findings.push({
      severity: "warning",
      code: "MEMORY_GRANULARITY_ADVISORY",
      message: `${card.module} 追蹤 ${trackedFiles.length} 個檔案；這只是拆分建議，不應單獨阻擋提交。`,
      module: card.module,
      file: card.skillPath,
    });
  }
  for (const trackedFile of trackedFiles) {
    if (path.isAbsolute(trackedFile)) {
      findings.push({
        severity: "error",
        code: "TRACKED_FILE_ABSOLUTE",
        message: `${card.module} 追蹤了絕對路徑：${trackedFile}`,
        module: card.module,
        file: card.skillPath,
      });
    }
    if (trackedFile.includes("..")) {
      findings.push({
        severity: "error",
        code: "TRACKED_FILE_TRAVERSAL",
        message: `${card.module} 追蹤路徑含有 ..：${trackedFile}`,
        module: card.module,
        file: card.skillPath,
      });
    }
  }
  return findings;
}

function auditMemoryMainFileAndQuality(card: MemoryCard): MemoryAuditFinding[] {
  const findings: MemoryAuditFinding[] = [];
  if (card.mainFile.type === "conflict") {
    findings.push({
      severity: "error",
      code: "MEMORY_MAIN_FILE_CONFLICT",
      message: `${card.module} 同時存在 MEMORY.md 與 SKILL.md，必須先人工解決，工具不可靜默選擇任一主檔。`,
      module: card.module,
      file: card.mainFile.candidatePaths.join(", "),
    });
    return findings;
  }
  if (card.mainFile.type === "missing") {
    findings.push({
      severity: "error",
      code: "MEMORY_MAIN_FILE_MISSING",
      message: `${card.module} 缺少作用中記憶主檔。`,
      module: card.module,
      file: card.skillPath,
    });
    return findings;
  }
  if (card.mainFile.type === "legacy SKILL.md") {
    findings.push({
      severity: "warning",
      code: "MEMORY_MAIN_FILE_LEGACY",
      message: `${card.module} 仍使用 legacy SKILL.md；可讀但需要遷移到 MEMORY.md。`,
      module: card.module,
      file: card.skillPath,
    });
  }
  if (card.contentQuality.missingFields.length > 0) {
    findings.push({
      severity: "warning",
      code: "MEMORY_QUALITY_FIELD_MISSING",
      message: `${card.module} 缺少品質欄位：${card.contentQuality.missingFields.join(", ")}。`,
      module: card.module,
      file: card.skillPath,
    });
  }
  if (card.contentQuality.missingSections.length > 0) {
    findings.push({
      severity: "warning",
      code: "MEMORY_QUALITY_SECTION_MISSING",
      message: `${card.module} 缺少品質段落：${card.contentQuality.missingSections.join(", ")}。`,
      module: card.module,
      file: card.skillPath,
    });
  }
  if (card.contentQuality.evidenceWarnings.length > 0) {
    findings.push({
      severity: "warning",
      code: "MEMORY_QUALITY_EVIDENCE_MISSING",
      message: `${card.module} Evidence Base 缺少可驗證證據；缺工具或缺證據不可視為通過。`,
      module: card.module,
      file: card.skillPath,
    });
  }
  if (card.contentQuality.status === "pending_review") {
    findings.push({
      severity: "warning",
      code: "MEMORY_QUALITY_PENDING_REVIEW",
      message: `${card.module} verification_status 尚未達已驗證；缺工具或缺證據不可視為通過。`,
      module: card.module,
      file: card.skillPath,
    });
  }
  if (card.contentQuality.status === "superseded") {
    findings.push({
      severity: "warning",
      code: "MEMORY_QUALITY_SUPERSEDED",
      message: `${card.module} 已標記為取代/被取代，需確認是否仍為作用中主卡。`,
      module: card.module,
      file: card.skillPath,
    });
  }
  if (card.legacyPathReferenceCount > 0) {
    findings.push({
      severity: "warning",
      code: "MEMORY_LEGACY_PATH_REFERENCE",
      message: `${card.module} 內文仍引用 .agents/memory/**/SKILL.md ${card.legacyPathReferenceCount} 次。`,
      module: card.module,
      file: card.skillPath,
    });
  }
  return findings;
}

function auditIndexEntries(
  index: AuditIndex,
  cards: MemoryCard[],
): MemoryAuditFinding[] {
  const findings: MemoryAuditFinding[] = [];
  const cardModules = new Set(cards.map((card) => card.module));
  for (const card of cards) {
    const entry = index.cartridges?.[card.module];
    if (!entry) {
      findings.push({
        severity: "warning",
        code: "INDEX_CARD_MISSING",
        message: `${card.module} 存在記憶主檔，但索引沒有對應卡片。`,
        module: card.module,
        file: card.skillPath,
      });
      continue;
    }
    for (const field of REQUIRED_INDEX_ENTRY_FIELDS) {
      if (!(field in entry)) {
        findings.push({
          severity: "warning",
          code: "INDEX_ENTRY_FIELD_MISSING",
          message: `${card.module} 索引缺少 ${field}，可能是舊索引格式。`,
          module: card.module,
          file: ".cartridge/index.json",
        });
      }
    }
    if ((entry.staleness ?? 0) === 0 && (entry.pendingChanges?.length ?? 0) > 0) {
      findings.push({
        severity: "warning",
        code: "INDEX_PENDING_WITH_ZERO_STALENESS",
        message: `${card.module} 索引仍有 pendingChanges，但 staleness 已歸零，可能是記憶提交後索引未同步乾淨。`,
        module: card.module,
        file: ".cartridge/index.json",
      });
    }
  }
  for (const moduleName of Object.keys(index.cartridges ?? {})) {
    if (!cardModules.has(moduleName)) {
      findings.push({
        severity: "warning",
        code: "INDEX_GHOST_CARD",
        message: `${moduleName} 仍在索引中，但沒有找到對應記憶主檔。`,
        module: moduleName,
        file: ".cartridge/index.json",
      });
    }
  }
  return findings;
}

function auditDependencySemantics(cards: MemoryCard[]): MemoryAuditFinding[] {
  return cards.flatMap((card) => {
    const dependencies = Array.isArray(card.frontmatter.dependencies)
      ? card.frontmatter.dependencies.filter(
          (dependency): dependency is string => typeof dependency === "string",
        )
      : [];
    return validateDependencySemantics({
      moduleName: card.module,
      dependencies,
      body: card.body,
      parent:
        typeof card.frontmatter.parent === "string"
          ? card.frontmatter.parent
          : null,
    }).map((warning) => ({
      severity: "warning" as const,
      code: warning.code,
      message: warning.message,
      module: card.module,
      file: card.skillPath,
    }));
  });
}

function auditCompaction(card: MemoryCard): MemoryAuditFinding[] {
  if (card.mainFile.type === "conflict" || card.mainFile.type === "missing") {
    return [];
  }
  const findings: MemoryAuditFinding[] = [];
  const metrics = card.compaction;
  if (metrics.isLegacy) {
    findings.push({
      severity: "warning",
      code: "MEMORY_LEGACY_SCHEMA",
      message: `${card.module} 使用舊記憶格式；可讀取，但下次更新時應懶升級為新版格式。`,
      module: card.module,
      file: card.skillPath,
    });
  }
  if (metrics.reasons.includes("mainCardOversize")) {
    findings.push({
      severity: "warning",
      code: "MEMORY_CARD_OVERSIZE",
      message: `${card.module} 主卡大小 ${metrics.sizeBytes} bytes 超過上限 ${metrics.sizeLimitBytes} bytes。`,
      module: card.module,
      file: card.skillPath,
    });
  }
  if (metrics.reasons.includes("mainCardLineLimit")) {
    findings.push({
      severity: "warning",
      code: "MEMORY_CARD_LINE_LIMIT",
      message: `${card.module} 主卡行數 ${metrics.lineCount} 超過上限 ${metrics.lineLimit}。`,
      module: card.module,
      file: card.skillPath,
    });
  }
  if (metrics.reasons.includes("rootIndexOversize")) {
    findings.push({
      severity: "warning",
      code: "MEMORY_ROOT_INDEX_OVERSIZE",
      message: `${card.module} 根層索引卡大小 ${metrics.sizeBytes} bytes 超過上限 ${metrics.sizeLimitBytes} bytes。`,
      module: card.module,
      file: card.skillPath,
    });
  }
  if (metrics.reasons.includes("cycleEventLimitExceeded")) {
    findings.push({
      severity: "error",
      code: "MEMORY_CYCLE_LIMIT_EXCEEDED",
      message: `${card.module} 週期事件 ${metrics.cycleEventCount}/${metrics.cycleEventLimit} 不合規，必須先彙整。`,
      module: card.module,
      file: card.skillPath,
    });
  } else if (metrics.reasons.includes("cycleEventLimitReached")) {
    findings.push({
      severity: "warning",
      code: "MEMORY_CYCLE_LIMIT_REACHED",
      message: `${card.module} 週期事件 ${metrics.cycleEventCount}/${metrics.cycleEventLimit} 已達彙整門檻。`,
      module: card.module,
      file: card.skillPath,
    });
  }
  for (const archive of metrics.archiveVolumes ?? []) {
    if (!archive.needsCompaction) continue;
    findings.push({
      severity: "warning",
      code: "MEMORY_ARCHIVE_VOLUME_LIMIT",
      message: `${card.module} 的歸檔卷 ${archive.filePath} 已超過 ${archive.sizeLimitBytes} bytes 或 ${archive.lineLimit} 行，請開下一卷。`,
      module: card.module,
      file: archive.filePath,
    });
  }
  for (const legacyArchivePath of metrics.archiveMigrationWarnings ?? []) {
    findings.push({
      severity: "warning",
      code: "MEMORY_ARCHIVE_PATH_MIGRATION",
      message: `${card.module} 使用舊式歸檔路徑 ${legacyArchivePath}；請改為 archive-001.md 平面檔名。`,
      module: card.module,
      file: legacyArchivePath,
    });
  }
  if (metrics.needsCompaction) {
    findings.push({
      severity: "warning",
      code: "MEMORY_COMPACTION_REQUIRED",
      message: `${card.module} 必須先完成彙整或拆卡，才能繼續追加週期事件。`,
      module: card.module,
      file: card.skillPath,
    });
  }
  if (metrics.reasons.includes("highChineseRatio")) {
    findings.push({
      severity: "warning",
      code: "MEMORY_LANGUAGE_RATIO",
      message: `${card.module} 主體中文比例 ${(metrics.chineseRatio * 100).toFixed(1)}%，建議改為英文主體與中文摘要。`,
      module: card.module,
      file: card.skillPath,
    });
  }
  return findings;
}

function buildCycleFindings(cycles: MemoryAuditCycle[]): MemoryAuditFinding[] {
  return cycles.map((cycle) => ({
    severity: "warning" as const,
    code: "DEPENDENCY_CYCLE",
    message: `記憶卡 ${cycle.source} 依賴圖存在循環：${cycle.path.join(" -> ")}`,
  }));
}

function buildPersistedIndexGraph(index: AuditIndex, cards: MemoryCard[]): DependencyGraph {
  const graph: DependencyGraph = new Map();
  const modules = new Set([
    ...cards.map((card) => card.module),
    ...Object.keys(index.cartridges ?? {}),
  ]);
  for (const moduleName of modules) {
    const deps = index.cartridges?.[moduleName]?.dependencies ?? [];
    graph.set(moduleName, deps);
  }
  return graph;
}

function buildFrontmatterGraph(cards: MemoryCard[]): DependencyGraph {
  const graph: DependencyGraph = new Map();
  for (const card of cards) {
    const dependencies = Array.isArray(card.frontmatter.dependencies)
      ? card.frontmatter.dependencies.filter(
          (dependency): dependency is string => typeof dependency === "string",
        )
      : [];
    graph.set(card.module, dependencies);
  }
  return graph;
}

function buildEngineeringIndex(
  index: AuditIndex,
  cards: MemoryCard[],
): CartridgeIndex {
  const cartridges: Record<string, CartridgeEntry> = {};
  const fileMap: Record<string, string[]> = {};

  for (const card of cards) {
    const persisted = index.cartridges?.[card.module];
    const trackedFiles =
      card.trackedFiles.length > 0
        ? card.trackedFiles
        : (persisted?.trackedFiles ?? []);

    cartridges[card.module] = {
      skillPath: card.skillPath,
      mainFile: card.mainFile,
      mainFileType: card.mainFile.type,
      contentQuality: card.contentQuality,
      contentQualityStatus: card.contentQuality.status,
      migrationRequired:
        card.mainFile.migrationRequired || card.contentQuality.migrationRequired,
      legacyCompatibility: card.mainFile.legacyCompatibility,
      description:
        typeof card.frontmatter.description === "string"
          ? card.frontmatter.description
          : (persisted?.skillPath ?? ""),
      trackedFiles,
      staleness: persisted?.staleness ?? 0,
      lastUpdated:
        typeof card.frontmatter.last_updated === "string"
          ? card.frontmatter.last_updated
          : "",
      pendingChanges: [],
      ghostFiles: persisted?.ghostFiles ?? [],
      dependencies: [],
      indirectStaleness: persisted?.indirectStaleness ?? 0,
      depth: 1,
      parent: persisted?.parent ?? null,
      compaction: card.compaction,
    };

    for (const trackedFile of trackedFiles) {
      fileMap[trackedFile] = [...(fileMap[trackedFile] ?? []), card.module];
    }
  }

  return {
    version: 1,
    lastScanned: "",
    cartridges,
    fileMap,
    untrackedFiles: [],
  };
}

function buildEngineeringGraph(
  index: AuditIndex,
  cards: MemoryCard[],
  projectRoot: string,
): DependencyGraph {
  return buildDependencyGraph(buildEngineeringIndex(index, cards), projectRoot);
}

function cycleDetails(source: CycleSource, cycles: string[][]): MemoryAuditCycle[] {
  return cycles.map((cycle) => ({ source, path: cycle }));
}

function buildReport(
  index: AuditIndex,
  cards: MemoryCard[],
  findings: MemoryAuditFinding[],
  cycles: MemoryAuditCycle[],
  persistedIndexCycles: string[][],
): MemoryAuditReport {
  const entries = Object.values(index.cartridges ?? {});
  const dependencySemanticWarnings = findings.filter((finding) =>
    finding.code.startsWith("DEPENDENCY_") && finding.code !== "DEPENDENCY_CYCLE",
  ).length;
  const compatibilityWarnings = findings.filter((finding) =>
    [
      "INDEX_MISSING",
      "INDEX_CARTRIDGES_MISSING",
      "INDEX_FILEMAP_MISSING",
      "INDEX_UNTRACKED_MISSING",
      "INDEX_CARD_MISSING",
      "INDEX_ENTRY_FIELD_MISSING",
      "FRONTMATTER_FIELD_MISSING",
      "FRONTMATTER_METADATA_MISSING",
      "TRACKED_FILES_SECTION_MISSING",
      "TRACKED_FILES_HEADING_TYPO",
      "MEMORY_LEGACY_SCHEMA",
      "MEMORY_MAIN_FILE_LEGACY",
      "MEMORY_MAIN_FILE_CONFLICT",
      "MEMORY_MAIN_FILE_MISSING",
      "MEMORY_QUALITY_FIELD_MISSING",
      "MEMORY_QUALITY_SECTION_MISSING",
      "MEMORY_QUALITY_PENDING_REVIEW",
      "MEMORY_QUALITY_SUPERSEDED",
      "MEMORY_LEGACY_PATH_REFERENCE",
    ].includes(finding.code),
  );
  const activeCards = cards.filter(
    (card) => card.mainFile.type !== "conflict" && card.mainFile.type !== "missing",
  );
  const compactionMetrics = activeCards.map((card) => card.compaction);
  const qualityReports = cards.map((card) => card.contentQuality);
  return {
    compatibility: {
      mode: compatibilityWarnings.length > 0 ? "compatibility" : "modern",
      warningCount: compatibilityWarnings.length,
    },
    summary: {
      cards: cards.length,
      stale: entries.filter((entry) => (entry.staleness ?? 0) > 0).length,
      ghostFiles: entries.reduce(
        (sum, entry) => sum + (entry.ghostFiles?.length ?? 0),
        0,
      ),
      untrackedFiles: index.untrackedFiles?.length ?? 0,
      oversized: compactionMetrics.filter((metrics) => metrics.needsCompaction)
        .length,
      pendingWithZeroStaleness: entries.filter(
        (entry) =>
          (entry.staleness ?? 0) === 0 && (entry.pendingChanges?.length ?? 0) > 0,
      ).length,
      cycles: cycles.length,
      persistedIndexCycles: persistedIndexCycles.length,
      dependencySemanticWarnings,
      legacyCards: compactionMetrics.filter((metrics) => metrics.isLegacy).length,
      compactionDue: compactionMetrics.filter((metrics) => metrics.needsCompaction)
        .length,
      cycleLimitReached: compactionMetrics.filter((metrics) =>
        metrics.reasons.includes("cycleEventLimit"),
      ).length,
      invalidCycleEvents: compactionMetrics.filter((metrics) =>
        metrics.reasons.includes("cycleEventLimitExceeded"),
      ).length,
      oversizedContent: compactionMetrics.filter(
        (metrics) =>
          metrics.reasons.includes("mainCardOversize") ||
          metrics.reasons.includes("mainCardLineLimit") ||
          metrics.reasons.includes("rootIndexOversize"),
      ).length,
      archiveVolumeDue: compactionMetrics.reduce(
        (sum, metrics) =>
          sum +
          (metrics.archiveVolumes?.filter((volume) => volume.needsCompaction)
            .length ?? 0),
        0,
      ),
      archiveMigrationWarnings: compactionMetrics.reduce(
        (sum, metrics) => sum + (metrics.archiveMigrationWarnings?.length ?? 0),
        0,
      ),
      memoryMainFiles: cards.filter(
        (card) => card.mainFile.type === "MEMORY.md",
      ).length,
      legacyMainFiles: cards.filter(
        (card) => card.mainFile.type === "legacy SKILL.md",
      ).length,
      mainFileConflicts: cards.filter(
        (card) => card.mainFile.type === "conflict",
      ).length,
      missingMainFiles: cards.filter(
        (card) => card.mainFile.type === "missing",
      ).length,
      legacyPathReferences: cards.reduce(
        (sum, card) => sum + card.legacyPathReferenceCount,
        0,
      ),
      missingQualityFields: qualityReports.reduce(
        (sum, quality) => sum + quality.missingFields.length,
        0,
      ),
      missingQualitySections: qualityReports.reduce(
        (sum, quality) => sum + quality.missingSections.length,
        0,
      ),
      evidenceWarnings: qualityReports.reduce(
        (sum, quality) => sum + quality.evidenceWarnings.length,
        0,
      ),
      pendingQualityReview: qualityReports.filter(
        (quality) => quality.status === "pending_review",
      ).length,
      supersededQuality: qualityReports.filter(
        (quality) => quality.status === "superseded",
      ).length,
      granularityAdvisories: entries.filter(
        (entry) => (entry.trackedFiles?.length ?? 0) > 8,
      ).length,
      languageWarnings: compactionMetrics.filter((metrics) =>
        metrics.reasons.includes("highChineseRatio"),
      ).length,
    },
    findings,
    cycles: cycles.map((cycle) => cycle.path),
    cycleDetails: cycles,
    persistedIndexCycles,
  };
}

function findingsToEnvelopeFindings(findings: MemoryAuditFinding[]): CartridgeFinding[] {
  return findings.map((finding) => ({
    severity: finding.severity,
    code: finding.code,
    message: finding.message,
    file: finding.file,
  }));
}

function buildRecommendedActions(report: MemoryAuditReport) {
  const actions = [];
  if (report.compatibility.mode === "compatibility") {
    actions.push({
      priority: "P1",
      action: "normalize_legacy_memory_cards",
      target: "workspace",
      reason: `compatibilityWarnings=${report.compatibility.warningCount}`,
    });
  }
  if (report.summary.stale > 0 || report.summary.ghostFiles > 0) {
    actions.push({
      priority: "P1",
      action: "repair_memory_health",
      target: "workspace",
      reason: `stale=${report.summary.stale}, ghostFiles=${report.summary.ghostFiles}`,
    });
  }
  if (report.summary.cycles > 0) {
    actions.push({
      priority: "P1",
      action: "review_dependency_cycles",
      target: "memory_deps",
      reason: `cycles=${report.summary.cycles}`,
    });
  }
  if (report.summary.compactionDue > 0) {
    actions.push({
      priority: "P1",
      action: "compact_memory_cards",
      target: "workspace",
      reason: `compactionDue=${report.summary.compactionDue}`,
    });
  }
  if (report.summary.archiveVolumeDue > 0) {
    actions.push({
      priority: "P1",
      action: "open_next_archive_volume",
      target: "workspace",
      reason: `archiveVolumeDue=${report.summary.archiveVolumeDue}`,
    });
  }
  if (report.summary.legacyCards > 0) {
    actions.push({
      priority: "P2",
      action: "lazy_upgrade_memory_cards",
      target: "workspace",
      reason: `legacyCards=${report.summary.legacyCards}`,
    });
  }
  if (report.summary.archiveMigrationWarnings > 0) {
    actions.push({
      priority: "P2",
      action: "migrate_archive_paths",
      target: "workspace",
      reason: `archiveMigrationWarnings=${report.summary.archiveMigrationWarnings}`,
    });
  }
  if (report.summary.mainFileConflicts > 0) {
    actions.push({
      priority: "P1",
      action: "resolve_memory_main_file_conflicts",
      target: "workspace",
      reason: `mainFileConflicts=${report.summary.mainFileConflicts}`,
    });
  }
  if (report.summary.legacyMainFiles > 0) {
    actions.push({
      priority: "P2",
      action: "migrate_legacy_skill_main_files",
      target: "workspace",
      reason: `legacyMainFiles=${report.summary.legacyMainFiles}`,
    });
  }
  if (
    report.summary.missingQualityFields > 0 ||
    report.summary.missingQualitySections > 0 ||
    report.summary.evidenceWarnings > 0 ||
    report.summary.pendingQualityReview > 0
  ) {
    actions.push({
      priority: "P2",
      action: "review_memory_content_quality",
      target: "workspace",
      reason:
        `missingFields=${report.summary.missingQualityFields}, ` +
        `missingSections=${report.summary.missingQualitySections}, ` +
        `evidenceWarnings=${report.summary.evidenceWarnings}, ` +
        `pendingReview=${report.summary.pendingQualityReview}`,
    });
  }
  if (report.summary.granularityAdvisories > 0) {
    actions.push({
      priority: "P2",
      action: "review_memory_card_split_suggestions",
      target: "workspace",
      reason: `granularityAdvisories=${report.summary.granularityAdvisories}`,
    });
  }
  if (report.summary.languageWarnings > 0) {
    actions.push({
      priority: "P2",
      action: "reduce_memory_card_chinese_body",
      target: "workspace",
      reason: `languageWarnings=${report.summary.languageWarnings}`,
    });
  }
  if (report.summary.dependencySemanticWarnings > 0) {
    actions.push({
      priority: "P2",
      action: "review_dependency_semantics",
      target: "dependencies",
      reason: `warnings=${report.summary.dependencySemanticWarnings}`,
    });
  }
  if (report.summary.pendingWithZeroStaleness > 0) {
    actions.push({
      priority: "P2",
      action: "resync_memory_index",
      target: "memory_commit",
      reason: `pendingWithZeroStaleness=${report.summary.pendingWithZeroStaleness}`,
    });
  }
  return actions;
}

export async function buildMemoryAuditReport(
  projectRoot: string,
): Promise<MemoryAuditReport> {
  const [{ index, findings: indexFindings }, cards] = await Promise.all([
    readIndex(projectRoot),
    readMemoryCards(projectRoot),
  ]);
  const frontmatterCycles = detectCycles(buildFrontmatterGraph(cards));
  const engineeringCycles = detectCycles(
    buildEngineeringGraph(index, cards, projectRoot),
  );
  const persistedIndexCycles = detectCycles(buildPersistedIndexGraph(index, cards));
  const cycles = [
    ...cycleDetails("frontmatter", frontmatterCycles),
    ...cycleDetails("engineering", engineeringCycles),
  ];
  const findings = [
    ...indexFindings,
    ...cards.flatMap(auditMemoryMainFileAndQuality),
    ...cards.flatMap(auditFrontmatter),
    ...cards.flatMap(auditTrackedFiles),
    ...cards.flatMap(auditCompaction),
    ...auditIndexEntries(index, cards),
    ...auditDependencySemantics(cards),
    ...buildCycleFindings(cycles),
  ];
  return buildReport(index, cards, findings, cycles, persistedIndexCycles);
}

export async function handleMemoryAudit(args: unknown): Promise<McpToolResult> {
  const parsed = memoryAuditSchema.safeParse(args);
  if (!parsed.success) {
    return toMcpTextResult(
      createToolErrorEnvelope({
        tool: TOOL_NAME,
        projectRoot: "",
        code: "validation_error",
        message:
          "Validation Error: projectRoot is required (must be absolute path without ..)",
      }),
    );
  }

  try {
    const projectRoot = validateProjectRoot(parsed.data.projectRoot);
    const report = await buildMemoryAuditReport(projectRoot);
    const status: CartridgeToolStatus =
      report.findings.length > 0 ? "warning" : "ready";
    return toMcpTextResult(
      createToolEnvelope({
        tool: TOOL_NAME,
        readOnly: true,
        projectRoot,
        status,
        summary: report as unknown as Record<string, unknown>,
        findings: findingsToEnvelopeFindings(report.findings),
        recommendedActions: buildRecommendedActions(report),
        legacy: {
          compatibilityMode: report.compatibility.mode,
          findings: report.findings,
          cycles: report.cycles,
          cycleDetails: report.cycleDetails,
          persistedIndexCycles: report.persistedIndexCycles,
        },
      }),
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return toMcpTextResult(
      createToolErrorEnvelope({
        tool: TOOL_NAME,
        projectRoot: parsed.data.projectRoot,
        code: "memory_audit_failed",
        message: `Error: ${msg}`,
      }),
    );
  }
}
