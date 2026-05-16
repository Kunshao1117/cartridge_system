/**
 * 記憶卡匣外掛系統 — MCP 工具商業邏輯層
 * 將各工具的純商業邏輯從 MCP SDK 解耦，便於單元測試
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as z from "zod";
import matter from "gray-matter";
import {
  formatDependencySemanticWarning,
  validateDependencySemantics,
} from "./dependency-semantics.js";
import { validateProjectRoot } from "./path-guard.js";
import { stalenessToLevel } from "./staleness.js";
import { getTaiwanISO } from "./timestamp.js";
import { parseTrackedFiles } from "./index-manager.js";
import type { CartridgeIndex } from "./types.js";
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

/** memory_list 工具參數驗證 Schema */
export const memoryListSchema = z.object({
  projectRoot: projectRootField,
});

/** memory_read 工具參數驗證 Schema */
export const memoryReadSchema = z.object({
  moduleName: z.string().min(1),
  projectRoot: projectRootField,
});

/** memory_status 工具參數驗證 Schema */
export const memoryStatusSchema = z.object({
  moduleName: z.string().min(1),
  projectRoot: projectRootField,
});

/** memory_commit 工具參數驗證 Schema */
export const memoryCommitSchema = z.object({
  moduleName: z.string().min(1),
  projectRoot: projectRootField,
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

/**
 * 使用 gray-matter 結構化更新 frontmatter 欄位
 * 取代易碎的正則替換，完整支援單引號、雙引號、無引號格式
 */
export function updateFrontmatterFields(
  rawContent: string,
  updates: Record<string, unknown>,
): string {
  const { data: frontmatter, content } = matter(rawContent);

  // 合併更新欄位
  for (const [key, value] of Object.entries(updates)) {
    frontmatter[key] = value;
  }

  return matter.stringify(content, frontmatter);
}

/**
 * 共用路徑解析函式：將模組名稱解析為 SKILL.md 絕對路徑
 * 三層策略確保向後相容：索引查找 → 平面回退（memory → skills）→ 遞迴搜尋
 */
export async function resolveSkillPath(
  projectRoot: string,
  moduleName: string,
): Promise<string | null> {
  // 策略 1：從索引查找（最快）
  const indexPath = path.join(projectRoot, ".cartridge", "index.json");
  try {
    const raw = await fs.readFile(indexPath, "utf-8");
    const index = JSON.parse(raw);
    const entry = index.cartridges?.[moduleName];
    if (entry?.skillPath) {
      const resolved = path.join(projectRoot, entry.skillPath);
      try {
        await fs.access(resolved);
        return resolved;
      } catch {
        /* 索引記錄的路徑不存在，繼續嘗試 */
      }
    }
  } catch {
    /* 索引不存在 */
  }

  // 策略 2a：新路徑平面回退（v4.0 memory/ 目錄）
  const memoryPath = path.join(
    projectRoot,
    ".agents",
    "memory",
    moduleName,
    "SKILL.md",
  );
  try {
    await fs.access(memoryPath);
    return memoryPath;
  } catch {
    /* 不存在 */
  }

  // 策略 2b：舊路徑平面回退（向後相容 skills/ 目錄）
  const flatPath = path.join(
    projectRoot,
    ".agents",
    "skills",
    moduleName,
    "SKILL.md",
  );
  try {
    await fs.access(flatPath);
    return flatPath;
  } catch {
    /* 不存在 */
  }

  // 策略 3a：遞迴搜尋 memory/ 目錄（無 mem- 前綴限制）
  const fromMemory = await findSkillRecursive(
    path.join(projectRoot, ".agents", "memory"),
    moduleName,
    1,
    false,
  );
  if (fromMemory) return fromMemory;

  // 策略 3b：遞迴搜尋 skills/ 目錄（向後相容，保留 mem- 過濾）
  return findSkillRecursive(
    path.join(projectRoot, ".agents", "skills"),
    moduleName,
    1,
    true,
  );
}

/**
 * 遞迴搜尋巢狀目錄中的 SKILL.md
 * @param requireMemPrefix - true: 只掃描 mem-* 目錄；false: 掃描所有目錄
 */
async function findSkillRecursive(
  dir: string,
  moduleName: string,
  depth: number,
  requireMemPrefix: boolean,
): Promise<string | null> {
  if (depth > 4) return null;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (requireMemPrefix && !entry.name.startsWith("mem-")) continue;
      if (!requireMemPrefix && entry.name.startsWith(".")) continue;
      if (entry.name === moduleName) {
        const candidate = path.join(dir, entry.name, "SKILL.md");
        try {
          await fs.access(candidate);
          return candidate;
        } catch {
          continue;
        }
      }
      // 遞迴搜尋子目錄
      const found = await findSkillRecursive(
        path.join(dir, entry.name),
        moduleName,
        depth + 1,
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

  const agentsDir = path.join(parsed.data.projectRoot, ".agents", "memory");
  try {
    // 優先從索引檔讀取全部卡匣（含巢狀子卡）
    const indexPath = path.join(
      parsed.data.projectRoot,
      ".cartridge",
      "index.json",
    );
    try {
      const indexRaw = await fs.readFile(indexPath, "utf-8");
      const index = JSON.parse(indexRaw);
      const cartridges = index.cartridges ?? {};
      const modules = Object.keys(cartridges);

      const enriched = modules.map((mod) => {
        const entry = cartridges[mod];
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
          splitSuggestion:
            trackedCount > 8
              ? `此模組追蹤了 ${trackedCount} 個檔案，建議考慮拆分為子模組以提升維護性。`
              : null,
        };
      });

      const legacy = {
        cartridges: enriched,
        untrackedFiles: index.untrackedFiles ?? [],
      };
      return toMcpTextResult(
        createToolEnvelope({
          tool: "memory_list",
          readOnly: true,
          projectRoot: parsed.data.projectRoot,
          status: "ready",
          summary: {
            cartridgeCount: enriched.length,
            cartridges: enriched,
            untrackedFiles: index.untrackedFiles ?? [],
          },
          legacy,
        }),
      );
    } catch {
      // 索引不存在 — 回退到目錄掃描（先掃 memory/，再掃 skills/mem-*）
      const modules: string[] = [];
      try {
        const files = await fs.readdir(agentsDir, { withFileTypes: true });
        modules.push(
          ...files
            .filter((d) => d.isDirectory() && !d.name.startsWith("."))
            .map((d) => d.name),
        );
      } catch {
        /* memory/ 不存在 */
      }
      // 向後相容：掃描 skills/mem-*
      try {
        const skillsDir = path.join(
          parsed.data.projectRoot,
          ".agents",
          "skills",
        );
        const skillFiles = await fs.readdir(skillsDir, { withFileTypes: true });
        for (const d of skillFiles) {
          if (
            d.isDirectory() &&
            d.name.startsWith("mem-") &&
            !modules.includes(d.name)
          ) {
            modules.push(d.name);
          }
        }
      } catch {
        /* skills/ 不存在 */
      }
      const text = `Available memories:\n${modules.join("\n")}`;
      return toMcpTextResult(
        createToolEnvelope({
          tool: "memory_list",
          readOnly: true,
          projectRoot: parsed.data.projectRoot,
          status: "ready",
          summary: {
            cartridgeCount: modules.length,
            cartridges: modules.map((module) => ({ module })),
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
    const filePath = await resolveSkillPath(
      parsed.data.projectRoot,
      parsed.data.moduleName,
    );
    if (!filePath) {
      return createHandlerErrorResult({
        tool: "memory_read",
        readOnly: true,
        projectRoot: parsed.data.projectRoot,
        code: "module_not_found",
        message: `Error: Module "${parsed.data.moduleName}" not found. Searched: index → flat path → recursive scan.`,
      });
    }
    const content = await fs.readFile(filePath, "utf-8");

    // 嘗試從索引取得父子關係提示
    let parentHint = "";
    try {
      const indexPath = path.join(
        parsed.data.projectRoot,
        ".cartridge",
        "index.json",
      );
      const indexRaw = await fs.readFile(indexPath, "utf-8");
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
        status: "ready",
        summary: {
          module: parsed.data.moduleName,
          skillPath: path.relative(parsed.data.projectRoot, filePath),
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
    const indexRaw = await fs.readFile(indexPath, "utf-8");
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
      actionRequired = `此記憶卡已過期。更新前請先使用 view_file 讀取以下異動檔案：\n${fileList}\n讀取後再呼叫 memory_update 根據最新原始碼更新記憶內容。`;
    } else if (entry.staleness > 0) {
      actionRequired = `此記憶卡已過期（staleness: ${entry.staleness}），但無已記錄的異動檔案。請手動檢查追蹤檔案清單中的原始碼。`;
    }

    // 幽靈檔案行動指引
    const ghostFiles: string[] = entry.ghostFiles ?? [];
    if (ghostFiles.length > 0) {
      const ghostList = ghostFiles.map((g: string) => `- ${g}`).join("\n");
      actionRequired += actionRequired
        ? `\n\n此外，以下追蹤檔案已不存在於磁碟（幽靈檔案）：\n${ghostList}\n請從 ## Tracked Files 中移除這些路徑。`
        : `以下追蹤檔案已不存在於磁碟（幽靈檔案）：\n${ghostList}\n請從 ## Tracked Files 中移除這些路徑，然後呼叫 memory_commit。`;
    }

    const status = {
      module: moduleName,
      staleness: entry.staleness ?? 0,
      level,
      lastUpdated: entry.lastUpdated ?? "",
      trackedFiles: entry.trackedFiles ?? [],
      pendingChanges,
      ghostFiles,
      actionRequired,
    };

    return toMcpTextResult(
      createToolEnvelope({
        tool: "memory_status",
        readOnly: true,
        projectRoot,
        status: entry.staleness > 0 || ghostFiles.length > 0 ? "warning" : "ready",
        summary: status,
        findings: [
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
      const filePath = await resolveSkillPath(projectRoot, moduleName);
      if (!filePath) {
        return createHandlerErrorResult({
          tool: "memory_status",
          readOnly: true,
          projectRoot,
          code: "module_not_found",
          message: `Error: Module "${moduleName}" not found.`,
        });
      }
      const raw = await fs.readFile(filePath, "utf-8");
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
        actionRequired:
          staleness > 0
            ? `此記憶卡已過期（staleness: ${staleness}）。索引檔不存在，無法提供異動檔案清單。請手動檢查追蹤檔案清單中的原始碼。`
            : "",
        _note:
          "索引檔不存在，過期資訊來自 SKILL.md frontmatter。pendingChanges 和 trackedFiles 無法提供。",
      };

      return toMcpTextResult(
        createToolEnvelope({
          tool: "memory_status",
          readOnly: true,
          projectRoot,
          status: staleness > 0 ? "warning" : "ready",
          summary: status,
          findings:
            staleness > 0
              ? [
                  {
                    severity: "warning",
                    code: "memory_stale",
                    message: `Module ${moduleName} has staleness ${staleness}.`,
                  },
                ]
              : [],
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
        "Validation Error: moduleName and projectRoot are required (projectRoot must be absolute path without ..)",
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
    const filePath = await resolveSkillPath(projectRoot, moduleName);
    if (!filePath) {
      return createHandlerErrorResult({
        tool: "memory_commit",
        readOnly: false,
        projectRoot,
        code: "module_not_found",
        message: `Error: Module "${moduleName}" not found. Please ensure the SKILL.md file exists before calling memory_commit.`,
      });
    }

    // 2. 讀取已寫入的 SKILL.md
    const rawContent = await fs.readFile(filePath, "utf-8");

    // 3. 結構驗證
    const warnings: string[] = [];
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
        await fs.readFile(indexPath, "utf-8"),
      ) as CartridgeIndex;
    } catch {
      indexForCommit = null;
    }

    const cartridgeEntry = indexForCommit?.cartridges[moduleName];
    const dependencies = Array.isArray(frontmatter.dependencies)
      ? frontmatter.dependencies.filter(
          (dependency): dependency is string =>
            typeof dependency === "string" && dependency.trim().length > 0,
        )
      : [];
    warnings.push(
      ...validateDependencySemantics({
        moduleName,
        dependencies,
        body,
        parent: cartridgeEntry?.parent ?? null,
      }).map(formatDependencySemanticWarning),
    );

    // 4. 時間戳注入 + staleness 歸零 + 清除殘留警報區塊（修復 #4）
    let updatedContent = updateFrontmatterFields(rawContent, {
      last_updated: isoLocal,
      staleness: 0,
    });
    const { data: commitFm, content: commitBody } = matter(updatedContent);
    commitFm.status = "stable";
    updatedContent = matter.stringify(stripWarningBlock(commitBody), commitFm);
    await fs.writeFile(filePath, updatedContent, "utf-8");

    // 5. 索引同步（graceful，失敗不影響主流程）
    let trackedFilesCount = 0;
    try {
      const indexPath = path.join(projectRoot, ".cartridge", "index.json");
      const index =
        indexForCommit ??
        (JSON.parse(await fs.readFile(indexPath, "utf-8")) as CartridgeIndex);
      if (index.cartridges?.[moduleName]) {
        // 清除 pendingChanges + staleness
        index.cartridges[moduleName].pendingChanges = [];
        index.cartridges[moduleName].staleness = 0;
        index.cartridges[moduleName].lastUpdated = isoLocal;
        index.cartridges[moduleName].ghostFiles = [];

        // 重新解析 trackedFiles
        const trackedFiles = parseTrackedFiles(body);
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

        index.untrackedFiles = (index.untrackedFiles ?? []).filter(
          (entry) => !trackedFiles.includes(entry.filePath),
        );

        for (const cartridge of Object.values(index.cartridges)) {
          cartridge.indirectStaleness = 0;
        }
        try {
          const { buildDependencyGraph, propagateStaleness } = await import(
            "./dependency-propagator.js"
          );
          const graph = buildDependencyGraph(index, projectRoot);
          const propagated = propagateStaleness(index, graph, 2);
          for (const [cartridgeId, indirectStaleness] of propagated.entries()) {
            if (index.cartridges[cartridgeId]) {
              index.cartridges[cartridgeId].indirectStaleness =
                indirectStaleness;
            }
          }
        } catch {
          /* 依賴重算失敗不應阻止核心索引同步 */
        }

        await fs.writeFile(indexPath, JSON.stringify(index, null, 2), "utf-8");
      }
    } catch {
      // 索引檔不存在或讀寫失敗 — 靜默忽略
    }

    // 6. 回傳結構化報告
    const report: CommitReport = {
      status: "success",
      module: moduleName,
      trackedFilesCount,
      warnings,
    };

    return toMcpTextResult(
      createToolEnvelope({
        tool: "memory_commit",
        readOnly: false,
        projectRoot,
        status: warnings.length > 0 ? "warning" : "ready",
        summary: { ...report },
        findings: warnings.map((warning) => ({
          severity: "warning",
          code: "memory_commit_warning",
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

/** memory_deps 工具參數驗證 Schema */
export const memoryDepsSchema = z.object({
  moduleName: z.string().min(1),
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

    // 建構依賴圖
    const {
      buildDependencyGraph,
      buildReverseDependencyGraph,
      detectCycles,
    } = await import("./dependency-propagator.js");
    const graph = buildDependencyGraph(index, normalizedPath);
    const reverseGraph = buildReverseDependencyGraph(graph);

    const dependencies = graph.get(moduleName) ?? [];
    const dependents = reverseGraph.get(moduleName) ?? [];
    let frontmatterDependencies: string[] = [];
    try {
      const rawSkill = await fs.readFile(
        path.join(normalizedPath, entry.skillPath),
        "utf-8",
      );
      const { data } = matter(rawSkill);
      frontmatterDependencies = Array.isArray(data.dependencies)
        ? data.dependencies.filter(
            (dependency): dependency is string =>
              typeof dependency === "string" && dependency.trim().length > 0,
          )
        : [];
    } catch {
      frontmatterDependencies = entry.dependencies ?? [];
    }
    const cycles = detectCycles(graph).filter((c: string[]) =>
      c.includes(moduleName),
    );
    const findings: CartridgeFinding[] = [
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
