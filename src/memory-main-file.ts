import fs from "node:fs";
import * as fsp from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

export const MEMORY_MAIN_FILENAME = "MEMORY.md";
export const LEGACY_MEMORY_MAIN_FILENAME = "SKILL.md";

export type MemoryMainFileType =
  | "MEMORY.md"
  | "legacy SKILL.md"
  | "conflict"
  | "missing";

export type MemoryContentQualityStatus =
  | "complete"
  | "missing_fields"
  | "missing_sections"
  | "pending_review"
  | "conflict"
  | "superseded";

export type MemoryEvidenceBaseStatus =
  | "present"
  | "missing"
  | "empty"
  | "placeholder"
  | "not_applicable";

export interface MemoryMainFileInfo {
  type: MemoryMainFileType;
  activePath: string | null;
  activeFileName: string | null;
  candidates: {
    memory?: string;
    legacySkill?: string;
  };
  candidatePaths: string[];
  legacyCompatibility: boolean;
  migrationRequired: boolean;
  conflict: boolean;
}

export interface MemoryQualityReport {
  status: MemoryContentQualityStatus;
  label: string;
  requiredFields: string[];
  requiredSections: string[];
  missingFields: string[];
  missingSections: string[];
  verificationStatus: string | null;
  lastVerified: string | null;
  validScope: unknown;
  evidenceBaseStatus: MemoryEvidenceBaseStatus;
  evidenceWarnings: string[];
  legacyCompatibility: boolean;
  migrationRequired: boolean;
}

export interface MemoryMainFileResolution {
  directory: string;
  relativeDirectory: string;
  mainFile: MemoryMainFileInfo;
}

export const REQUIRED_MEMORY_QUALITY_FIELDS = [
  "memory_schema_version",
  "memory_quality_version",
  "memory_kind",
  "verification_status",
  "last_verified",
  "valid_scope",
];

export const REQUIRED_MEMORY_QUALITY_SECTIONS = [
  "Current Truth",
  "Active Constraints",
  "Cycle Events",
  "Archive Index",
  "Evidence Base",
  "Read Contract",
  "Conflicts and Supersession",
  "中文摘要",
  "Tracked Files",
];

const STATUS_LABELS: Record<MemoryContentQualityStatus, string> = {
  complete: "完整",
  missing_fields: "缺欄位",
  missing_sections: "缺段落",
  pending_review: "待審",
  conflict: "衝突",
  superseded: "已取代",
};

export function normalizeMemoryPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function normalizeRel(projectRoot: string, absolutePath: string): string {
  return normalizeMemoryPath(path.relative(projectRoot, absolutePath));
}

function buildMainFileInfo(args: {
  type: MemoryMainFileType;
  activePath: string | null;
  memoryPath?: string;
  legacySkillPath?: string;
}): MemoryMainFileInfo {
  const candidatePaths = [
    args.memoryPath,
    args.legacySkillPath,
  ].filter((item): item is string => Boolean(item));
  return {
    type: args.type,
    activePath: args.activePath,
    activeFileName: args.activePath ? path.basename(args.activePath) : null,
    candidates: {
      memory: args.memoryPath,
      legacySkill: args.legacySkillPath,
    },
    candidatePaths,
    legacyCompatibility: args.type === "legacy SKILL.md",
    migrationRequired: args.type !== "MEMORY.md",
    conflict: args.type === "conflict",
  };
}

export function isArchiveVolumeName(fileName: string): boolean {
  return /^archive-\d{3}\.md$/i.test(fileName);
}

export function isMemoryMainFileName(fileName: string): boolean {
  return fileName === MEMORY_MAIN_FILENAME || fileName === LEGACY_MEMORY_MAIN_FILENAME;
}

export function isLegacyArchivePath(filePath: string): boolean {
  const normalized = normalizeMemoryPath(filePath).toLowerCase();
  return normalized.includes("/archive/") || normalized.endsWith("/archive");
}

export function isActiveMemoryMainFilePath(filePath: string): boolean {
  const normalized = normalizeMemoryPath(filePath);
  const fileName = path.posix.basename(normalized);
  if (!isMemoryMainFileName(fileName)) return false;
  if (isLegacyArchivePath(normalized)) return false;
  if (isArchiveVolumeName(fileName)) return false;
  return (
    normalized.includes(".agents/memory/") ||
    normalized.includes(".agents/skills/mem-")
  );
}

export function isMemoryArchiveArtifactPath(filePath: string): boolean {
  const normalized = normalizeMemoryPath(filePath);
  const fileName = path.posix.basename(normalized);
  return isArchiveVolumeName(fileName) || isLegacyArchivePath(normalized);
}

