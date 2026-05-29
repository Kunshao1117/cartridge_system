import {
  PROJECT_CONTEXT_CANDIDATE_REVIEW_DAYS,
  PROJECT_CONTEXT_REQUIRED_FIELDS,
  PROJECT_CONTEXT_SECTION_TITLES,
  PROJECT_CONTEXT_STATUSES,
  type ProjectContextCard,
  type ProjectContextFinding,
  type ProjectContextSectionKey,
  type ProjectContextSummary,
  type ProjectContextTotals,
} from "./project-context-types.js";
import { collectMisplacedProjectContextCards } from "./project-context-registry.js";

function finding(args: ProjectContextFinding): ProjectContextFinding {
  return args;
}

function isNoneLike(value: string): boolean {
  return value.trim().length === 0 || /^none\.?$/i.test(value.trim());
}

function parseReviewedAt(value: string): number | null {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function isCandidateExpired(card: ProjectContextCard, now: Date): boolean {
  if (card.status !== "candidate") return false;
  const reviewedAt = parseReviewedAt(card.lastReviewed);
  if (reviewedAt === null) return false;
  const ageMs = now.getTime() - reviewedAt;
  const ageDays = ageMs / 86_400_000;
  return ageDays > PROJECT_CONTEXT_CANDIDATE_REVIEW_DAYS;
}

function hasSectionContent(card: ProjectContextCard, key: ProjectContextSectionKey) {
  return !isNoneLike(card.sections[key] ?? "");
}

export function validateProjectContextCard(
  card: ProjectContextCard,
  now = new Date(),
): ProjectContextFinding[] {
  const findings: ProjectContextFinding[] = [];
  for (const field of PROJECT_CONTEXT_REQUIRED_FIELDS) {
    if (!(field in card.frontmatter)) {
      findings.push(
        finding({
          severity: "error",
          code: "PROJECT_CONTEXT_FRONTMATTER_MISSING",
          message: `${card.id} frontmatter 缺少 ${field} 欄位。`,
          file: card.path,
          contextId: card.id,
        }),
      );
    }
  }
  for (const key of Object.keys(PROJECT_CONTEXT_SECTION_TITLES) as ProjectContextSectionKey[]) {
    if (!(card.sections[key]?.length > 0)) {
      findings.push(
        finding({
          severity: "warning",
          code: "PROJECT_CONTEXT_SECTION_EMPTY",
          message: `${card.id} 缺少或未填寫 ${PROJECT_CONTEXT_SECTION_TITLES[key]} 區段。`,
          file: card.path,
          contextId: card.id,
        }),
      );
    }
  }
  if (!PROJECT_CONTEXT_STATUSES.includes(card.status as never)) {
    findings.push(
      finding({
        severity: "error",
        code: "PROJECT_CONTEXT_STATUS_INVALID",
        message: `${card.id} 使用未知脈絡狀態：${card.status || "(empty)"}`,
        file: card.path,
        contextId: card.id,
      }),
    );
  }
  if (card.status === "approved" && isNoneLike(card.approval)) {
    findings.push(
      finding({
        severity: "warning",
        code: "PROJECT_CONTEXT_APPROVAL_MISSING",
        message: `${card.id} 已核准但缺少 approval 紀錄。`,
        file: card.path,
        contextId: card.id,
      }),
    );
  }
  if (card.status === "conflict" && !hasSectionContent(card, "conflicts")) {
    findings.push(
      finding({
        severity: "warning",
        code: "PROJECT_CONTEXT_CONFLICT_DETAIL_MISSING",
        message: `${card.id} 標記為 conflict 但缺少明確衝突說明。`,
        file: card.path,
        contextId: card.id,
      }),
    );
  }
  if (isCandidateExpired(card, now)) {
    findings.push(
      finding({
        severity: "warning",
        code: "PROJECT_CONTEXT_CANDIDATE_STALE",
        message: `${card.id} candidate 超過 ${PROJECT_CONTEXT_CANDIDATE_REVIEW_DAYS} 天未處理。`,
        file: card.path,
        contextId: card.id,
      }),
    );
  }
  return findings;
}

export async function validateProjectContextWorkspace(args: {
  projectRoot: string;
  cards: ProjectContextCard[];
  now?: Date;
}): Promise<ProjectContextFinding[]> {
  const findings = args.cards.flatMap((card) =>
    validateProjectContextCard(card, args.now ?? new Date()),
  );
  const misplaced = await collectMisplacedProjectContextCards(args.projectRoot);
  return [
    ...findings,
    ...misplaced.map((file) =>
      finding({
        severity: "error",
        code: "PROJECT_CONTEXT_MISPLACED_IN_MEMORY",
        message: `脈絡卡誤放進原始碼記憶目錄：${file}`,
        file,
      }),
    ),
  ];
}

function buildTotals(cards: ProjectContextCard[]): ProjectContextTotals {
  const totals: ProjectContextTotals = { cards: cards.length, byStatus: {}, byType: {} };
  for (const card of cards) {
    totals.byStatus[card.status] = (totals.byStatus[card.status] ?? 0) + 1;
    totals.byType[card.contextType] = (totals.byType[card.contextType] ?? 0) + 1;
  }
  return totals;
}

export async function summarizeProjectContexts(args: {
  projectRoot: string;
  cards: ProjectContextCard[];
  now?: Date;
}): Promise<ProjectContextSummary> {
  const findings = await validateProjectContextWorkspace(args);
  const usage = {
    approved: args.cards.filter((card) => card.status === "approved").map((card) => card.id),
    advisory: args.cards.filter((card) => card.status === "candidate").map((card) => card.id),
    requiresDecision: args.cards
      .filter((card) => card.status === "conflict")
      .map((card) => card.id),
    review: args.cards.filter((card) => card.status === "review").map((card) => card.id),
    deprecated: args.cards.filter((card) => card.status === "deprecated").map((card) => card.id),
  };
  const errors = findings.filter((item) => item.severity === "error").length;
  const warnings = findings.filter((item) => item.severity === "warning").length;
  return {
    totals: buildTotals(args.cards),
    readiness: {
      status:
        errors > 0 || warnings > 0 || usage.requiresDecision.length > 0 || usage.review.length > 0
          ? "warning"
          : "ready",
      warnings,
      errors,
      usable: usage.approved.length,
      advisory: usage.advisory.length,
      requiresDecision: usage.requiresDecision.length,
    },
    usage,
    findings,
  };
}
