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

async function scanSkillDir(args: {
  projectRoot: string;
  relativeDir: string;
  owner: ContextOwner;
  priority: number;
  maxDepth: number;
}): Promise<ContextAsset[]> {
  const results: ContextAsset[] = [];
  const root = path.join(args.projectRoot, args.relativeDir);
  async function walk(current: string, depth: number) {
    if (depth > args.maxDepth) return;
    let entries: Array<{ name: string; isDirectory: () => boolean }>;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const dir = path.join(current, entry.name);
      const skillPath = path.join(dir, "SKILL.md");
      const content = await readContextText(skillPath);
      if (content) {
        const relativePath = path.relative(args.projectRoot, skillPath);
        const id = relativePath
          .replace(/\\/g, "/")
          .replace(/\/SKILL\.md$/i, "")
          .replace(/[/.]/g, ".")
          .replace(/^\.+/, "");
        results.push(
          buildSkillContextAsset({
            id,
            relativePath,
            owner: args.owner,
            priority: args.priority,
            content,
          }),
        );
      }
      await walk(dir, depth + 1);
    }
  }
  await walk(root, 1);
  return results;
}

async function scanClaudeAgents(projectRoot: string): Promise<ContextAsset[]> {
  const dir = path.join(projectRoot, ".claude", "agents");
  let entries: Array<{ name: string; isFile: () => boolean }>;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const assets: ContextAsset[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const relativePath = path.join(".claude", "agents", entry.name);
    const content = await readContextText(path.join(projectRoot, relativePath));
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

export async function scanContextRegistry(projectRoot: string): Promise<ContextInventory> {
  const assets: ContextAsset[] = [];
  for (const item of staticContextAssets) {
    const content = await readContextText(path.join(projectRoot, item.path));
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
      relativeDir: path.join(".agents", "skills"),
      owner: "antigravity",
      priority: 70,
      maxDepth: 2,
    })),
    ...(await scanSkillDir({
      projectRoot,
      relativeDir: path.join(".agents", "memory"),
      owner: "cartridge",
      priority: 60,
      maxDepth: 4,
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