export function resolveMemoryMainFileInDirectorySync(
  projectRoot: string,
  cardDir: string,
): MemoryMainFileResolution {
  const memoryAbs = path.join(cardDir, MEMORY_MAIN_FILENAME);
  const legacyAbs = path.join(cardDir, LEGACY_MEMORY_MAIN_FILENAME);
  const listedNames = readDirectoryFileNamesSync(cardDir);
  const [memoryExists, legacyExists] =
    listedNames === null
      ? [fs.existsSync(memoryAbs), fs.existsSync(legacyAbs)]
      : [
          listedNames.has(MEMORY_MAIN_FILENAME),
          listedNames.has(LEGACY_MEMORY_MAIN_FILENAME),
        ];
  const memoryRel = memoryExists ? normalizeRel(projectRoot, memoryAbs) : undefined;
  const legacyRel = legacyExists ? normalizeRel(projectRoot, legacyAbs) : undefined;
  let mainFile: MemoryMainFileInfo;

  if (memoryExists && legacyExists) {
    mainFile = buildMainFileInfo({
      type: "conflict",
      activePath: null,
      memoryPath: memoryRel,
      legacySkillPath: legacyRel,
    });
  } else if (memoryExists) {
    mainFile = buildMainFileInfo({
      type: "MEMORY.md",
      activePath: memoryRel ?? null,
      memoryPath: memoryRel,
    });
  } else if (legacyExists) {
    mainFile = buildMainFileInfo({
      type: "legacy SKILL.md",
      activePath: legacyRel ?? null,
      legacySkillPath: legacyRel,
    });
  } else {
    mainFile = buildMainFileInfo({
      type: "missing",
      activePath: null,
    });
  }

  return {
    directory: cardDir,
    relativeDirectory: normalizeRel(projectRoot, cardDir),
    mainFile,
  };
}

export async function resolveMemoryMainFileInDirectory(
  projectRoot: string,
  cardDir: string,
): Promise<MemoryMainFileResolution> {
  const memoryAbs = path.join(cardDir, MEMORY_MAIN_FILENAME);
  const legacyAbs = path.join(cardDir, LEGACY_MEMORY_MAIN_FILENAME);
  const listedNames = await readDirectoryFileNames(cardDir);
  const [memoryExists, legacyExists] =
    listedNames === null
      ? await Promise.all([pathExists(memoryAbs), pathExists(legacyAbs)])
      : [
          listedNames.has(MEMORY_MAIN_FILENAME),
          listedNames.has(LEGACY_MEMORY_MAIN_FILENAME),
        ];
  const memoryRel = memoryExists ? normalizeRel(projectRoot, memoryAbs) : undefined;
  const legacyRel = legacyExists ? normalizeRel(projectRoot, legacyAbs) : undefined;

  if (memoryExists && legacyExists) {
    return {
      directory: cardDir,
      relativeDirectory: normalizeRel(projectRoot, cardDir),
      mainFile: buildMainFileInfo({
        type: "conflict",
        activePath: null,
        memoryPath: memoryRel,
        legacySkillPath: legacyRel,
      }),
    };
  }
  if (memoryExists) {
    return {
      directory: cardDir,
      relativeDirectory: normalizeRel(projectRoot, cardDir),
      mainFile: buildMainFileInfo({
        type: "MEMORY.md",
        activePath: memoryRel ?? null,
        memoryPath: memoryRel,
      }),
    };
  }
  if (legacyExists) {
    return {
      directory: cardDir,
      relativeDirectory: normalizeRel(projectRoot, cardDir),
      mainFile: buildMainFileInfo({
        type: "legacy SKILL.md",
        activePath: legacyRel ?? null,
        legacySkillPath: legacyRel,
      }),
    };
  }
  return {
    directory: cardDir,
    relativeDirectory: normalizeRel(projectRoot, cardDir),
    mainFile: buildMainFileInfo({ type: "missing", activePath: null }),
  };
}

function readDirectoryFileNamesSync(cardDir: string): Set<string> | null {
  try {
    const entries = fs.readdirSync(cardDir, { withFileTypes: true });
    if (!Array.isArray(entries)) return null;
    return new Set(
      entries
        .filter(
          (entry) =>
            typeof entry.isFile === "function" && entry.isFile(),
        )
        .map((entry) => entry.name),
    );
  } catch {
    return null;
  }
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fsp.access(target);
    return true;
  } catch {
    return false;
  }
}

async function readDirectoryFileNames(cardDir: string): Promise<Set<string> | null> {
  try {
    const entries = await fsp.readdir(cardDir, { withFileTypes: true });
    if (!Array.isArray(entries)) return null;
    return new Set(
      entries
        .filter(
          (entry) =>
            typeof entry.isFile === "function" && entry.isFile(),
        )
        .map((entry) => entry.name),
    );
  } catch {
    return null;
  }
}

