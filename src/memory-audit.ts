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
import { parseTrackedFiles, shouldWarnEmptyTrackedFiles } from "./index-manager.js";
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

function moduleNameFromSkillPath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.startsWith(".agents/memory/")) {
    return normalized
      .slice(".agents/memory/".length)
      .replace(/\/SKILL\.md$/, "")
      .replace(/\//g, ".");
  }
  return normalized
    .replace(/^\.agents\/skills\//, "")
    .replace(/^mem-/, "")
    .replace(/\/SKILL\.md$/, "")
    .replace(/\//g, ".");
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function collectSkillFiles(root: string): Promise<string[]> {
  if (!(await pathExists(root))) return [];
  const results: string[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 5) return;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath, depth + 1);
      } else if (entry.isFile() && entry.name === "SKILL.md") {
        results.push(fullPath);
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
  const memoryFiles = await collectSkillFiles(path.join(projectRoot, ".agents", "memory"));
  const legacySkillFiles = (await collectSkillFiles(
    path.join(projectRoot, ".agents", "skills"),
  )).filter((filePath) => path.basename(path.dirname(filePath)).startsWith("mem-"));
  const files = [...memoryFiles, ...legacySkillFiles];

  const cards: MemoryCard[] = [];
  for (const absolutePath of files) {
    const raw = await fs.readFile(absolutePath, "utf-8");
    const parsed = matter(raw);
    const skillPath = normalizeRelative(projectRoot, absolutePath);
    cards.push({
      module: moduleNameFromSkillPath(skillPath),
      skillPath,
      absolutePath,
      raw,
      body: parsed.content,
      frontmatter: parsed.data as Record<string, unknown>,
      trackedFiles: parseTrackedFiles(raw),
    });
  }
  return cards;
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
        message: `${card.module} 存在 SKILL.md，但索引沒有對應卡片。`,
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
        message: `${moduleName} 仍在索引中，但沒有找到對應 SKILL.md。`,
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
    ].includes(finding.code),
  );
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
      oversized: entries.filter((entry) => (entry.trackedFiles?.length ?? 0) > 8)
        .length,
      pendingWithZeroStaleness: entries.filter(
        (entry) =>
          (entry.staleness ?? 0) === 0 && (entry.pendingChanges?.length ?? 0) > 0,
      ).length,
      cycles: cycles.length,
      persistedIndexCycles: persistedIndexCycles.length,
      dependencySemanticWarnings,
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
    ...cards.flatMap(auditFrontmatter),
    ...cards.flatMap(auditTrackedFiles),
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
