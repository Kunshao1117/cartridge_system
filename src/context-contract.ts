import * as fs from "fs/promises";
import * as path from "path";
import matter from "gray-matter";
import { parseTrackedFiles } from "./index-manager.js";
import type {
  ContextAsset,
  ContextInventory,
  ContextOwner,
} from "./context-types.js";

export const staticContextAssets: Array<{
  id: string;
  path: string;
  owner: ContextOwner;
  priority: number;
  supportedAgents: string[];
}> = [
  {
    id: "codex.agents",
    path: "AGENTS.md",
    owner: "codex",
    priority: 100,
    supportedAgents: ["codex", "antigravity"],
  },
  {
    id: "claude.project",
    path: "CLAUDE.md",
    owner: "claude",
    priority: 90,
    supportedAgents: ["claude"],
  },
  {
    id: "copilot.repository",
    path: path.join(".github", "copilot-instructions.md"),
    owner: "copilot",
    priority: 80,
    supportedAgents: ["github-copilot"],
  },
];

export async function readContextText(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

export function collectContextSignals(content: string): string[] {
  const signals: string[] = [];
  if (/Traditional Chinese|繁體中文|zh-TW/i.test(content)) {
    signals.push("language:zh-TW");
  }
  if (/English only|only English|英文/i.test(content)) {
    signals.push("language:en-only");
  }
  if (/\bGO\b|明確授權|explicit approval/i.test(content)) {
    signals.push("commit:requires-explicit-approval");
  }
  if (/auto[- ]?commit|自動提交|commit automatically/i.test(content)) {
    signals.push("commit:auto-allowed");
  }
  if (/confirm:\s*true|requires explicit confirmation/i.test(content)) {
    signals.push("write:requires-confirm");
  }
  if (/write automatically|自動覆寫|自動寫入/i.test(content)) {
    signals.push("write:auto-allowed");
  }
  return signals;
}

export function buildSkillContextAsset(args: {
  id: string;
  relativePath: string;
  owner: ContextOwner;
  priority: number;
  content: string;
}): ContextAsset {
  const parsed = matter(args.content);
  const staleness =
    typeof parsed.data.staleness === "number" ? parsed.data.staleness : 0;
  return {
    id: args.id,
    type: args.owner === "cartridge" ? "memory" : "skill",
    path: args.relativePath,
    exists: true,
    owner: args.owner,
    scope: args.owner === "cartridge" ? "module" : "directory",
    priority: args.priority,
    supportedAgents: args.owner === "cartridge" ? ["cartridge-system"] : [args.owner],
    trackedFiles: parseTrackedFiles(args.content),
    dependencies: Array.isArray(parsed.data.dependencies)
      ? parsed.data.dependencies.map(String)
      : [],
    staleness,
    risk: staleness > 0 ? "medium" : "low",
    signals: collectContextSignals(args.content),
  };
}

export function summarizeContextAssets(
  assets: ContextAsset[],
): ContextInventory["totals"] {
  const totals: ContextInventory["totals"] = {
    assets: assets.length,
    existing: 0,
    missing: 0,
    byOwner: {},
    byType: {},
  };
  for (const asset of assets) {
    if (asset.exists) totals.existing += 1;
    else totals.missing += 1;
    totals.byOwner[asset.owner] = (totals.byOwner[asset.owner] ?? 0) + 1;
    totals.byType[asset.type] = (totals.byType[asset.type] ?? 0) + 1;
  }
  return totals;
}
