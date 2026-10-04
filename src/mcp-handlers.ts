/**
 * 記憶卡匣外掛系統 — MCP 工具商業邏輯層
 * 將各工具的純商業邏輯從 MCP SDK 解耦，便於單元測試
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as z from "zod";
import matter from "./safe-frontmatter.js";
import { patchMemorySource, readMemorySource } from "./memory-source-patch.js";
import { assertPathInsideProject, tryProjectPath } from "./file-containment.js";
import {
  formatDependencySemanticWarning,
  validateDependencySemantics,
} from "./dependency-semantics.js";
import { validateProjectRoot } from "./path-guard.js";
import { stalenessToLevel } from "./staleness.js";
import { getTaiwanISO } from "./timestamp.js";
import {
  CartridgeIndexManager,
  parseTrackedFiles,
} from "./index-manager.js";
import {
  createVisibleCartridgeIndex,
  filterVisibleUntrackedFiles,
} from "./visible-index.js";
import {
  buildCompactionMetrics,
  formatCompactionWarnings,
} from "./memory-compaction.js";
import {
  analyzeMemoryContentQuality,
  hasChildMemoryCardDirectory,
  resolveMemoryMainFileInDirectory,
  type MemoryMainFileInfo,
  type MemoryQualityReport,
} from "./memory-main-file.js";
import { refreshMemoryIndex } from "./memory-reindex.js";
import { createConfig } from "./config.js";
import { normalizeDeclaredDependencies, recomputeDependencyState } from "./dependency-propagator.js";
import { runProjectIndexTransaction } from "./project-index-transaction.js";
import type { CartridgeEntry, CartridgeIndex } from "./types.js";
import {
  createToolEnvelope,
  createToolErrorEnvelope,
  toMcpTextResult,
  type CartridgeFinding,
  type CartridgeToolStatus,
  type McpToolResult,
} from "./mcp-response.js";

/** 警報區塊的標記邊界（與 writer.ts 保持一致） */
const WARNING_START = "<!-- CARTRIDGE_SYSTEM_WARNING_START -->";
const WARNING_END = "<!-- CARTRIDGE_SYSTEM_WARNING_END -->";

/**
 * 移除內文中的警報區塊（MCP 端獨立實作，因為 MCP 與外掛是不同進程）
 */
function stripWarningBlock(content: string): string {
  const startIdx = content.indexOf(WARNING_START);
  const endIdx = content.indexOf(WARNING_END);
  if (startIdx === -1 || endIdx === -1) return content;
  const before = content.substring(0, startIdx);
  const after = content.substring(endIdx + WARNING_END.length);
  return (before + after).replace(/^\n+/, "\n");
}

/** projectRoot 共用驗證規則 */
const projectRootField = z
  .string()
  .min(1)
  .refine((p) => path.isAbsolute(p) && !p.includes(".."), {
    message: "必須為絕對路徑且不含路徑穿越符號",
  });

/** moduleName 共用驗證規則：只允許記憶卡 ID，不允許路徑片段 */
const moduleNameSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/, {
    message: "moduleName 只能包含英數、底線、連字號與點號分隔，不得包含路徑片段",
  });

/** memory_list 工具參數驗證 Schema */
export const memoryListSchema = z.object({
  projectRoot: projectRootField,
});

/** memory_read 工具參數驗證 Schema */
export const memoryReadSchema = z.object({
  moduleName: moduleNameSchema,
  projectRoot: projectRootField,
});

/** memory_status 工具參數驗證 Schema */
export const memoryStatusSchema = z.object({
  moduleName: moduleNameSchema,
  projectRoot: projectRootField,
});

/** memory_commit 工具參數驗證 Schema */
export const memoryCommitSchema = z.object({
  moduleName: moduleNameSchema,
  projectRoot: projectRootField,
  confirm: z.literal(true),
});

/** memory_reindex 工具參數驗證 Schema */
export const memoryReindexSchema = z.object({
  projectRoot: projectRootField,
  confirm: z.literal(true),
});

function createHandlerErrorResult(args: {
  tool: string;
  readOnly: boolean;
  projectRoot?: string;
  code: string;
  message: string;
}): McpToolResult {
  return toMcpTextResult(
    createToolEnvelope({
      tool: args.tool,
      readOnly: args.readOnly,
      projectRoot: args.projectRoot ?? "",
      status: "error",
      summary: { error: args.message },
      findings: [
        {
          severity: "error",
          code: args.code,
          message: args.message,
        },
      ],
      legacy: { text: args.message },
    }),
  );
}

function createMemoryMainConflictResult(args: {
  tool: string;
  readOnly: boolean;
  projectRoot: string;
  moduleName: string;
  candidates: string[];
}): McpToolResult {
  const message =
    `Module "${args.moduleName}" has both MEMORY.md and SKILL.md. ` +
    "Resolve the conflict before reading or writing this memory card.";
  return toMcpTextResult(
    createToolEnvelope({
      tool: args.tool,
      readOnly: args.readOnly,
      projectRoot: args.projectRoot,
      status: "error",
      summary: {
        module: args.moduleName,
        error: message,
        mainFileType: "conflict",
        candidates: args.candidates,
        migrationRequired: true,
      },
      findings: [
        {
          severity: "error",
          code: "memory_main_file_conflict",
          message,
        },
      ],
      legacy: {
        text: `${message} Candidates: ${args.candidates.join(", ")}`,
        candidates: args.candidates,
      },
    }),
  );
}

/**
 * 使用 gray-matter 結構化更新 frontmatter 欄位
 * 取代易碎的正則替換，完整支援單引號、雙引號、無引號格式
 */
export function updateFrontmatterFields(
  rawContent: string,
  updates: Record<string, unknown>,
): string {
  return patchMemorySource(rawContent, updates);
}

type MemoryMainFileLookup =
  | {
      status: "ready";
      filePath: string;
      relativePath: string;
      mainFile: MemoryMainFileInfo;
      contentQuality: MemoryQualityReport;
      entry?: CartridgeEntry;
    }
  | {
      status: "conflict" | "missing" | "not_found";
      mainFile?: MemoryMainFileInfo;
      candidates: string[];
      message: string;
      entry?: CartridgeEntry;
    };

function mainFileInfoFromEntry(entry: CartridgeEntry): MemoryMainFileInfo | null {
  if (entry.mainFile) return entry.mainFile;
  if (!entry.skillPath) return null;
  const normalized = entry.skillPath.replace(/\\/g, "/");
  const isMemory = normalized.endsWith("/MEMORY.md") || normalized === "MEMORY.md";
  return {
    type: isMemory ? "MEMORY.md" : "legacy SKILL.md",
    activePath: normalized,
    activeFileName: path.basename(normalized),
    candidates: isMemory ? { memory: normalized } : { legacySkill: normalized },
    candidatePaths: [normalized],
    legacyCompatibility: !isMemory,
    migrationRequired: !isMemory,
    conflict: false,
  };
}

function resolvePathInsideRoot(projectRoot: string, relativePath: string): string | null {
  return tryProjectPath(projectRoot, relativePath);
}

function directoryCandidatesFromEntry(
  projectRoot: string,
  entry: CartridgeEntry,
): string[] {
  const mainFile = mainFileInfoFromEntry(entry);
  const paths = [
    mainFile?.activePath,
    ...(mainFile?.candidatePaths ?? []),
    entry.skillPath,
  ].filter((item): item is string => Boolean(item));
  const directories = new Set<string>();
  for (const candidatePath of paths) {
    const normalized = candidatePath.replace(/\\/g, "/");
    const fileName = path.posix.basename(normalized);
    const directoryPath = /\.md$/i.test(fileName)
      ? path.posix.dirname(normalized)
      : normalized;
    const absoluteDirectory = resolvePathInsideRoot(projectRoot, directoryPath);
    if (absoluteDirectory) directories.add(absoluteDirectory);
  }
  return [...directories];
}

async function lookupFromIndexEntryDirectories(
  projectRoot: string,
  entry: CartridgeEntry,
): Promise<MemoryMainFileLookup | null> {
  for (const directory of directoryCandidatesFromEntry(projectRoot, entry)) {
    const lookup = await lookupFromDirectory(projectRoot, directory);
    if (lookup) return lookup;
  }
  return null;
}

