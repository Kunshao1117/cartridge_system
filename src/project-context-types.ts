export const PROJECT_CONTEXT_ROOT = ".agents/context";
export const PROJECT_CONTEXT_CARD_FILE = "CONTEXT.md";
export const PROJECT_CONTEXT_CANDIDATE_REVIEW_DAYS = 30;

export const PROJECT_CONTEXT_STATUSES = [
  "candidate",
  "approved",
  "deprecated",
  "conflict",
  "review",
] as const;

export type ProjectContextStatus = (typeof PROJECT_CONTEXT_STATUSES)[number];

export const PROJECT_CONTEXT_REQUIRED_FIELDS = [
  "name",
  "description",
  "context_type",
  "scope",
  "status",
  "confidence",
  "last_reviewed",
  "approval",
  "sources",
] as const;

export const PROJECT_CONTEXT_SECTION_TITLES = {
  approved: "Approved Context",
  candidate: "Candidate Context",
  deprecated: "Deprecated Context",
  conflicts: "Conflicts",
  evidence: "Evidence",
  relations: "Relations",
  promotionNotes: "Promotion Notes",
} as const;

export type ProjectContextSectionKey =
  keyof typeof PROJECT_CONTEXT_SECTION_TITLES;

export type ProjectContextSections = Record<ProjectContextSectionKey, string>;

export interface ProjectContextCard {
  id: string;
  path: string;
  absolutePath: string;
  name: string;
  description: string;
  contextType: string;
  scope: string;
  status: string;
  confidence: string;
  lastReviewed: string;
  approval: string;
  sources: string[];
  frontmatter: Record<string, unknown>;
  sections: ProjectContextSections;
  raw: string;
}

export interface ProjectContextFinding {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  file?: string;
  contextId?: string;
}

export interface ProjectContextTotals {
  cards: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
}

export interface ProjectContextSummary {
  totals: ProjectContextTotals;
  readiness: {
    status: "ready" | "warning";
    warnings: number;
    errors: number;
    usable: number;
    advisory: number;
    requiresDecision: number;
  };
  usage: {
    approved: string[];
    advisory: string[];
    requiresDecision: string[];
    review: string[];
    deprecated: string[];
  };
  findings: ProjectContextFinding[];
}
