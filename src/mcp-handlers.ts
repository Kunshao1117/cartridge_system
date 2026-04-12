/**
 * 記憶卡匣外掛系統 — MCP 工具商業邏輯層
 * 將各工具的純商業邏輯從 MCP SDK 解耦，便於單元測試
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as z from "zod";
import matter from "gray-matter";
import { validateProjectRoot } from "./path-guard.js";
import { getTaiwanISO } from "./timestamp.js";
import { parseTrackedFiles } from "./index-manager.js";

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

/** 過期等級閾值（預設值，與 Extension 的 CartridgeConfig 解耦） */
const STALENESS_THRESHOLDS = { significant: 10, critical: 30 };

/** 過期指數轉換為人類可讀等級（輕量版，不依賴 CartridgeConfig） */
export function stalenessToLevel(staleness: number): string {
  if (staleness <= 0) return "healthy";
  if (staleness < STALENESS_THRESHOLDS.significant) return "mild";
  if (staleness < STALENESS_THRESHOLDS.critical) return "significant";
  return "critical";
}

/** MCP 工具回傳結構（純資料結構，與 MCP SDK 相容但不依賴其型別） */
export interface McpToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
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

/** memory_update 工具參數驗證 Schema */
export const memoryUpdateSchema = z.object({
  moduleName: z.string().min(1),
  content: z.string().min(1),
  parentModule: z.string().optional(),
  projectRoot: projectRootField,
});

/** memory_commit 工具參數驗證 Schema */
export const memoryCommitSchema = z.object({
  moduleName: z.string().min(1),
  projectRoot: projectRootField,
});

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
    return {
      content: [
        {
          type: "text",
          text: "Validation Error: projectRoot is required (must be absolute path without ..)",
        },
      ],
      isError: true,
    };
  }

  // 路徑安全二次驗證
  try {
    validateProjectRoot(parsed.data.projectRoot);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      content: [{ type: "text", text: `Path Validation Error: ${msg}` }],
      isError: true,
    };
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
          splitSuggestion:
            trackedCount > 8
              ? `此模組追蹤了 ${trackedCount} 個檔案，建議考慮拆分為子模組以提升維護性。`
              : null,
        };
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                cartridges: enriched,
                untrackedFiles: index.untrackedFiles ?? [],
              },
              null,
              2,
            ),
          },
        ],
      };
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
      return {
        content: [
          { type: "text", text: `Available memories:\n${modules.join("\n")}` },
        ],
      };
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      content: [{ type: "text", text: `Error: ${msg}` }],
      isError: true,
    };
  }
}

/**
 * memory_read — 讀取指定記憶卡匣的 SKILL.md 內容
 */
export async function handleMemoryRead(args: unknown): Promise<McpToolResult> {
  const parsed = memoryReadSchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [
        {
          type: "text",
          text: "Validation Error: moduleName and projectRoot are required (projectRoot must be absolute path without ..)",
        },
      ],
      isError: true,
    };
  }

  // 路徑安全二次驗證
  try {
    validateProjectRoot(parsed.data.projectRoot);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      content: [{ type: "text", text: `Path Validation Error: ${msg}` }],
      isError: true,
    };
  }

  try {
    const filePath = await resolveSkillPath(
      parsed.data.projectRoot,
      parsed.data.moduleName,
    );
    if (!filePath) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Module "${parsed.data.moduleName}" not found. Searched: index → flat path → recursive scan.`,
          },
        ],
        isError: true,
      };
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
    return { content: [{ type: "text", text: content + parentHint }] };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      content: [{ type: "text", text: `Error: ${msg}` }],
      isError: true,
    };
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
    return {
      content: [
        {
          type: "text",
          text: "Validation Error: moduleName and projectRoot are required (projectRoot must be absolute path without ..)",
        },
      ],
      isError: true,
    };
  }

  // 路徑安全二次驗證
  try {
    validateProjectRoot(parsed.data.projectRoot);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      content: [{ type: "text", text: `Path Validation Error: ${msg}` }],
      isError: true,
    };
  }

  const { moduleName, projectRoot } = parsed.data;
  const indexPath = path.join(projectRoot, ".cartridge", "index.json");

  // 嘗試從索引檔讀取完整資訊
  try {
    const indexRaw = await fs.readFile(indexPath, "utf-8");
    const index = JSON.parse(indexRaw);
    const entry = index.cartridges?.[moduleName];

    if (!entry) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Module "${moduleName}" not found in cartridge index.`,
          },
        ],
        isError: true,
      };
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

    const status = {
      module: moduleName,
      staleness: entry.staleness ?? 0,
      level,
      lastUpdated: entry.lastUpdated ?? "",
      trackedFiles: entry.trackedFiles ?? [],
      pendingChanges,
      actionRequired,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
    };
  } catch {
    // 索引檔不存在 — 回退到讀取 SKILL.md frontmatter
    try {
      const filePath = await resolveSkillPath(projectRoot, moduleName);
      if (!filePath) {
        return {
          content: [
            { type: "text", text: `Error: Module "${moduleName}" not found.` },
          ],
          isError: true,
        };
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

      return {
        content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        content: [{ type: "text", text: `Error: ${msg}` }],
        isError: true,
      };
    }
  }
}

/**
 * memory_update — 更新指定記憶卡匣的 SKILL.md，自動更新時間戳記與 staleness
 *
 * 整張替換：用 content 替換完整 SKILL.md
 * ⚠️ 建議使用 write_to_file → memory_commit 的新流程
 */