function staleIndexAsMissingLookup(
  mainFile: MemoryMainFileInfo,
  entry: CartridgeEntry,
): MemoryMainFileLookup {
  return {
    status: "missing",
    mainFile: {
      ...mainFile,
      type: "missing",
      activePath: null,
      activeFileName: null,
      candidates: {},
      legacyCompatibility: false,
      migrationRequired: true,
      conflict: false,
    },
    candidates: mainFile.candidatePaths,
    message: "Memory main file is missing.",
    entry,
  };
}

async function lookupFromDirectory(
  projectRoot: string,
  cardDir: string,
): Promise<MemoryMainFileLookup | null> {
  if (!tryProjectPath(projectRoot, cardDir)) return null;
  const resolution = await resolveMemoryMainFileInDirectory(projectRoot, cardDir);
  const mainFile = resolution.mainFile;
  if (mainFile.type === "missing") return null;
  if (mainFile.type === "conflict") {
    return {
      status: "conflict",
      mainFile,
      candidates: mainFile.candidatePaths,
      message: "Memory main file conflict: MEMORY.md and SKILL.md both exist.",
    };
  }
  if (!mainFile.activePath) {
    return {
      status: "missing",
      mainFile,
      candidates: mainFile.candidatePaths,
      message: "Memory main file is missing.",
    };
  }
  const filePath = tryProjectPath(projectRoot, mainFile.activePath);
  if (!filePath) return null;
  try {
    const raw = await fs.readFile(assertPathInsideProject(projectRoot, filePath), "utf-8");
    return {
      status: "ready",
      filePath,
      relativePath: mainFile.activePath,
      mainFile,
      contentQuality: analyzeMemoryContentQuality(raw, mainFile),
    };
  } catch {
    return {
      status: "missing",
      mainFile,
      candidates: mainFile.candidatePaths,
      message: `Memory main file does not exist: ${mainFile.activePath}`,
    };
  }
}

export async function resolveMemoryMainFileForModule(
  projectRoot: string,
  moduleName: string,
): Promise<MemoryMainFileLookup> {
  const normalizedRoot = path.resolve(projectRoot);
  const indexPath = path.join(projectRoot, ".cartridge", "index.json");
  let staleIndexedMissing: MemoryMainFileLookup | null = null;
  try {
    const raw = await fs.readFile(assertPathInsideProject(projectRoot, indexPath), "utf-8");
    const index = JSON.parse(raw) as CartridgeIndex;
    const entry = index.cartridges?.[moduleName];
    if (entry) {
      const mainFile = mainFileInfoFromEntry(entry);
      const indexedDirectoryLookup = await lookupFromIndexEntryDirectories(
        normalizedRoot,
        entry,
      );
      if (indexedDirectoryLookup) {
        return { ...indexedDirectoryLookup, entry };
      }
      if (mainFile?.type === "conflict" || mainFile?.type === "missing") {
        staleIndexedMissing = staleIndexAsMissingLookup(mainFile, entry);
      }
      const safeActivePath = mainFile?.activePath
        ? resolvePathInsideRoot(normalizedRoot, mainFile.activePath)
        : null;
      if (mainFile?.activePath && safeActivePath) {
        const directoryLookup = await lookupFromDirectory(
          normalizedRoot,
          path.dirname(safeActivePath),
        );
        if (directoryLookup) {
          return { ...directoryLookup, entry };
        }
        const resolved = safeActivePath;
        try {
          const rawContent = await fs.readFile(assertPathInsideProject(normalizedRoot, resolved), "utf-8");
          return {
            status: "ready",
            filePath: resolved,
            relativePath: mainFile.activePath,
            mainFile,
            contentQuality: analyzeMemoryContentQuality(rawContent, mainFile),
            entry,
          };
        } catch {
          /* 索引記錄的路徑不存在，繼續嘗試 */
        }
      }
    }
  } catch {
    /* 索引不存在 */
  }

  const directDirs = [
    path.join(normalizedRoot, ".agents", "memory", moduleName),
    path.join(normalizedRoot, ".agents", "memory", ...moduleName.split(".")),
    path.join(normalizedRoot, ".agents", "skills", moduleName),
    path.join(normalizedRoot, ".agents", "skills", ...moduleName.split(".")),
  ];
  for (const dir of directDirs) {
    const lookup = await lookupFromDirectory(normalizedRoot, dir);
    if (lookup) return lookup;
  }

  const fromMemory = await findMemoryMainRecursive(
    normalizedRoot,
    path.join(normalizedRoot, ".agents", "memory"),
    moduleName,
    1,
    null,
    false,
  );
  if (fromMemory) return fromMemory;

  const fromSkills = await findMemoryMainRecursive(
    normalizedRoot,
    path.join(normalizedRoot, ".agents", "skills"),
    moduleName,
    1,
    null,
    true,
  );
  if (fromSkills) return fromSkills;

  if (staleIndexedMissing) {
    return staleIndexedMissing;
  }

  return {
    status: "not_found",
    candidates: [],
    message: `Module "${moduleName}" not found.`,
  };
}

/**
 * 相容包裝：回傳目前實際作用中主檔絕對路徑。
 * 新流程應改用 resolveMemoryMainFileForModule 取得衝突與品質資訊。
 */
export async function resolveSkillPath(
  projectRoot: string,
  moduleName: string,
): Promise<string | null> {
  const lookup = await resolveMemoryMainFileForModule(projectRoot, moduleName);
  return lookup.status === "ready" ? lookup.filePath : null;
}

/**
 * 遞迴搜尋巢狀目錄中的記憶主檔
 * @param requireMemPrefix - true: 只掃描 mem-* 目錄；false: 掃描所有目錄
 */
async function findMemoryMainRecursive(
  projectRoot: string,
  dir: string,
  moduleName: string,
  depth: number,
  parentId: string | null,
  requireMemPrefix: boolean,
): Promise<MemoryMainFileLookup | null> {
  if (depth > 4) return null;
  try {
    const entries = await fs.readdir(assertPathInsideProject(projectRoot, dir), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.toLowerCase() === "archive") continue;
      if (requireMemPrefix && !entry.name.startsWith("mem-")) continue;
      if (!requireMemPrefix && entry.name.startsWith(".")) continue;
      const cartridgeId = parentId ? `${parentId}.${entry.name}` : entry.name;
      const cardDir = path.join(dir, entry.name);
      if (cartridgeId === moduleName) {
        const lookup = await lookupFromDirectory(projectRoot, cardDir);
        if (lookup) return lookup;
      }
      const found = await findMemoryMainRecursive(
        projectRoot,
        cardDir,
        moduleName,
        depth + 1,
        cartridgeId,
        false,
      );
      if (found) return found;
    }
  } catch {
    /* 目錄不存在 */
  }
  return null;
}

/**
 * memory_list — 列出所有 mem-* 記憶卡匣目錄名稱（含過期狀態增強）
 */
