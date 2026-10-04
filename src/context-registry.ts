import { assertPathInsideProject, PathContainmentError } from "./file-containment.js";
import * as fs from "fs/promises";
import * as path from "path";
import {
  buildSkillContextAsset,
  collectContextSignals,
  readContextText,
  staticContextAssets,
  summarizeContextAssets,
} from "./context-contract.js";
import type { ContextAsset, ContextInventory, ContextOwner } from "./context-types.js";
import type { CartridgeConfig } from "./types.js";
import { MAX_SCAN_DEPTH } from "./index-manager.js";
import {
  analyzeMemoryContentQuality,
  resolveMemoryMainFileInDirectory,
} from "./memory-main-file.js";

function contextId(relativeDirectory: string): string {
  return relativeDirectory.replace(/\\/g, "/").replace(/[/.]/g, ".").replace(/^\.+/, "");
}

function diagnosticContextAsset(
  args: Omit<Parameters<typeof buildSkillContextAsset>[0], "content">,
  signal: "context:parse-error" | "context:read-error",
): ContextAsset {
  return {
    id: args.id,
    type: args.owner === "cartridge" ? "memory" : "skill",
    path: args.relativePath,
    exists: true,
    owner: args.owner,
    scope: args.owner === "cartridge" ? "module" : "directory",
    priority: args.priority,
    supportedAgents: args.owner === "cartridge" ? ["cartridge-system"] : [args.owner],
    trackedFiles: [],
    dependencies: [],
    staleness: 0,
    risk: "high",
    signals: [signal],
  };
}

function buildDiagnosedContextAsset(args: Parameters<typeof buildSkillContextAsset>[0]): ContextAsset {
  try {
    return buildSkillContextAsset(args);
  } catch (error) {
    if (error instanceof PathContainmentError) throw error;
    // Failed parsing cannot contribute declarations or policy signals.
    return diagnosticContextAsset(args, "context:parse-error");
  }
}

async function scanSkillDir(args: {
  projectRoot: string;
  relativeDir: string;
  owner: ContextOwner;
  priority: number;
  maxDepth: number;
  excludeLegacyMemory?: boolean;
}): Promise<ContextAsset[]> {
  const results: ContextAsset[] = [];
  const root = assertPathInsideProject(args.projectRoot, args.relativeDir);
  async function walk(current: string, depth: number) {
    if (depth > args.maxDepth) return;
    let entries: Array<{ name: string; isDirectory: () => boolean }>;
    try {
      entries = await fs.readdir(assertPathInsideProject(args.projectRoot, current), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      if (depth === 1 && args.excludeLegacyMemory && entry.name.startsWith("mem-")) continue;
      const dir = path.join(current, entry.name);
      const skillPath = path.join(dir, "SKILL.md");
      const relativePath = path.relative(args.projectRoot, skillPath);
      const common = {
        id: contextId(path.dirname(relativePath)),
        relativePath,
        owner: args.owner,
        priority: args.priority,
      };
      const content = await readContextText(args.projectRoot, skillPath);
      if (content !== null) {
        results.push(buildDiagnosedContextAsset({ ...common, content }));
      } else {
        // A known file that failed to read must not silently disappear. Ordinary
        // directories without SKILL.md are still just containers.
        try {
          if ((await fs.stat(assertPathInsideProject(args.projectRoot, skillPath))).isFile()) {
            results.push(diagnosticContextAsset(common, "context:read-error"));
          }
        } catch (error) {
          if (error instanceof PathContainmentError) throw error;
        }
      }
      await walk(dir, depth + 1);
    }
  }
  await walk(root, 1);
  return results;
}

/** Memory roots have their own main-file contract; true skills remain SKILL.md. */
async function scanMemoryDir(args: {
  projectRoot: string;
  relativeDir: string;
  requireMemPrefix?: boolean;
}): Promise<ContextAsset[]> {
  const root = assertPathInsideProject(args.projectRoot, args.relativeDir);

  async function walk(current: string, depth: number): Promise<ContextAsset[]> {
    if (depth > MAX_SCAN_DEPTH) return [];
    // Dirent traversal intentionally does not follow directory symlinks.
    let directories: Array<{ name: string; isDirectory: () => boolean }>;
    try {
      directories = await fs.readdir(assertPathInsideProject(args.projectRoot, current), { withFileTypes: true });
    } catch {
      return [];
    }
    const assets: ContextAsset[] = [];
    for (const entry of directories) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name.toLowerCase() === "archive") continue;
      if (depth === 1 && args.requireMemPrefix && !entry.name.startsWith("mem-")) continue;
      const cardDir = path.join(current, entry.name);
      // Explicit errors for unsafe main-file links must not become a missing card.
      assertPathInsideProject(args.projectRoot, path.join(cardDir, "MEMORY.md"));
      assertPathInsideProject(args.projectRoot, path.join(cardDir, "SKILL.md"));
      const resolution = await resolveMemoryMainFileInDirectory(args.projectRoot, cardDir);
      const children = await walk(cardDir, depth + 1);
      const mainFile = resolution.mainFile;
      if (mainFile.type === "missing" && children.length === 0) continue;
      const raw = mainFile.activePath
        ? await readContextText(args.projectRoot, mainFile.activePath)
        : null;
      const contentQuality = analyzeMemoryContentQuality(raw, mainFile);
      const relativeDirectory = resolution.relativeDirectory;
      const common = {
        id: contextId(relativeDirectory),
        owner: "cartridge" as const,
        priority: 60,
      };
      // Conflicts expose both candidates without reading either one as truth.
      const asset: ContextAsset = mainFile.activePath
        ? raw !== null
          ? buildDiagnosedContextAsset({ ...common, relativePath: mainFile.activePath, content: raw })
          : diagnosticContextAsset({ ...common, relativePath: mainFile.activePath }, "context:read-error")
        : {
          ...common,
          type: "memory",
          path: relativeDirectory,
          exists: mainFile.type !== "missing",
          scope: "module",
          supportedAgents: ["cartridge-system"],
          trackedFiles: [],
          dependencies: [],
          staleness: 0,
          risk: "high",
          signals: [`memory:main-file-${mainFile.type}`],
        };
      assets.push({ ...asset, mainFile, contentQuality }, ...children);
    }
    return assets;
  }
  return walk(root, 1);
}

