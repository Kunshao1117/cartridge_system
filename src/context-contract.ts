import { assertPathInsideProject } from "./file-containment.js";
import * as fs from "fs/promises";
import * as path from "path";
import matter from "./safe-frontmatter.js";
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

export async function readContextText(projectRoot: string, filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(assertPathInsideProject(projectRoot, filePath), "utf-8");
  } catch {
    return null;
  }
}

function hasAffirmativePermission(content: string, phrase: RegExp): boolean {
  // Signals are governance hints, not executable permissions. Honor explicit
  // negation in the same clause rather than treating a keyword as approval.
  for (const clause of content.split(/[\n,，;；。.!?！？]/)) {
    for (const match of clause.matchAll(new RegExp(phrase.source, "gi"))) {
      const before = clause.slice(0, match.index).trim();
      const after = clause.slice((match.index ?? 0) + match[0].length).trim();
      if (/(?:禁止|不得|不可|不要|不能|不允許|不允许|無需|无需)(?:\s*(?:AI|代理|任何|擅自|直接|自行|默認|默认|系統|系统))*\s*$/.test(before) ||
          /(?:\b(?:do\s+not|does\s+not|must\s+not|should\s+not|can\s+not|cannot|don't|never|no|disable|prohibit|forbid)\b)(?:\s+\w+){0,3}\s*$/i.test(before) ||
          /^(?:is\s+|are\s+)?(?:not\s+allowed|disabled|prohibited|forbidden|disallowed|禁止|不允許|不允许)/i.test(after)) continue;
      return true;
    }
  }
  return false;
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
  if (hasAffirmativePermission(content, /auto[- ]?commit|自動提交|commit automatically/)) {
    signals.push("commit:auto-allowed");
  }
  if (/confirm:\s*true|requires explicit confirmation/i.test(content)) {
    signals.push("write:requires-confirm");
  }
  if (hasAffirmativePermission(content, /write automatically|automatic writes|自動覆寫|自動寫入/)) {
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
