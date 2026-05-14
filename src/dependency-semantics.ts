export type DependencySemanticWarningCode =
  | "DEPENDENCY_REASON_MISSING"
  | "DEPENDENCY_PARENT_CHILD_SUSPECT"
  | "DEPENDENCY_SKILL_NAME_SUSPECT"
  | "DEPENDENCY_RELATION_MIRROR_SUSPECT";

export interface DependencySemanticWarning {
  code: DependencySemanticWarningCode;
  dependency: string;
  message: string;
}

export interface DependencySemanticContext {
  moduleName: string;
  dependencies: string[];
  body: string;
  parent?: string | null;
}

const KNOWN_OPERATIONAL_SKILLS = new Set([
  "memory-ops",
  "memory-arch",
  "code-audit",
  "audit-engine",
  "impact-test-strategy",
  "code-quality",
  "security-sre",
  "test-patterns",
  "tech-stack-protocol",
  "gitnexus-impact-analysis",
  "gitnexus-exploring",
  "gitnexus-debugging",
  "gitnexus-refactoring",
  "gitnexus-cli",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readSection(body: string, heading: string): string {
  const re = new RegExp(
    `^## ${escapeRegExp(heading)}\\s*$([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`,
    "m",
  );
  return body.match(re)?.[1] ?? "";
}

function hasDependencyReason(body: string, dependency: string): boolean {
  const rationale = [
    readSection(body, "Key Decisions"),
    readSection(body, "Known Issues"),
  ].join("\n");
  if (!rationale.trim()) return false;

  const hasName = new RegExp(`\\b${escapeRegExp(dependency)}\\b`, "i").test(
    rationale,
  );
  const hasDependencyTerm = /dependencies?|dependency|依賴|上游|consume|import/i.test(
    rationale,
  );
  return hasName && hasDependencyTerm;
}

function hasRelationMirror(body: string, dependency: string): boolean {
  const relations = readSection(body, "Relations");
  return relations.toLowerCase().includes(dependency.toLowerCase());
}

function isParentChildSuspect(
  moduleName: string,
  dependency: string,
  parent?: string | null,
): boolean {
  if (parent && dependency === parent) return true;
  return (
    dependency.startsWith(`${moduleName}.`) ||
    moduleName.startsWith(`${dependency}.`)
  );
}

export function validateDependencySemantics(
  context: DependencySemanticContext,
): DependencySemanticWarning[] {
  const warnings: DependencySemanticWarning[] = [];
  const dependencies = [...new Set(context.dependencies)].filter(Boolean);

  for (const dependency of dependencies) {
    const hasReason = hasDependencyReason(context.body, dependency);

    if (!hasReason) {
      warnings.push({
        code: "DEPENDENCY_REASON_MISSING",
        dependency,
        message:
          `"${dependency}" listed in dependencies but no dependency reason ` +
          "was found in Key Decisions or Known Issues.",
      });
    }

    if (
      !hasReason &&
      isParentChildSuspect(context.moduleName, dependency, context.parent)
    ) {
      warnings.push({
        code: "DEPENDENCY_PARENT_CHILD_SUSPECT",
        dependency,
        message:
          `"${dependency}" looks like a parent/child navigation link. ` +
          "Use Relations unless upstream staleness must review this card.",
      });
    }

    if (KNOWN_OPERATIONAL_SKILLS.has(dependency)) {
      warnings.push({
        code: "DEPENDENCY_SKILL_NAME_SUSPECT",
        dependency,
        message:
          `"${dependency}" looks like an operational skill. ` +
          "Use Applicable Skills instead of dependencies.",
      });
    }

    if (!hasReason && hasRelationMirror(context.body, dependency)) {
      warnings.push({
        code: "DEPENDENCY_RELATION_MIRROR_SUSPECT",
        dependency,
        message:
          `"${dependency}" appears in both dependencies and Relations ` +
          "without a recorded staleness propagation reason.",
      });
    }
  }

  return warnings;
}

export function formatDependencySemanticWarning(
  warning: DependencySemanticWarning,
): string {
  return `⚠️ [${warning.code}] ${warning.message}`;
}