export function hasChildMemoryCardDirectorySync(
  projectRoot: string,
  cardDir: string,
): boolean {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(cardDir, { withFileTypes: true });
  } catch {
    return false;
  }
  return entries.some((entry) => {
    if (!entry.isDirectory()) return false;
    if (entry.name.startsWith(".") || entry.name.toLowerCase() === "archive") {
      return false;
    }
    const childDir = path.join(cardDir, entry.name);
    const resolution = resolveMemoryMainFileInDirectorySync(projectRoot, childDir);
    return resolution.mainFile.type !== "missing";
  });
}

export async function hasChildMemoryCardDirectory(
  projectRoot: string,
  cardDir: string,
): Promise<boolean> {
  let entries: Array<{
    name: string;
    isDirectory: () => boolean;
  }>;
  try {
    entries = await fsp.readdir(cardDir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".") || entry.name.toLowerCase() === "archive") {
      continue;
    }
    const childDir = path.join(cardDir, entry.name);
    const resolution = await resolveMemoryMainFileInDirectory(projectRoot, childDir);
    if (resolution.mainFile.type !== "missing") return true;
  }
  return false;
}

function hasRequiredField(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function hasSection(body: string, section: string): boolean {
  const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^## ${escaped}[ \\t]*$`, "m").test(
    body.replace(/\r\n/g, "\n"),
  );
}

