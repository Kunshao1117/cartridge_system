import * as fs from "fs/promises";
import * as path from "path";
import matter from "gray-matter";
import {
  PROJECT_CONTEXT_CARD_FILE,
  PROJECT_CONTEXT_ROOT,
  PROJECT_CONTEXT_SECTION_TITLES,
  type ProjectContextCard,
  type ProjectContextSectionKey,
  type ProjectContextSections,
} from "./project-context-types.js";

function emptySections(): ProjectContextSections {
  return Object.fromEntries(
    Object.keys(PROJECT_CONTEXT_SECTION_TITLES).map((key) => [key, ""]),
  ) as ProjectContextSections;
}

function sectionKeyForTitle(title: string): ProjectContextSectionKey | null {
  const match = Object.entries(PROJECT_CONTEXT_SECTION_TITLES).find(
    ([, value]) => value === title,
  );
  return (match?.[0] as ProjectContextSectionKey | undefined) ?? null;
}

export function parseProjectContextSections(body: string): ProjectContextSections {
  const sections = emptySections();
  let current: ProjectContextSectionKey | null = null;
  for (const line of body.replace(/\r\n/g, "\n").split("\n")) {
    const heading = line.match(/^##\s+(.+?)\s*$/)?.[1];
    const next = heading ? sectionKeyForTitle(heading) : null;
    if (next) {
      current = next;
      continue;
    }
    if (current) sections[current] += `${line}\n`;
  }
  for (const key of Object.keys(sections) as ProjectContextSectionKey[]) {
    sections[key] = sections[key].trim();
  }
  return sections;
}

function normalizeRelative(projectRoot: string, absolutePath: string): string {
  return path.relative(projectRoot, absolutePath).replace(/\\/g, "/");
}

function idFromRelativePath(relativePath: string): string {
  return relativePath
    .replace(/\\/g, "/")
    .replace(new RegExp(`^${PROJECT_CONTEXT_ROOT}/`), "")
    .replace(new RegExp(`/${PROJECT_CONTEXT_CARD_FILE}$`), "")
    .replace(/\//g, ".")
    .replace(/^\.+/, "");
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function toFrontmatterString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return "";
}

export function parseProjectContextCard(args: {
  projectRoot: string;
  absolutePath: string;
  raw: string;
}): ProjectContextCard {
  const parsed = matter(args.raw);
  const relativePath = normalizeRelative(args.projectRoot, args.absolutePath);
  const data = parsed.data as Record<string, unknown>;
  return {
    id: idFromRelativePath(relativePath),
    path: relativePath,
    absolutePath: args.absolutePath,
    name: toFrontmatterString(data.name),
    description: toFrontmatterString(data.description),
    contextType: toFrontmatterString(data.context_type),
    scope: toFrontmatterString(data.scope),
    status: toFrontmatterString(data.status),
    confidence: toFrontmatterString(data.confidence),
    lastReviewed: toFrontmatterString(data.last_reviewed),
    approval: toFrontmatterString(data.approval),
    sources: toStringArray(data.sources),
    frontmatter: data,
    sections: parseProjectContextSections(parsed.content),
    raw: args.raw,
  };
}

async function collectContextFiles(root: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 6) return;
    let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(fullPath, depth + 1);
      if (entry.isFile() && entry.name === PROJECT_CONTEXT_CARD_FILE) {
        results.push(fullPath);
      }
    }
  }
  await walk(root, 1);
  return results.sort((left, right) => left.localeCompare(right));
}

export async function scanProjectContextCards(
  projectRoot: string,
): Promise<ProjectContextCard[]> {
  const contextRoot = path.join(projectRoot, PROJECT_CONTEXT_ROOT);
  const files = await collectContextFiles(contextRoot);
  const cards: ProjectContextCard[] = [];
  for (const absolutePath of files) {
    const raw = await fs.readFile(absolutePath, "utf-8");
    cards.push(parseProjectContextCard({ projectRoot, absolutePath, raw }));
  }
  return cards;
}

export async function collectMisplacedProjectContextCards(
  projectRoot: string,
): Promise<string[]> {
  const memoryRoot = path.join(projectRoot, ".agents", "memory");
  const files = await collectContextFiles(memoryRoot);
  return files.map((file) => normalizeRelative(projectRoot, file));
}

export function assertSafeProjectContextTarget(target: string): void {
  if (!target || target.trim().length === 0) {
    throw new Error("target is required.");
  }
  const normalized = target.replace(/\\/g, "/");
  if (path.isAbsolute(target) || path.win32.isAbsolute(target)) {
    throw new Error("target must be a project-context id or relative path.");
  }
  if (normalized.split("/").includes("..")) {
    throw new Error("target must not contain path traversal.");
  }
}

export async function readProjectContextCard(
  projectRoot: string,
  target: string,
): Promise<ProjectContextCard | null> {
  assertSafeProjectContextTarget(target);
  const normalizedTarget = target.replace(/\\/g, "/").replace(/^\.\//, "");
  const cards = await scanProjectContextCards(projectRoot);
  return (
    cards.find(
      (card) =>
        card.id === normalizedTarget ||
        card.name === normalizedTarget ||
        card.path === normalizedTarget ||
        card.path.endsWith(`/${normalizedTarget}`),
    ) ?? null
  );
}
