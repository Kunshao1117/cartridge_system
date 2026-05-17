export type ContextOwner =
  | "codex"
  | "claude"
  | "copilot"
  | "antigravity"
  | "cartridge";

export type ContextAssetType =
  | "instruction"
  | "skill"
  | "subagent"
  | "memory";

export type ContextScope = "project" | "directory" | "module";
export type ContextRisk = "low" | "medium" | "high";

export interface ContextAsset {
  id: string;
  type: ContextAssetType;
  path: string;
  exists: boolean;
  owner: ContextOwner;
  scope: ContextScope;
  priority: number;
  supportedAgents: string[];
  trackedFiles: string[];
  dependencies: string[];
  staleness: number;
  risk: ContextRisk;
  signals: string[];
}

export interface ContextInventory {
  assets: ContextAsset[];
  totals: {
    assets: number;
    existing: number;
    missing: number;
    byOwner: Record<string, number>;
    byType: Record<string, number>;
  };
}

export interface ContextAuditFinding {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  assets: string[];
  explanation?: string;
  paths?: string[];
  blocking?: boolean;
  recommendedTool?: string;
  recommendedAction?: string;
}