function getSectionBody(body: string, section: string): string | null {
  const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const normalized = body.replace(/\r\n/g, "\n");
  const headingMatch = new RegExp(`^## ${escaped}[ \\t]*$`, "m").exec(
    normalized,
  );
  if (!headingMatch) return null;
  const sectionStart = headingMatch.index + headingMatch[0].length;
  const rest = normalized.slice(sectionStart).replace(/^\n/, "");
  const nextHeadingIndex = rest.search(/^## /m);
  return nextHeadingIndex === -1
    ? rest.trimEnd()
    : rest.slice(0, nextHeadingIndex).trimEnd();
}

function normalizeEvidenceLine(line: string): string {
  return line
    .replace(/^[-*]\s*/, "")
    .replace(/`/g, "")
    .trim()
    .replace(/[。.]$/, "")
    .trim()
    .toLowerCase();
}

function analyzeEvidenceBase(body: string): {
  status: MemoryEvidenceBaseStatus;
  warnings: string[];
} {
  const section = getSectionBody(body, "Evidence Base");
  if (section === null) {
    return {
      status: "missing",
      warnings: ["Evidence Base section is missing."],
    };
  }
  const evidenceLines = section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("<!--"));
  if (evidenceLines.length === 0) {
    return {
      status: "empty",
      warnings: ["Evidence Base section is empty."],
    };
  }

  const placeholders = new Set([
    "none",
    "no evidence",
    "n/a",
    "na",
    "tbd",
    "todo",
    "pending",
    "pending evidence",
    "not verified",
    "unverified",
    "無",
    "沒有",
    "無證據",
    "待補",
    "待確認",
    "待驗證",
    "未驗證",
  ]);
  const meaningfulLines = evidenceLines.filter((line) => {
    const normalized = normalizeEvidenceLine(line);
    return normalized.length > 0 && !placeholders.has(normalized);
  });
  if (meaningfulLines.length === 0) {
    return {
      status: "placeholder",
      warnings: ["Evidence Base section has no actionable evidence entries."],
    };
  }
  return { status: "present", warnings: [] };
}

function normalizeVerificationStatus(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function statusFromVerification(value: string | null): MemoryContentQualityStatus {
  if (!value) return "pending_review";
  const normalized = value.toLowerCase();
  if (/(conflict|衝突)/.test(normalized)) return "conflict";
  if (/(superseded|replaced|deprecated|已取代|取代)/.test(normalized)) {
    return "superseded";
  }
  if (normalized === "verified" || normalized === "已驗證") return "complete";
  return "pending_review";
}

export function analyzeMemoryContentQuality(
  rawContent: string | null,
  mainFile: MemoryMainFileInfo,
): MemoryQualityReport {
  if (mainFile.type === "conflict") {
    return createQualityReport({
      status: "conflict",
      missingFields: [],
      missingSections: [],
      verificationStatus: null,
      lastVerified: null,
      validScope: null,
      evidenceBaseStatus: "not_applicable",
      evidenceWarnings: [],
      legacyCompatibility: false,
      migrationRequired: true,
    });
  }
  if (mainFile.type === "missing" || rawContent === null) {
    return createQualityReport({
      status: "pending_review",
      missingFields: [...REQUIRED_MEMORY_QUALITY_FIELDS],
      missingSections: [...REQUIRED_MEMORY_QUALITY_SECTIONS],
      verificationStatus: null,
      lastVerified: null,
      validScope: null,
      evidenceBaseStatus: "missing",
      evidenceWarnings: ["Evidence Base cannot be verified without an active main file."],
      legacyCompatibility: false,
      migrationRequired: true,
    });
  }

  let frontmatter: Record<string, unknown>;
  let body: string;
  try {
    const parsed = matter(rawContent);
    frontmatter = parsed.data as Record<string, unknown>;
    body = parsed.content;
  } catch {
    return createQualityReport({
      status: "pending_review",
      missingFields: [...REQUIRED_MEMORY_QUALITY_FIELDS],
      missingSections: [...REQUIRED_MEMORY_QUALITY_SECTIONS],
      verificationStatus: null,
      lastVerified: null,
      validScope: null,
      evidenceBaseStatus: "missing",
      evidenceWarnings: ["Evidence Base cannot be verified because the card cannot be parsed."],
      legacyCompatibility: mainFile.legacyCompatibility,
      migrationRequired: true,
    });
  }

  const evidenceBase = analyzeEvidenceBase(body);
  const missingFields = REQUIRED_MEMORY_QUALITY_FIELDS.filter(
    (field) => !hasRequiredField(frontmatter[field]),
  );
  const missingSections = REQUIRED_MEMORY_QUALITY_SECTIONS.filter(
    (section) => !hasSection(body, section),
  );
  const verificationStatus = normalizeVerificationStatus(
    frontmatter.verification_status,
  );
  const verificationDrivenStatus = statusFromVerification(verificationStatus);
  const status: MemoryContentQualityStatus =
    verificationDrivenStatus === "conflict" || verificationDrivenStatus === "superseded"
      ? verificationDrivenStatus
      : missingFields.length > 0
        ? "missing_fields"
        : missingSections.length > 0
          ? "missing_sections"
          : evidenceBase.status !== "present"
            ? "pending_review"
          : verificationDrivenStatus === "complete"
            ? "complete"
            : "pending_review";

  return createQualityReport({
    status,
    missingFields,
    missingSections,
    verificationStatus,
    lastVerified:
      typeof frontmatter.last_verified === "string"
        ? frontmatter.last_verified
        : null,
    validScope: frontmatter.valid_scope ?? null,
    evidenceBaseStatus: evidenceBase.status,
    evidenceWarnings: evidenceBase.warnings,
    legacyCompatibility: mainFile.legacyCompatibility,
    migrationRequired:
      mainFile.migrationRequired ||
      status !== "complete" ||
      mainFile.legacyCompatibility,
  });
}

function createQualityReport(args: {
  status: MemoryContentQualityStatus;
  missingFields: string[];
  missingSections: string[];
  verificationStatus: string | null;
  lastVerified: string | null;
  validScope: unknown;
  evidenceBaseStatus: MemoryEvidenceBaseStatus;
  evidenceWarnings: string[];
  legacyCompatibility: boolean;
  migrationRequired: boolean;
}): MemoryQualityReport {
  return {
    status: args.status,
    label: STATUS_LABELS[args.status],
    requiredFields: [...REQUIRED_MEMORY_QUALITY_FIELDS],
    requiredSections: [...REQUIRED_MEMORY_QUALITY_SECTIONS],
    missingFields: args.missingFields,
    missingSections: args.missingSections,
    verificationStatus: args.verificationStatus,
    lastVerified: args.lastVerified,
    validScope: args.validScope,
    evidenceBaseStatus: args.evidenceBaseStatus,
    evidenceWarnings: args.evidenceWarnings,
    legacyCompatibility: args.legacyCompatibility,
    migrationRequired: args.migrationRequired,
  };
}

export function moduleNameFromMemoryMainPath(relativePath: string): string {
  const normalized = normalizeMemoryPath(relativePath);
  if (normalized.startsWith(".agents/memory/")) {
    return normalized
      .slice(".agents/memory/".length)
      .replace(/\/(?:MEMORY|SKILL)\.md$/i, "")
      .replace(/\//g, ".");
  }
  return normalized
    .replace(/^\.agents\/skills\//, "")
    .replace(/^mem-/, "")
    .replace(/\/(?:MEMORY|SKILL)\.md$/i, "")
    .replace(/\//g, ".");
}

export function countLegacyMainFileReferences(content: string): number {
  const matches = content.match(/\.agents\/memory\/[^)\]\s]+\/SKILL\.md/gi);
  return matches?.length ?? 0;
}
