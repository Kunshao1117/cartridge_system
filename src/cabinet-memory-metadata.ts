import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { CartridgeIndex } from "./types.js";

export interface CabinetMemoryMetadata {
  title?: string;
  summary?: string;
  tags: string[];
  concepts: string[];
  aliases: string[];
  relationNotes: string[];
  decisions: string[];
  lessons: string[];
}

export async function loadCabinetMemoryMetadata(
  index: CartridgeIndex,
  projectRoot: string,
): Promise<Record<string, CabinetMemoryMetadata>> {
  const result: Record<string, CabinetMemoryMetadata> = {};
  await Promise.all(
    Object.entries(index.cartridges).map(async ([id, entry]) => {
      try {
        const raw = await fs.readFile(path.resolve(projectRoot, entry.skillPath), "utf-8");
        result[id] = parseCabinetMemoryMetadata(raw);
      } catch {
        result[id] = emptyMetadata();
      }
    }),
  );
  return result;
}

export function parseCabinetMemoryMetadata(raw: string): CabinetMemoryMetadata {
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  return {
    title: stringField(data.title),
    summary: stringField(data.summary),
    tags: stringListField(data.tags),
    concepts: stringListField(data.concepts),
    aliases: stringListField(data.aliases),
    relationNotes: sectionLines(parsed.content, "Relations"),
    decisions: sectionLines(parsed.content, "Key Decisions").slice(0, 8),
    lessons: sectionLines(parsed.content, "Module Lessons").slice(0, 8),
  };
}

export function emptyMetadata(): CabinetMemoryMetadata {
  return { tags: [], concepts: [], aliases: [], relationNotes: [], decisions: [], lessons: [] };
}

function sectionLines(content: string, sectionName: string): string[] {
  const normalized = content.replace(/\r\n/g, "\n");
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = normalized.match(new RegExp(`## ${escaped}\\s*\\n([\\s\\S]*?)(?=\\n## |\\s*$)`))?.[1] ?? "";
  return body
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function stringListField(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}