export async function handleMemoryList(args: unknown): Promise<McpToolResult> {
  const parsed = memoryListSchema.safeParse(args);
  if (!parsed.success) {
    return createHandlerErrorResult({
      tool: "memory_list",
      readOnly: true,
      code: "validation_error",
      message:
        "Validation Error: projectRoot is required (must be absolute path without ..)",
    });
  }

  // 路徑安全二次驗證
  try {
    validateProjectRoot(parsed.data.projectRoot);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return createHandlerErrorResult({
      tool: "memory_list",
      readOnly: true,
      projectRoot: parsed.data.projectRoot,
      code: "path_validation_error",
      message: `Path Validation Error: ${msg}`,
    });
  }

  const listProjectRoot = parsed.data.projectRoot;
  const agentsDir = path.join(listProjectRoot, ".agents", "memory");
  try {
    // 優先從索引檔讀取全部卡匣（含巢狀子卡）
    const indexPath = path.join(
      parsed.data.projectRoot,
      ".cartridge",
      "index.json",
    );
    try {
      const indexRaw = await fs.readFile(assertPathInsideProject(parsed.data.projectRoot, indexPath), "utf-8");
      const index = createVisibleCartridgeIndex(
        JSON.parse(indexRaw) as CartridgeIndex,
      );
      const cartridges = index.cartridges ?? {};
      const modules = Object.keys(cartridges);
      const untrackedFiles = index.untrackedFiles ?? [];

      const enriched = await Promise.all(modules.map(async (mod) => {
        const cached = cartridges[mod];
        const lookup = await resolveMemoryMainFileForModule(parsed.data.projectRoot, mod);
        const entry = { ...cached };
        if (lookup.status === "ready" || lookup.status === "conflict" || lookup.status === "missing") {
          entry.mainFile = lookup.mainFile ?? cached.mainFile;
          entry.mainFileType = entry.mainFile?.type ?? (lookup.status === "missing" ? "missing" : cached.mainFileType);
          if (lookup.status === "ready") {
            entry.contentQuality = lookup.contentQuality;
            entry.contentQualityStatus = lookup.contentQuality.status;
          } else {
            entry.contentQuality = undefined;
            entry.contentQualityStatus = lookup.status === "conflict" ? "conflict" : "pending_review";
          }
        }
        const trackedCount = entry.trackedFiles?.length ?? 0;
        return {
          module: mod,
          description: entry.description ?? "",
          staleness: entry.staleness ?? 0,
          level: stalenessToLevel(entry.staleness ?? 0),
          pendingChangesCount: entry.pendingChanges?.length ?? 0,
          depth: entry.depth ?? 1,
          parent: entry.parent ?? null,
          trackedFilesCount: trackedCount,
          ghostFilesCount: entry.ghostFiles?.length ?? 0,
          dependencyCount: entry.dependencies?.length ?? 0,
          indirectStaleness: entry.indirectStaleness ?? 0,
          dependencyDiagnostics: entry.dependencyDiagnostics ?? [],
          dependencySyncWarning: entry.dependencySyncWarning ?? null,
          compaction: entry.compaction ?? null,
          cardKind: entry.compaction?.cardKind ?? null,
          compactionCompliance: entry.compaction?.compliance ?? null,
          sizeBytes: entry.compaction?.sizeBytes ?? null,
          sizeLimitBytes: entry.compaction?.sizeLimitBytes ?? null,
          lineCount: entry.compaction?.lineCount ?? null,
          lineLimit: entry.compaction?.lineLimit ?? null,
          chineseRatio: entry.compaction?.chineseRatio ?? null,
          cycleEventCount: entry.compaction?.cycleEventCount ?? null,
          cycleEventLimit: entry.compaction?.cycleEventLimit ?? null,
          needsCompaction: entry.compaction?.needsCompaction ?? false,
          legacyMemory: entry.compaction?.isLegacy ?? false,
          mainFile: entry.mainFile ?? null,
          mainFileType: entry.mainFile?.type ?? entry.mainFileType ?? "legacy SKILL.md",
          mainFilePath: entry.mainFile ? entry.mainFile.activePath : entry.skillPath ?? null,
          contentQuality: entry.contentQuality ?? null,
          contentQualityStatus:
            entry.contentQuality?.status ??
            entry.contentQualityStatus ??
            "pending_review",
          migrationRequired: entry.migrationRequired ?? false,
          legacyCompatibility: entry.legacyCompatibility ?? false,
          compactionStatus: entry.compaction?.compactionStatus ?? null,
          compactionRecommendation:
            entry.compaction?.recommendedAction ?? "unknown",
          compactionReasons: entry.compaction?.reasons ?? [],
          archiveVolumes: entry.compaction?.archiveVolumes ?? [],
          archiveMigrationWarnings:
            entry.compaction?.archiveMigrationWarnings ?? [],
          splitSuggestion:
            trackedCount > 8
              ? `此模組追蹤了 ${trackedCount} 個檔案，這是拆分建議，不會單獨阻擋提交。`
              : null,
          blockingSuggestion: entry.compaction?.needsCompaction
            ? "此記憶卡已達壓縮門檻，請先彙整週期事件或拆分歸檔。"
            : null,
        };
      }));
      const dependencyFindings: CartridgeFinding[] = enriched.flatMap((entry) => [
        ...(entry.dependencySyncWarning ? [{ severity: "warning" as const, code: "DERIVED_SYNC_PARTIAL", message: `${entry.module}: ${entry.dependencySyncWarning}` }] : []),
        ...entry.dependencyDiagnostics.map((item) => ({ severity: "warning" as const, code: item.code, message: `${entry.module}: ${item.message}` })),
      ]);

      const legacy = {
        cartridges: enriched,
        untrackedFiles,
      };
      return toMcpTextResult(
        createToolEnvelope({
          tool: "memory_list",
          readOnly: true,
          projectRoot: parsed.data.projectRoot,
          status: enriched.some((entry) => entry.mainFileType === "conflict") ? "error"
            : dependencyFindings.length > 0 ? "warning" : "ready",
          findings: dependencyFindings,
          summary: {
            cartridgeCount: enriched.length,
            cartridges: enriched,
            untrackedFiles,
          },
          legacy,
        }),
      );
    } catch {
      // 索引不存在 — 回退到目錄掃描（先掃 memory/，再掃 skills/mem-*）
      const modules: string[] = [];
      async function collect(dir: string, depth: number, parent: string | null, legacyRoot: boolean): Promise<void> {
        if (depth > 4) return;
        let files: Array<{ name: string; isDirectory: () => boolean }>;
        try {
          files = await fs.readdir(assertPathInsideProject(listProjectRoot, dir), { withFileTypes: true });
        } catch { return; }
        for (const child of files) {
          if (!child.isDirectory() || child.name.startsWith(".") || child.name.toLowerCase() === "archive") continue;
          if (legacyRoot && !child.name.startsWith("mem-")) continue;
          const module = parent ? `${parent}.${child.name}` : child.name;
          const childDir = path.join(dir, child.name);
          const resolved = await resolveMemoryMainFileInDirectory(listProjectRoot, childDir);
          if ((resolved.mainFile.type !== "missing" || await hasChildMemoryCardDirectory(listProjectRoot, childDir)) && !modules.includes(module)) modules.push(module);
          await collect(childDir, depth + 1, module, false);
        }
      }
      await collect(agentsDir, 1, null, false);
      await collect(path.join(parsed.data.projectRoot, ".agents", "skills"), 1, null, true);
      const fallbackCartridges = await Promise.all(
        modules.map(async (module) => {
          const lookup = await resolveMemoryMainFileForModule(
            parsed.data.projectRoot,
            module,
          );
          if (lookup.status === "ready") {
            return {
              module,
              mainFile: lookup.mainFile,
              mainFileType: lookup.mainFile.type,
              contentQuality: lookup.contentQuality,
              contentQualityStatus: lookup.contentQuality.status,
              migrationRequired:
                lookup.mainFile.migrationRequired ||
                lookup.contentQuality.migrationRequired,
              legacyCompatibility: lookup.mainFile.legacyCompatibility,
            };
          }
          if (lookup.status === "conflict") {
            return {
              module,
              mainFile: lookup.mainFile,
              mainFileType: lookup.mainFile?.type ?? "conflict",
              contentQuality: null,
              contentQualityStatus: "conflict",
              migrationRequired: true,
              legacyCompatibility: false,
            };
          }
          return {
            module,
            mainFile: null,
            mainFileType: "missing",
            contentQuality: null,
            contentQualityStatus: "pending_review",
            migrationRequired: true,
            legacyCompatibility: false,
          };
        }),
      );
      const text = `Available memories:\n${modules.join("\n")}`;
      return toMcpTextResult(
        createToolEnvelope({
          tool: "memory_list",
          readOnly: true,
          projectRoot: parsed.data.projectRoot,
          status: fallbackCartridges.some((entry) => entry.mainFileType === "conflict") ? "error" : "ready",
          summary: {
            cartridgeCount: modules.length,
            cartridges: fallbackCartridges,
            untrackedFiles: [],
          },
          legacy: { text, modules },
        }),
      );
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return createHandlerErrorResult({
      tool: "memory_list",
      readOnly: true,
      projectRoot: parsed.data.projectRoot,
      code: "memory_list_failed",
      message: `Error: ${msg}`,
    });
  }
}

/**
 * memory_read — 讀取指定記憶卡匣的 SKILL.md 內容
 */
export async function handleMemoryRead(args: unknown): Promise<McpToolResult> {
  const parsed = memoryReadSchema.safeParse(args);
  if (!parsed.success) {
    return createHandlerErrorResult({
      tool: "memory_read",
      readOnly: true,
      code: "validation_error",
      message:
        "Validation Error: moduleName and projectRoot are required (projectRoot must be absolute path without ..)",
    });
  }

  // 路徑安全二次驗證
  try {
    validateProjectRoot(parsed.data.projectRoot);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return createHandlerErrorResult({
      tool: "memory_read",
      readOnly: true,
      projectRoot: parsed.data.projectRoot,
      code: "path_validation_error",
      message: `Path Validation Error: ${msg}`,
    });
  }

  try {
    const lookup = await resolveMemoryMainFileForModule(
      parsed.data.projectRoot,
      parsed.data.moduleName,
    );
    if (lookup.status === "conflict") {
      return createMemoryMainConflictResult({
        tool: "memory_read",
        readOnly: true,
        projectRoot: parsed.data.projectRoot,
        moduleName: parsed.data.moduleName,
        candidates: lookup.candidates,
      });
    }
    if (lookup.status !== "ready") {
      return createHandlerErrorResult({
        tool: "memory_read",
        readOnly: true,
        projectRoot: parsed.data.projectRoot,
        code: lookup.status === "missing" ? "memory_main_file_missing" : "module_not_found",
        message:
          lookup.status === "missing"
            ? `Error: Module "${parsed.data.moduleName}" has no active memory main file.`
            : `Error: Module "${parsed.data.moduleName}" not found. Searched: index → flat path → recursive scan.`,
      });
    }
    const filePath = lookup.filePath;
    const content = await fs.readFile(assertPathInsideProject(parsed.data.projectRoot, filePath), "utf-8");

    matter(content); // Reject unsupported frontmatter even on the raw-read surface.

    // 嘗試從索引取得父子關係提示
    let parentHint = "";
    try {
      const indexPath = path.join(
        parsed.data.projectRoot,
        ".cartridge",
        "index.json",
      );
      const indexRaw = await fs.readFile(assertPathInsideProject(parsed.data.projectRoot, indexPath), "utf-8");
      const index = JSON.parse(indexRaw);
      const entry = index.cartridges?.[parsed.data.moduleName];
      if (entry?.parent) {
        parentHint += `\n\n---\n_提示：此模組的父節點為 ${entry.parent}，建議同時讀取以獲取共用架構脈絡。_`;
      }
      const children = Object.entries(index.cartridges ?? {})
        .filter(
          ([, e]: [string, unknown]) =>
            (e as { parent?: string }).parent === parsed.data.moduleName,
        )
        .map(([id]: [string, unknown]) => id);
      if (children.length > 0) {
        parentHint += `\n_此模組的子節點：${children.join(", ")}_`;
      }
    } catch {
      // 索引不存在 — 靜默忽略
    }
    const text = content + parentHint;
    return toMcpTextResult(
      createToolEnvelope({
        tool: "memory_read",
        readOnly: true,
        projectRoot: parsed.data.projectRoot,
        status:
          lookup.contentQuality.status === "complete" &&
          !lookup.mainFile.legacyCompatibility
            ? "ready"
            : "warning",
        summary: {
          module: parsed.data.moduleName,
          skillPath: path.relative(parsed.data.projectRoot, filePath),
          mainFile: lookup.mainFile,
          mainFileType: lookup.mainFile.type,
          mainFilePath: lookup.relativePath,
          contentQuality: lookup.contentQuality,
          contentQualityStatus: lookup.contentQuality.status,
          migrationRequired:
            lookup.mainFile.migrationRequired ||
            lookup.contentQuality.migrationRequired,
          legacyCompatibility: lookup.mainFile.legacyCompatibility,
          content: text,
          hasRelationHint: parentHint.length > 0,
        },
        legacy: { text, content: text },
      }),
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return createHandlerErrorResult({
      tool: "memory_read",
      readOnly: true,
      projectRoot: parsed.data.projectRoot,
      code: "memory_read_failed",
      message: `Error: ${msg}`,
    });
  }
}

/**
 * memory_status — 查詢過期修復所需的診斷資訊
 * 回傳：過期指數、等級、異動檔案清單（含絕對路徑）、行動指引
 */
export async function handleMemoryStatus(
  args: unknown,
): Promise<McpToolResult> {
  const parsed = memoryStatusSchema.safeParse(args);
  if (!parsed.success) {
    return createHandlerErrorResult({
      tool: "memory_status",
      readOnly: true,
      code: "validation_error",
      message:
        "Validation Error: moduleName and projectRoot are required (projectRoot must be absolute path without ..)",
    });
  }

  // 路徑安全二次驗證
  try {
    validateProjectRoot(parsed.data.projectRoot);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return createHandlerErrorResult({
      tool: "memory_status",
      readOnly: true,
      projectRoot: parsed.data.projectRoot,
      code: "path_validation_error",
      message: `Path Validation Error: ${msg}`,
    });
  }

  const { moduleName, projectRoot } = parsed.data;
  const indexPath = path.join(projectRoot, ".cartridge", "index.json");

  // 嘗試從索引檔讀取完整資訊
  try {
    const indexRaw = await fs.readFile(assertPathInsideProject(projectRoot, indexPath), "utf-8");
    const index = JSON.parse(indexRaw);
    const entry = index.cartridges?.[moduleName];

    if (!entry) {
      return createHandlerErrorResult({
        tool: "memory_status",
        readOnly: true,
        projectRoot,
        code: "module_not_found",
        message: `Error: Module "${moduleName}" not found in cartridge index.`,
      });
    }

    const lookup = await resolveMemoryMainFileForModule(projectRoot, moduleName);
    const currentMainFile =
      lookup.status === "ready" || lookup.status === "conflict" || lookup.status === "missing"
        ? (lookup.mainFile ?? entry.mainFile ?? null)
        : (entry.mainFile ?? null);
    const currentMainFileType =
      currentMainFile?.type ??
      (lookup.status === "missing" ? "missing" : entry.mainFileType ?? "legacy SKILL.md");
    const currentContentQuality =
      lookup.status === "ready" ? lookup.contentQuality : null;
    const currentContentQualityStatus =
      lookup.status === "conflict"
        ? "conflict"
        : lookup.status === "ready"
          ? lookup.contentQuality.status
          : "pending_review";
    const inferredMigrationRequired =
      currentMainFileType !== "MEMORY.md" ||
      (currentContentQuality?.migrationRequired ??
        currentContentQualityStatus !== "complete");
    const currentMigrationRequired =
      currentMainFile?.migrationRequired ??
      entry.migrationRequired ??
      inferredMigrationRequired;
    const currentLegacyCompatibility =
      currentMainFile?.legacyCompatibility ?? entry.legacyCompatibility ?? false;
    const level = stalenessToLevel(entry.staleness ?? 0);
    const pendingChanges = (entry.pendingChanges ?? []).map(
      (change: { filePath: string; eventType: string; timestamp: string }) => ({
        ...change,
        absolutePath: path.resolve(projectRoot, change.filePath),
      }),
    );

    // 組建行動指引
    let actionRequired = "";
    if (entry.staleness > 0 && pendingChanges.length > 0) {
      const fileList = pendingChanges
        .map(
          (c: { absolutePath: string; eventType: string }) =>
            `- ${c.absolutePath} (${c.eventType})`,
        )
        .join("\n");
      actionRequired = `來源有變動，需先比較最新相關來源與記憶卡：\n${fileList}\n確認內容或追蹤資訊需要調整且已獲授權後才修改。若 owner、scope、claims 與 tracking 仍正確，可記錄版本與比較證據後得到 memory-attributed-no-write；此結果不會自動清除 stale 或同步索引。`;
    } else if (entry.staleness > 0) {
      actionRequired = `來源狀態需複審（staleness: ${entry.staleness}），但無已記錄的異動檔案。請比較最新相關來源、owner、scope、claims 與 tracking；證據不足時不能推論需要寫卡或 no-write。`;
    }

    // 幽靈檔案行動指引
    const ghostFiles: string[] = entry.ghostFiles ?? [];
    if (ghostFiles.length > 0) {
      const ghostList = ghostFiles.map((g: string) => `- ${g}`).join("\n");
      actionRequired += actionRequired
        ? `\n\n此外，以下追蹤檔案已不存在於磁碟（幽靈檔案）：\n${ghostList}\n請確認應恢復檔案或在獲授權後修正 Tracked Files；缺檔本身不授權移除追蹤。`
        : `以下追蹤檔案已不存在於磁碟（幽靈檔案）：\n${ghostList}\n請確認應恢復檔案或在獲授權後修正 Tracked Files；缺檔本身不授權移除追蹤。`;
    }

    const status = {
      module: moduleName,
      staleness: entry.staleness ?? 0,
      level,
      lastUpdated: entry.lastUpdated ?? "",
      trackedFiles: entry.trackedFiles ?? [],
      pendingChanges,
      ghostFiles,
      indirectStaleness: entry.indirectStaleness ?? 0,
      dependencyDiagnostics: entry.dependencyDiagnostics ?? [],
      dependencySyncWarning: entry.dependencySyncWarning ?? null,
      mainFile: currentMainFile,
      mainFileType: currentMainFileType,
      mainFilePath:
        lookup.status === "ready"
          ? lookup.relativePath
          : currentMainFile ? currentMainFile.activePath : null,
      contentQuality: currentContentQuality,
      contentQualityStatus: currentContentQualityStatus,
      migrationRequired: currentMigrationRequired,
      legacyCompatibility: currentLegacyCompatibility,
      actionRequired,
    };

    return toMcpTextResult(
      createToolEnvelope({
        tool: "memory_status",
        readOnly: true,
        projectRoot,
        status:
          currentMainFileType === "conflict"
            ? "error"
            : entry.staleness > 0 ||
                entry.dependencySyncWarning ||
                (entry.dependencyDiagnostics?.length ?? 0) > 0 ||
                ghostFiles.length > 0 ||
                currentMainFileType !== "MEMORY.md" ||
                currentContentQualityStatus !== "complete"
              ? "warning"
              : "ready",
        summary: status,
        findings: [
          ...(entry.dependencySyncWarning ? [{ severity: "warning" as const, code: "DERIVED_SYNC_PARTIAL", message: entry.dependencySyncWarning }] : []),
          ...(entry.dependencyDiagnostics ?? []).map((item: { code: string; message: string }) => ({ severity: "warning" as const, code: item.code, message: item.message })),
          ...(currentMainFileType === "conflict"
            ? [
                {
                  severity: "error" as const,
                  code: "memory_main_file_conflict",
                  message: `Module ${moduleName} has both MEMORY.md and SKILL.md.`,
                },
              ]
            : []),
          ...(currentMainFileType === "legacy SKILL.md"
            ? [
                {
                  severity: "warning" as const,
                  code: "memory_main_file_legacy",
                  message: `Module ${moduleName} is using legacy SKILL.md compatibility.`,
                },
              ]
            : []),
          ...(currentContentQualityStatus !== "complete"
            ? [
                {
                  severity: "warning" as const,
                  code: "memory_content_quality",
                  message: `Module ${moduleName} content quality status is ${currentContentQualityStatus}.`,
                },
              ]
            : []),
          ...(entry.staleness > 0
            ? [
                {
                  severity: "warning" as const,
                  code: "memory_stale",
                  message: `Module ${moduleName} has staleness ${entry.staleness}.`,
                },
              ]
            : []),
          ...ghostFiles.map((file) => ({
            severity: "warning" as const,
            code: "ghost_file",
            message: `Tracked file no longer exists: ${file}`,
            file,
          })),
        ],
        legacy: status,
      }),
    );
  } catch {
    // 索引檔不存在 — 回退到讀取 SKILL.md frontmatter
    try {
      const lookup = await resolveMemoryMainFileForModule(projectRoot, moduleName);
      if (lookup.status === "conflict") {
        return createMemoryMainConflictResult({
          tool: "memory_status",
          readOnly: true,
          projectRoot,
          moduleName,
          candidates: lookup.candidates,
        });
      }
      if (lookup.status !== "ready") {
        return createHandlerErrorResult({
          tool: "memory_status",
          readOnly: true,
          projectRoot,
          code: lookup.status === "missing" ? "memory_main_file_missing" : "module_not_found",
          message:
            lookup.status === "missing"
              ? `Error: Module "${moduleName}" has no active memory main file.`
              : `Error: Module "${moduleName}" not found.`,
        });
      }
      const filePath = lookup.filePath;
      const raw = await fs.readFile(assertPathInsideProject(projectRoot, filePath), "utf-8");
      const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
      let staleness = 0;
      let lastUpdated = "";
      if (fmMatch) {
        const smatch = fmMatch[1].match(/staleness:\s*(\d+)/);
        const tmatch = fmMatch[1].match(/last_updated:\s*['"]?([^'"\n]+)/);
        if (smatch) staleness = parseInt(smatch[1], 10);
        if (tmatch) lastUpdated = tmatch[1].trim();
      }

      const status = {
        module: moduleName,
        staleness,
        level: stalenessToLevel(staleness),
        lastUpdated,
        trackedFiles: [],
        pendingChanges: [],
        mainFile: lookup.mainFile,
        mainFileType: lookup.mainFile.type,
        mainFilePath: lookup.relativePath,
        contentQuality: lookup.contentQuality,
        contentQualityStatus: lookup.contentQuality.status,
        migrationRequired:
          lookup.mainFile.migrationRequired ||
          lookup.contentQuality.migrationRequired,
        legacyCompatibility: lookup.mainFile.legacyCompatibility,
        actionRequired:
          staleness > 0
            ? `來源狀態需複審（staleness: ${staleness}）。索引檔不存在，無法提供異動檔案清單。請比較最新相關來源與卡片；不得只為清 stale 而寫卡。`
            : "",
        _note:
          "索引檔不存在，過期資訊來自作用中主檔 frontmatter。pendingChanges 和 trackedFiles 無法提供。",
      };
      const fallbackFindings: CartridgeFinding[] = [];
      if (lookup.mainFile.type === "legacy SKILL.md") {
        fallbackFindings.push({
          severity: "warning",
          code: "memory_main_file_legacy",
          message: `Module ${moduleName} is using legacy SKILL.md compatibility.`,
        });
      }
      if (lookup.contentQuality.status !== "complete") {
        fallbackFindings.push({
          severity: "warning",
          code: "memory_content_quality",
          message: `Module ${moduleName} content quality status is ${lookup.contentQuality.status}.`,
        });
      }
      if (staleness > 0) {
        fallbackFindings.push({
          severity: "warning",
          code: "memory_stale",
          message: `Module ${moduleName} has staleness ${staleness}.`,
        });
      }

      return toMcpTextResult(
        createToolEnvelope({
          tool: "memory_status",
          readOnly: true,
          projectRoot,
          status:
            staleness > 0 ||
            lookup.mainFile.type !== "MEMORY.md" ||
            lookup.contentQuality.status !== "complete"
              ? "warning"
              : "ready",
          summary: status,
          findings: fallbackFindings,
          legacy: status,
        }),
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return createHandlerErrorResult({
        tool: "memory_status",
        readOnly: true,
        projectRoot,
        code: "memory_status_failed",
        message: `Error: ${msg}`,
      });
    }
  }
}

/** 結構驗證結果 */
export interface CommitReport {
  status: "success";
  module: string;
  trackedFilesCount: number;
  cardWritten: boolean;
  indexSynchronized: boolean;
  indexRegistered: boolean;
  trackingSynchronized: boolean;
  derivedSynchronized: boolean;
  synchronizationComplete: boolean;
  warnings: string[];
}

/**
 * 驗證追蹤路徑格式是否符合規範（路徑基準合約 v4.1）
 * - 禁止絕對路徑（違反跨環境可攜性）
 * - 禁止路徑穿越符號（../）
 * 回傳結構化警告字串陣列，整合至 memory_commit warnings 欄位
 */
function validateTrackedFilePaths(
  paths: string[],
  moduleName: string,
): string[] {
  const pathWarnings: string[] = [];
  for (const p of paths) {
    if (path.isAbsolute(p)) {
      pathWarnings.push(
        `⚠️ [PATH_ABSOLUTE] "${moduleName}" 追蹤了絕對路徑 "${p}"。` +
          `請改為相對於專案根目錄的相對路徑（例如 "src/index.ts"）。`,
      );
    }
    if (p.includes("..")) {
      pathWarnings.push(
        `⚠️ [PATH_TRAVERSAL] "${moduleName}" 追蹤路徑含路徑穿越符號："${p}"。`,
      );
    }
  }
  return pathWarnings;
}

function formatQualityWarnings(
  moduleName: string,
  quality: MemoryQualityReport,
): string[] {
  const warnings: string[] = [];
  if (quality.missingFields.length > 0) {
    warnings.push(
      `⚠️ [MEMORY_QUALITY_FIELDS] "${moduleName}" 缺少品質欄位：${quality.missingFields.join(", ")}。`,
    );
  }
  if (quality.missingSections.length > 0) {
    warnings.push(
      `⚠️ [MEMORY_QUALITY_SECTIONS] "${moduleName}" 缺少品質段落：${quality.missingSections.join(", ")}。`,
    );
  }
  if (quality.evidenceWarnings.length > 0) {
    warnings.push(
      `⚠️ [MEMORY_QUALITY_EVIDENCE] "${moduleName}" Evidence Base 缺少可驗證證據：${quality.evidenceWarnings.join(" ")}`,
    );
  }
  if (quality.status === "pending_review") {
    warnings.push(
      `⚠️ [MEMORY_QUALITY_PENDING_REVIEW] "${moduleName}" 尚未達已驗證狀態；缺證據不可視為通過。`,
    );
  }
  if (quality.status === "superseded") {
    warnings.push(
      `⚠️ [MEMORY_QUALITY_SUPERSEDED] "${moduleName}" 已標記為取代/被取代，需確認是否仍為作用中主卡。`,
    );
  }
  return warnings;
}

/**
 * memory_commit — 後設資料同步工具
 * 在 AI 用原生工具寫入 SKILL.md 後呼叫，負責：
 * 1. 時間戳注入（台灣時區）
 * 2. staleness 歸零
 * 3. 索引同步（pendingChanges 清除 + trackedFiles 重新解析）
 * 4. 結構驗證（frontmatter 欄位 + 必要區段檢查）
 *    4a. 標題精確匹配（HEADING_TYPO 偵測）
 *    4b. 路徑格式驗證（PATH_ABSOLUTE / PATH_TRAVERSAL 偵測）
 */
export async function handleMemoryCommit(
  args: unknown,
): Promise<McpToolResult> {
  const parsed = memoryCommitSchema.safeParse(args);
  if (!parsed.success) {
    return createHandlerErrorResult({
      tool: "memory_commit",
      readOnly: false,
      code: "validation_error",
      message:
        "Validation Error: moduleName, projectRoot, and confirm:true are required (projectRoot must be absolute path without ..)",
    });
  }

  // 路徑安全二次驗證
  try {
    validateProjectRoot(parsed.data.projectRoot);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return createHandlerErrorResult({
      tool: "memory_commit",
      readOnly: false,
      projectRoot: parsed.data.projectRoot,
      code: "path_validation_error",
      message: `Path Validation Error: ${msg}`,
    });
  }

  try {
    const { moduleName, projectRoot } = parsed.data;
    const isoLocal = getTaiwanISO();

    // 1. 路徑解析
    const lookup = await resolveMemoryMainFileForModule(projectRoot, moduleName);
    if (lookup.status === "conflict") {
      return createMemoryMainConflictResult({
        tool: "memory_commit",
        readOnly: false,
        projectRoot,
        moduleName,
        candidates: lookup.candidates,
      });
    }
    if (lookup.status !== "ready") {
      return createHandlerErrorResult({
        tool: "memory_commit",
        readOnly: false,
        projectRoot,
        code: lookup.status === "missing" ? "memory_main_file_missing" : "module_not_found",
        message:
          lookup.status === "missing"
            ? `Error: Module "${moduleName}" has no active memory main file.`
            : `Error: Module "${moduleName}" not found. Please ensure the memory main file exists before calling memory_commit.`,
      });
    }
    const filePath = lookup.filePath;

    // 2. 讀取已寫入的作用中主檔
    const rawContent = await fs.readFile(assertPathInsideProject(projectRoot, filePath), "utf-8");

    // 3. 結構驗證
    const warnings: string[] = [];
    if (lookup.mainFile.legacyCompatibility) {
      warnings.push(
        `⚠️ [LEGACY_COMPATIBILITY] "${moduleName}" 目前寫回 legacy SKILL.md；此同步只代表相容期更新，不代表已完成新版 MEMORY.md 標準。`,
      );
    }
    const { data: frontmatter, content: body } = matter(rawContent);
    if (!frontmatter.name) warnings.push("frontmatter 缺少 name 欄位");
    if (!frontmatter.description)
      warnings.push("frontmatter 缺少 description 欄位");
    // 精確匹配：確保標題不含尾部多餘字元（如 ## Tracked FilesD）
    const TRACKED_FILES_HEADING_RE = /^## Tracked Files\s*$/m;
    if (!TRACKED_FILES_HEADING_RE.test(body)) {
      const typoMatch = body.match(/^## Tracked Files\S+/m);
      if (typoMatch) {
        warnings.push(
          `⚠️ [HEADING_TYPO] "## Tracked Files" 標題疑似拼寫錯誤：` +
            `偵測到 "${typoMatch[0].trim()}"。解析器將忽略此區塊，` +
            `所有追蹤檔案將被視為未歸屬。請修正為精確標題 "## Tracked Files"。`,
        );
      } else {
        warnings.push("body 缺少 ## Tracked Files 區段");
      }
    }
    // 合約要求的 metadata 區塊驗證
    if (!frontmatter.metadata) {
      warnings.push("frontmatter 缺少 metadata 區塊（合約 §3 要求）");
    } else {
      const meta = frontmatter.metadata as Record<string, unknown>;
      const requiredKeys = [
        "author",
        "version",
        "origin",
        "memory_awareness",
        "tool_scope",
      ];
      for (const key of requiredKeys) {
        if (!(key in meta)) {
          warnings.push(`metadata 缺少 ${key} 欄位`);
        }
      }
    }

    // 追蹤路徑格式驗證（路徑基準合約 v4.1）
    const trackedPathsForValidation = parseTrackedFiles(body);
    const pathWarnings = validateTrackedFilePaths(
      trackedPathsForValidation,
      moduleName,
    );
    warnings.push(...pathWarnings);

    let indexForCommit: CartridgeIndex | null = null;
    try {
      const indexPath = path.join(projectRoot, ".cartridge", "index.json");
      indexForCommit = JSON.parse(
        await fs.readFile(assertPathInsideProject(projectRoot, indexPath), "utf-8"),
      ) as CartridgeIndex;
    } catch {
      indexForCommit = null;
    }

    const cartridgeEntry = indexForCommit?.cartridges[moduleName];
    const dependencies = normalizeDeclaredDependencies(frontmatter.dependencies);
    warnings.push(
      ...validateDependencySemantics({
        moduleName,
        dependencies,
        body,
        parent: cartridgeEntry?.parent ?? null,
      }).map(formatDependencySemanticWarning),
    );
    const preCommitCompaction = buildCompactionMetrics(rawContent, frontmatter, {
      cardPath: filePath,
    });
    if (preCommitCompaction.reasons.includes("cycleEventLimitExceeded")) {
      return createHandlerErrorResult({
        tool: "memory_commit",
        readOnly: false,
        projectRoot,
        code: "memory_compaction_required",
        message:
          `Cycle Events 已超過 ${preCommitCompaction.cycleEventLimit} 筆，` +
          "請先彙整記憶卡後再同步。",
      });
    }
    warnings.push(...formatCompactionWarnings(moduleName, preCommitCompaction));

    // A commit acknowledges reviewed present sources; still-tracked missing or
    // unsafe sources remain unresolved. Validate before writing metadata so the
    // card and canonical tracking state tell the same story.
    const unresolvedTrackedFiles: string[] = [];
    for (const trackedPath of trackedPathsForValidation) {
      try {
        await fs.access(assertPathInsideProject(projectRoot, trackedPath));
      } catch {
        unresolvedTrackedFiles.push(trackedPath);
      }
    }
    const config = createConfig(projectRoot);
    const remainingStaleness = unresolvedTrackedFiles.length > 0
      ? Math.max(Number(frontmatter.staleness) || 0, unresolvedTrackedFiles.length * config.scoring.fileDeleted)
      : 0;
    if (unresolvedTrackedFiles.length > 0) {
      warnings.push(`⚠️ [TRACKING_SYNC_PARTIAL] 主檔仍追蹤不存在或無法安全驗證的路徑：${unresolvedTrackedFiles.join(", ")}。請確認應恢復檔案或另行核准追蹤修正。`);
    }

    // Only managed metadata/warnings change; ordinary legacy repairs do not
    // rename, normalize the schema, or rewrite historical archive content.
    const originalBody = readMemorySource(rawContent).content;
    const updatedContent = patchMemorySource(rawContent, {
      last_updated: isoLocal,
      staleness: remainingStaleness,
      ...(frontmatter.status === undefined || ["stable", "stale"].includes(String(frontmatter.status))
        ? { status: remainingStaleness > 0 ? "stale" : "stable" } : {}),
    }, remainingStaleness === 0 ? stripWarningBlock(originalBody) : originalBody);
    const { data: commitFm } = matter(updatedContent);
    const postCommitCompaction = buildCompactionMetrics(updatedContent, commitFm, {
      cardPath: filePath,
    });
    const postCommitQuality = analyzeMemoryContentQuality(
      updatedContent,
      lookup.mainFile,
    );
    warnings.push(...formatQualityWarnings(moduleName, postCommitQuality));
    await fs.writeFile(assertPathInsideProject(projectRoot, filePath), updatedContent, "utf-8");

    // 5. 索引同步：主檔已成功寫入時，索引失敗需明確回報 partial warning。
    let trackedFilesCount = trackedPathsForValidation.length;
    let indexSynchronized = false;
    let indexRegistered = false;
    let trackingSynchronized = false;
    let derivedSynchronized = false;
    try {
      const manager = new CartridgeIndexManager(config);
      await runProjectIndexTransaction({
        projectRoot,
        indexManager: manager,
        mutation: async () => {
          const index = manager.getIndex();
          if (!index.cartridges?.[moduleName]) {
            throw new Error(
              `Module "${moduleName}" is absent from the canonical project index.`,
            );
          }
        // Never mistake a metadata write for resolution of missing sources.
        const unresolved = new Set(unresolvedTrackedFiles);
        const remainingPending = (index.cartridges[moduleName].pendingChanges ?? [])
          .filter((change) => unresolved.has(change.filePath));
        for (const filePath of unresolved) {
          const pending = remainingPending.find((change) => change.filePath === filePath);
          if (pending) pending.eventType = "unlink";
          else remainingPending.push({ filePath, eventType: "unlink", timestamp: isoLocal });
        }
        index.cartridges[moduleName].pendingChanges = remainingPending;
        index.cartridges[moduleName].staleness = remainingStaleness;
        index.cartridges[moduleName].lastUpdated = isoLocal;
        index.cartridges[moduleName].ghostFiles = unresolvedTrackedFiles;
        index.cartridges[moduleName].compaction = postCommitCompaction;
        index.cartridges[moduleName].skillPath = lookup.relativePath;
        index.cartridges[moduleName].mainFile = lookup.mainFile;
        index.cartridges[moduleName].mainFileType = lookup.mainFile.type;
        index.cartridges[moduleName].contentQuality = postCommitQuality;
        index.cartridges[moduleName].contentQualityStatus =
          postCommitQuality.status;
        index.cartridges[moduleName].migrationRequired =
          lookup.mainFile.migrationRequired ||
          postCommitQuality.migrationRequired;
        index.cartridges[moduleName].legacyCompatibility =
          lookup.mainFile.legacyCompatibility;

        // 重新解析 trackedFiles
        const trackedFiles = parseTrackedFiles(matter(updatedContent).content);
        index.cartridges[moduleName].trackedFiles = trackedFiles;
        trackedFilesCount = trackedFiles.length;

        // 重建此模組的 fileMap 條目
        for (const [file, modules] of Object.entries(index.fileMap ?? {})) {
          const filtered = (modules as string[]).filter(
            (m) => m !== moduleName,
          );
          if (filtered.length === 0) {
            delete index.fileMap[file];
          } else {
            index.fileMap[file] = filtered;
          }
        }
        for (const file of trackedFiles) {
          if (!index.fileMap[file]) index.fileMap[file] = [];
          if (!(index.fileMap[file] as string[]).includes(moduleName)) {
            (index.fileMap[file] as string[]).push(moduleName);
          }
        }

        index.untrackedFiles = filterVisibleUntrackedFiles(
          index.untrackedFiles ?? [],
        ).filter((entry) => !trackedFiles.includes(entry.filePath));

        try {
          // Canonical declaration snapshots are already validated on load and
          // carry no filesystem authority. Use the target's freshly read data;
          // do not infer trusted custom roots from arbitrary index paths.
          const declarations = new Map(Object.entries(index.cartridges)
            .filter(([, cartridge]) => Array.isArray(cartridge.declaredDependencies))
            .map(([id, cartridge]) => [id, cartridge.declaredDependencies!] as const));
          declarations.set(moduleName, dependencies);
          recomputeDependencyState(index, projectRoot, config.dependencyDepth, declarations);
          derivedSynchronized = true;
        } catch (error) {
          // The helper stages all derived values before replacing anything.
          // A failed recomputation must retain the last trusted graph/scores.
          const derivedWarning = `依賴衍生狀態未收斂，保留上一份可信結果：${error instanceof Error ? error.message : String(error)}`;
          for (const cartridge of Object.values(index.cartridges)) cartridge.dependencySyncWarning = derivedWarning;
          warnings.push(`⚠️ [DERIVED_SYNC_PARTIAL] 卡片已寫入；${derivedWarning}。`);
        }
          manager.markDirty();
        },
      });
      indexSynchronized = true;
      indexRegistered = true;
      trackingSynchronized = unresolvedTrackedFiles.length === 0;
    } catch (error) {
      derivedSynchronized = false;
      warnings.push(
        `⚠️ [INDEX_SYNC_PARTIAL] 記憶主檔已更新，但 canonical index 同步失敗：${
          error instanceof Error ? error.message : String(error)
        }。必要時另行取得 memory_reindex 的寫入授權以收斂狀態。`,
      );
    }

    // 6. 回傳結構化報告
    const report: CommitReport = {
      status: "success",
      module: moduleName,
      trackedFilesCount,
      cardWritten: true,
      indexSynchronized,
      indexRegistered,
      trackingSynchronized,
      derivedSynchronized,
      synchronizationComplete: indexSynchronized && indexRegistered && trackingSynchronized && derivedSynchronized,
      warnings,
    };

    return toMcpTextResult(
      createToolEnvelope({
        tool: "memory_commit",
        readOnly: false,
        projectRoot,
        status:
          warnings.length > 0 || postCommitQuality.status !== "complete"
            ? "warning"
            : "ready",
        summary: {
          ...report,
          mainFile: lookup.mainFile,
          mainFileType: lookup.mainFile.type,
          mainFilePath: lookup.relativePath,
          contentQuality: postCommitQuality,
          contentQualityStatus: postCommitQuality.status,
          migrationRequired:
            lookup.mainFile.migrationRequired ||
            postCommitQuality.migrationRequired,
          legacyCompatibility: lookup.mainFile.legacyCompatibility,
        },
        findings: warnings.map((warning) => ({
          severity: "warning",
          code: warning.includes("[DERIVED_SYNC_PARTIAL]") ? "DERIVED_SYNC_PARTIAL"
            : warning.includes("[INDEX_SYNC_PARTIAL]") ? "INDEX_SYNC_PARTIAL"
              : warning.includes("[TRACKING_SYNC_PARTIAL]") ? "TRACKING_SYNC_PARTIAL"
                : "memory_commit_warning",
          message: warning,
        })),
        legacy: { ...report },
      }),
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return createHandlerErrorResult({
      tool: "memory_commit",
      readOnly: false,
      projectRoot:
        typeof args === "object" &&
        args !== null &&
        "projectRoot" in args &&
        typeof (args as { projectRoot?: unknown }).projectRoot === "string"
          ? (args as { projectRoot: string }).projectRoot
          : "",
      code: "memory_commit_failed",
      message: `Error: ${msg}`,
    });
  }
}

/**
 * memory_reindex — 重建記憶索引並刷新主檔型態、品質狀態、幽靈檔案與未歸屬摘要
 */
export async function handleMemoryReindex(
  args: unknown,
): Promise<McpToolResult> {
  const parsed = memoryReindexSchema.safeParse(args);
  if (!parsed.success) {
    return createHandlerErrorResult({
      tool: "memory_reindex",
      readOnly: false,
      code: "validation_error",
      message:
        "Validation Error: projectRoot and confirm:true are required (projectRoot must be absolute path without ..)",
    });
  }

  try {
    const projectRoot = validateProjectRoot(parsed.data.projectRoot);
    const result = await refreshMemoryIndex({
      projectRoot,
      detectMissedChanges: true,
      includeProjectFiles: true,
      persist: true,
    });
    const hasConflicts = result.summary.conflicts.length > 0;
    const hasMigrationWork = result.summary.migrationRequired > 0;
    const hasExclusionWarnings = result.exclusionDiagnostics.length > 0;
    const hasIndexRepair = (result.indexDiagnostics?.length ?? 0) > 0;
    return toMcpTextResult(
      createToolEnvelope({
        tool: "memory_reindex",
        readOnly: false,
        projectRoot,
        status: hasConflicts
          ? "error"
          : hasMigrationWork || hasExclusionWarnings || hasIndexRepair
            ? "warning"
            : "ready",
        summary: {
          ...result.summary,
          lastScanned: result.index.lastScanned,
          exclusionMode: result.exclusionMode,
          exclusionDiagnostics: result.exclusionDiagnostics,
        },
        findings: [
          ...result.summary.conflicts.map((conflict) => ({
            severity: "error" as const,
            code: "memory_main_file_conflict",
            message: `${conflict.module} has both MEMORY.md and SKILL.md.`,
            file: conflict.candidates.join(", "),
          })),
          ...(hasMigrationWork && !hasConflicts
            ? [
                {
                  severity: "warning" as const,
                  code: "memory_migration_required",
                  message: `${result.summary.migrationRequired} memory cards require migration or quality review.`,
                },
              ]
            : []),
          ...result.exclusionDiagnostics.map((diagnostic) => ({
            severity: "warning" as const,
            code: `git_exclusion_${diagnostic.code}`,
            message: diagnostic.message,
          })),
          ...(result.indexDiagnostics ?? []).map((diagnostic) => ({
            severity: "warning" as const,
            code: diagnostic.code,
            message: diagnostic.message,
          })),
        ],
        legacy: {
          text:
            `memory_reindex complete: cartridges=${result.summary.cartridgeCount}, ` +
            `migrationRequired=${result.summary.migrationRequired}, ` +
            `conflicts=${result.summary.conflicts.length}`,
          summary: result.summary,
        },
      }),
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return createHandlerErrorResult({
      tool: "memory_reindex",
      readOnly: false,
      projectRoot:
        typeof args === "object" &&
        args !== null &&
        "projectRoot" in args &&
        typeof (args as { projectRoot?: unknown }).projectRoot === "string"
          ? (args as { projectRoot: string }).projectRoot
          : "",
      code: "memory_reindex_failed",
      message: `Error: ${msg}`,
    });
  }
}

/** memory_deps 工具參數驗證 Schema */
export const memoryDepsSchema = z.object({
  moduleName: moduleNameSchema,
  projectRoot: projectRootField,
});

/**
 * memory_deps — 查詢卡匣依賴拓樸（v4.1 完整實作）
 */
export async function handleMemoryDeps(args: unknown): Promise<McpToolResult> {
  const parsed = memoryDepsSchema.safeParse(args);
  if (!parsed.success) {
    return toMcpTextResult(
      createToolErrorEnvelope({
        tool: "memory_deps",
        projectRoot: "",
        code: "validation_error",
        message:
          "Validation Error: moduleName and projectRoot are required (projectRoot must be absolute path without ..)",
      }),
    );
  }

  const { moduleName, projectRoot } = parsed.data;

  try {
    const normalizedPath = validateProjectRoot(projectRoot);

    // 動態匯入避免頂層循環依賴
    const { createConfig } = await import("./config.js");
    const { CartridgeIndexManager } = await import("./index-manager.js");

    const config = createConfig(normalizedPath);
    const manager = new CartridgeIndexManager(config);
    await manager.load();
    await manager.scan();

    const index = manager.getIndex();
    const entry = index.cartridges[moduleName];
    if (!entry) {
      return toMcpTextResult(
        createToolErrorEnvelope({
          tool: "memory_deps",
          projectRoot: normalizedPath,
          code: "module_not_found",
          message: `Error: Module "${moduleName}" not found in index`,
        }),
      );
    }

    if (entry.mainFile?.type === "conflict") {
      return createMemoryMainConflictResult({ tool: "memory_deps", readOnly: true,
        projectRoot: normalizedPath, moduleName, candidates: entry.mainFile.candidatePaths });
    }

    // Preserve the public engineering lens and expose the actual propagation
    // graph separately so declarations never masquerade as source imports.
    const {
      buildDependencyGraph,
      buildReverseDependencyGraph,
      buildPropagationGraph,
      detectCycles,
    } = await import("./dependency-propagator.js");
    const graph = buildDependencyGraph(index, normalizedPath);
    const reverseGraph = buildReverseDependencyGraph(graph);

    const dependencies = graph.get(moduleName) ?? [];
    const dependents = reverseGraph.get(moduleName) ?? [];
    let frontmatterDependencies: string[] = [];
    let declarationReadWarning: string | null = null;
    try {
      const dependencyMainPath = entry.mainFile?.activePath ?? entry.skillPath;
      const rawSkill = await fs.readFile(
        assertPathInsideProject(normalizedPath, dependencyMainPath),
        "utf-8",
      );
      const { data } = matter(rawSkill);
      frontmatterDependencies = normalizeDeclaredDependencies(data.dependencies);
    } catch (error) {
      frontmatterDependencies = entry.declaredDependencies ?? [];
      declarationReadWarning = `Cannot verify current dependency declarations: ${error instanceof Error ? error.message : String(error)}`;
    }
    const { propagationGraph, diagnostics: propagationDiagnostics } =
      buildPropagationGraph(index, graph, new Map([[moduleName, frontmatterDependencies]]));
    const propagationReverse = buildReverseDependencyGraph(propagationGraph);
    const cycles = detectCycles(propagationGraph).filter((c: string[]) =>
      c.includes(moduleName),
    );
    const findings: CartridgeFinding[] = [
      ...(declarationReadWarning ? [{ severity: "warning" as const, code: "DEPENDENCY_DECLARATIONS_UNVERIFIED", message: declarationReadWarning }] : []),
      ...propagationDiagnostics.filter((item) => item.module === moduleName)
        .map((item) => ({ severity: "warning" as const, code: item.code, message: item.message })),
      ...(entry.dependencySyncWarning ? [{ severity: "warning" as const,
        code: "DERIVED_SYNC_PARTIAL", message: entry.dependencySyncWarning }] : []),
      ...(cycles.length > 0
        ? [
            {
              severity: "warning" as const,
              code: "dependency_cycle_detected",
              message: `偵測到 ${cycles.length} 組循環依賴`,
            },
          ]
        : []),
      ...((entry.indirectStaleness ?? 0) > 0
        ? [
            {
              severity: "warning" as const,
              code: "indirect_staleness",
              message: `上游依賴傳播間接過期指數 ${entry.indirectStaleness ?? 0}`,
            },
          ]
        : []),
    ];
    const recommendedActions =
      findings.length > 0
        ? findings.map((finding) => ({
            priority: "P2",
            action:
              finding.code === "dependency_cycle_detected"
                ? "review_dependency_cycles"
                : "review_upstream_staleness",
            target: moduleName,
            reason: finding.message,
          }))
        : [];
    const status: CartridgeToolStatus =
      findings.length > 0 ? "warning" : "ready";

    const summary = {
      module: moduleName,
      graph: {
        engineering: {
          dependencies,
          dependents,
          dependencyCount: dependencies.length,
          dependentCount: dependents.length,
        },
        frontmatter: {
          dependencies: frontmatterDependencies,
          dependencyCount: frontmatterDependencies.length,
        },
        propagation: {
          dependencies: propagationGraph.get(moduleName) ?? [],
          dependents: propagationReverse.get(moduleName) ?? [],
          sources: ["engineering", "frontmatter"],
          excludes: ["Relations", "Applicable Skills", "parent-child navigation"],
        },
      },
      staleness: {
        direct: entry.staleness ?? 0,
        indirect: entry.indirectStaleness ?? 0,
      },
      cycles: {
        count: cycles.length,
        paths: cycles,
      },
    };
    const legacy = {
      module: moduleName,
      summary: {
        status,
        engineeringDependencies: dependencies.length,
        engineeringDependents: dependents.length,
        frontmatterDependencies: frontmatterDependencies.length,
        indirectStaleness: entry.indirectStaleness ?? 0,
        cycleCount: cycles.length,
      },
      engineeringGraph: {
        dependencies,
        dependents,
      },
      frontmatterGraph: {
        dependencies: frontmatterDependencies,
      },
      staleness: {
        direct: entry.staleness ?? 0,
        indirect: entry.indirectStaleness ?? 0,
      },
      findings,
      dependencies,
      dependents,
      indirectStaleness: entry.indirectStaleness ?? 0,
      cycles: cycles.length > 0 ? cycles : undefined,
      cycleWarning:
        cycles.length > 0
          ? `⚠️ 偵測到循環依賴：${cycles.map((c: string[]) => c.join(" → ")).join("; ")}`
          : undefined,
    };

    return toMcpTextResult(
      createToolEnvelope({
        tool: "memory_deps",
        readOnly: true,
        projectRoot: normalizedPath,
        status,
        summary,
        findings,
        recommendedActions,
        legacy,
      }),
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return toMcpTextResult(
      createToolErrorEnvelope({
        tool: "memory_deps",
        projectRoot,
        code: "memory_deps_failed",
        message: `Error: ${msg}`,
      }),
    );
  }
}