async function scanClaudeAgents(projectRoot: string): Promise<ContextAsset[]> {
  const dir = path.join(projectRoot, ".claude", "agents");
  let entries: Array<{ name: string; isFile: () => boolean }>;
  try {
    entries = await fs.readdir(assertPathInsideProject(projectRoot, dir), { withFileTypes: true });
  } catch {
    return [];
  }
  const assets: ContextAsset[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const relativePath = path.join(".claude", "agents", entry.name);
    const content = await readContextText(projectRoot, path.join(projectRoot, relativePath));
    if (!content) continue;
    assets.push({
      id: `claude.agent.${entry.name.replace(/\.md$/i, "")}`,
      type: "subagent",
      path: relativePath,
      exists: true,
      owner: "claude",
      scope: "project",
      priority: 85,
      supportedAgents: ["claude"],
      trackedFiles: [],
      dependencies: [],
      staleness: 0,
      risk: "low",
      signals: collectContextSignals(content),
    });
  }
  return assets;
}

export async function scanContextRegistry(
  projectRoot: string,
  roots: Partial<Pick<CartridgeConfig, "memoryDir" | "skillsDir">> = {},
): Promise<ContextInventory> {
  const assets: ContextAsset[] = [];
  for (const item of staticContextAssets) {
    const content = await readContextText(projectRoot, path.join(projectRoot, item.path));
    assets.push({
      id: item.id,
      type: "instruction",
      path: item.path,
      exists: content !== null,
      owner: item.owner,
      scope: "project",
      priority: item.priority,
      supportedAgents: item.supportedAgents,
      trackedFiles: [],
      dependencies: [],
      staleness: 0,
      risk: item.owner === "copilot" ? "low" : "medium",
      signals: content ? collectContextSignals(content) : [],
    });
  }
  assets.push(
    ...(await scanSkillDir({
      projectRoot,
      relativeDir: roots.skillsDir ?? path.join(".agents", "skills"),
      owner: "antigravity",
      priority: 70,
      maxDepth: 2,
      excludeLegacyMemory: true,
    })),
    ...(await scanMemoryDir({
      projectRoot,
      relativeDir: roots.memoryDir ?? path.join(".agents", "memory"),
    })),
    ...(await scanMemoryDir({
      projectRoot,
      relativeDir: roots.skillsDir ?? path.join(".agents", "skills"),
      requireMemPrefix: true,
    })),
    ...(await scanSkillDir({
      projectRoot,
      relativeDir: path.join(".claude", "skills"),
      owner: "claude",
      priority: 75,
      maxDepth: 2,
    })),
    ...(await scanClaudeAgents(projectRoot)),
  );
  return { assets, totals: summarizeContextAssets(assets) };
}