export async function handleMemoryUpdate(
  args: unknown,
): Promise<McpToolResult> {
  const parsed = memoryUpdateSchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [
        {
          type: "text",
          text: "Validation Error: moduleName, content and projectRoot are required (projectRoot must be absolute path without ..)",
        },
      ],
      isError: true,
    };
  }

  // 路徑安全二次驗證
  try {
    validateProjectRoot(parsed.data.projectRoot);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      content: [{ type: "text", text: `Path Validation Error: ${msg}` }],
      isError: true,
    };
  }

  try {
    const isoLocal = getTaiwanISO();
    const resolvedPath = await resolveSkillPath(
      parsed.data.projectRoot,
      parsed.data.moduleName,
    );
    // 決定檔案路徑：已存在 → 巢狀新建 → 根層新建
    let filePath: string;
    if (resolvedPath) {
      filePath = resolvedPath;
    } else if (parsed.data.parentModule) {
      // 巢狀建立：放到父卡目錄下
      const parentPath = await resolveSkillPath(
        parsed.data.projectRoot,
        parsed.data.parentModule,
      );
      const parentDir = parentPath
        ? path.dirname(parentPath)
        : path.join(
            parsed.data.projectRoot,
            ".agents",
            "skills",
            parsed.data.parentModule,
          );
      filePath = path.join(parentDir, parsed.data.moduleName, "SKILL.md");
    } else {
      // 根層建立（v4.0：建在 memory/ 目錄下）
      filePath = path.join(
        parsed.data.projectRoot,
        ".agents",
        "memory",
        parsed.data.moduleName,
        "SKILL.md",
      );
    }

    // 整張替換寫入（修復 #4：清除殘留的警報區塊）
    let finalContent = updateFrontmatterFields(parsed.data.content, {
      last_updated: isoLocal,
      staleness: 0,
    });
    const { data: fm, content: bd } = matter(finalContent);
    fm.status = "stable";
    finalContent = matter.stringify(stripWarningBlock(bd), fm);

    await fs.writeFile(filePath, finalContent, "utf-8");

    // 清除索引檔中對應模組的 pendingChanges（graceful，失敗不影響更新結果）
    try {
      const indexPath = path.join(
        parsed.data.projectRoot,
        ".cartridge",
        "index.json",
      );
      const indexRaw = await fs.readFile(indexPath, "utf-8");
      const index = JSON.parse(indexRaw);
      if (index.cartridges?.[parsed.data.moduleName]) {
        index.cartridges[parsed.data.moduleName].pendingChanges = [];
        index.cartridges[parsed.data.moduleName].staleness = 0;
        await fs.writeFile(indexPath, JSON.stringify(index, null, 2), "utf-8");
      }
    } catch {
      // 索引檔不存在或讀寫失敗 — 靜默忽略，不影響更新結果
    }

    return {
      content: [
        {
          type: "text",
          text: `Successfully updated ${parsed.data.moduleName}`,
        },
      ],
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      content: [{ type: "text", text: `Error: ${msg}` }],
      isError: true,
    };
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
 * memory_commit — 後設資料同步工具
 * 在 AI 用原生工具寫入 SKILL.md 後呼叫，負責：
 * 1. 時間戳注入（台灣時區）
 * 2. staleness 歸零
 * 3. 索引同步（pendingChanges 清除 + trackedFiles 重新解析）
 * 4. 結構驗證（frontmatter 欄位 + 必要區段檢查）
 */
export async function handleMemoryCommit(
  args: unknown,
): Promise<McpToolResult> {
  const parsed = memoryCommitSchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [
        {
          type: "text",
          text: "Validation Error: moduleName and projectRoot are required (projectRoot must be absolute path without ..)",
        },
      ],
      isError: true,
    };
  }

  // 路徑安全二次驗證
  try {
    validateProjectRoot(parsed.data.projectRoot);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      content: [{ type: "text", text: `Path Validation Error: ${msg}` }],
      isError: true,
    };
  }

  try {
    const { moduleName, projectRoot } = parsed.data;
    const isoLocal = getTaiwanISO();

    // 1. 路徑解析
    const filePath = await resolveSkillPath(projectRoot, moduleName);
    if (!filePath) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Module "${moduleName}" not found. Please ensure the SKILL.md file exists before calling memory_commit.`,
          },
        ],
        isError: true,
      };
    }

    // 2. 讀取已寫入的 SKILL.md
    const rawContent = await fs.readFile(filePath, "utf-8");

    // 3. 結構驗證
    const warnings: string[] = [];
    const { data: frontmatter, content: body } = matter(rawContent);
    if (!frontmatter.name) warnings.push("frontmatter 缺少 name 欄位");
    if (!frontmatter.description)
      warnings.push("frontmatter 缺少 description 欄位");
    if (!body.includes("## Tracked Files"))
      warnings.push("body 缺少 ## Tracked Files 區段");
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
      const indexRaw = await fs.readFile(indexPath, "utf-8");
      const index = JSON.parse(indexRaw);
      if (index.cartridges?.[moduleName]) {
        // 清除 pendingChanges + staleness
        index.cartridges[moduleName].pendingChanges = [];
        index.cartridges[moduleName].staleness = 0;
        index.cartridges[moduleName].lastUpdated = isoLocal;

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

    return {
      content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      content: [{ type: "text", text: `Error: ${msg}` }],
      isError: true,
    };
  }
}
