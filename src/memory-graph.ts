import * as path from "path";
import * as z from "zod";
import { buildCabinetWorkbenchModelForProject, type CabinetCard, type CabinetLens, type CabinetLine } from "./cabinet-workbench-model.js";
import { createConfig } from "./config.js";
import { CartridgeIndexManager } from "./index-manager.js";
import {
  createToolEnvelope,
  createToolErrorEnvelope,
  toMcpTextResult,
  type CartridgeFinding,
  type McpToolResult,
} from "./mcp-response.js";
import { validateProjectRoot } from "./path-guard.js";

type MemoryGraphLens = CabinetLens | "all";

const TOOL_NAME = "memory_graph";
const DEFAULT_MAX_CARDS = 80;
const MAX_CARDS_LIMIT = 200;

const projectRootField = z
  .string()
  .min(1)
  .refine((p) => path.isAbsolute(p) && !p.includes(".."), {
    message: "必須為絕對路徑且不含路徑穿越符號",
  });

const moduleIdField = z.string().min(1).regex(/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/, {
  message: "focusModule 只能包含英數、底線、連字號與點號分隔，不得包含路徑片段",
});

export const memoryGraphSchema = z.object({
  projectRoot: projectRootField,
  lens: z.enum(["maintenance", "memory", "structure", "all"]).default("all"),
  focusModule: moduleIdField.optional(),
  maxCards: z.number().int().min(1).max(MAX_CARDS_LIMIT).default(DEFAULT_MAX_CARDS),
});

export async function handleMemoryGraph(args: unknown): Promise<McpToolResult> {
  const parsed = memoryGraphSchema.safeParse(args);
  if (!parsed.success) {
    return toMcpTextResult(
      createToolErrorEnvelope({
        tool: TOOL_NAME,
        projectRoot: "",
        code: "validation_error",
        message: "Validation Error: projectRoot is required; lens, focusModule and maxCards must match memory_graph schema",
      }),
    );
  }

  const { lens, focusModule, maxCards } = parsed.data;
  const projectRoot = validateProjectRoot(parsed.data.projectRoot);
  const manager = new CartridgeIndexManager(createConfig(projectRoot));
  await manager.scan();
  const model = await buildCabinetWorkbenchModelForProject(manager.getIndex(), projectRoot);
  if (focusModule && !model.cards.some((card) => card.id === focusModule)) {
    return toMcpTextResult(
      createToolErrorEnvelope({
        tool: TOOL_NAME,
        projectRoot,
        code: "module_not_found",
        message: `Error: Module "${focusModule}" not found in memory graph`,
      }),
    );
  }

  const scopedCards = scopeCards(model.cards, focusModule);
  const limitedCards = scopedCards.slice(0, maxCards);
  const visibleIds = new Set(limitedCards.map((card) => card.id));
  const lines = filterLines(model.lines, visibleIds, lens);
  const truncated = scopedCards.length > limitedCards.length;
  const findings: CartridgeFinding[] = truncated
    ? [{ severity: "info", code: "memory_graph_truncated", message: `已依 maxCards=${maxCards} 截斷卡匣清單` }]
    : [];

  const summary = {
    overview: {
      lens,
      focusModule: focusModule ?? null,
      totalCards: model.summary.totalCards,
      returnedCards: limitedCards.length,
      returnedLines: lines.length,
      truncated,
      lenses: model.summary.lenses,
    },
    cards: limitedCards.map(toAiCard),
    lines: lines.map(toAiLine),
    aiReadingGuide: buildAiReadingGuide(limitedCards),
  };

  return toMcpTextResult(
    createToolEnvelope({
      tool: TOOL_NAME,
      readOnly: true,
      projectRoot,
      status: findings.length > 0 ? "warning" : "ready",
      summary,
      findings,
      recommendedActions: [
        { tool: "memory_read", reason: "閱讀單張卡匣原文與完整決策紀錄" },
        { tool: "memory_deps", reason: "深入追查單張卡匣的依賴、被依賴與循環" },
        { tool: "memory_audit", reason: "檢查整體記憶卡治理健康" },
      ],
      legacy: {
        cards: summary.cards,
        lines: summary.lines,
      },
    }),
  );
}

function scopeCards(cards: CabinetCard[], focusModule: string | undefined): CabinetCard[] {
  if (!focusModule) return cards;
  const focus = cards.find((card) => card.id === focusModule);
  if (!focus) return [];
  const ids = new Set([focus.id, focus.parent, ...focus.children, ...focus.dependencies, ...focus.dependents].filter(Boolean));
  return cards.filter((card) => ids.has(card.id)).sort((a, b) => Number(b.id === focusModule) - Number(a.id === focusModule));
}

function filterLines(lines: CabinetLine[], visibleIds: Set<string>, lens: MemoryGraphLens): CabinetLine[] {
  const allowed = lens === "all" ? undefined : lineTypesForLens(lens);
  return lines.filter((line) => {
    if (!visibleIds.has(line.source) || !visibleIds.has(line.target)) return false;
    return !allowed || allowed.includes(line.type);
  });
}

function lineTypesForLens(lens: CabinetLens): CabinetLine["type"][] {
  if (lens === "maintenance") return ["slot", "signal", "heat"];
  if (lens === "memory") return ["note", "slot"];
  return ["slot", "signal"];
}

function toAiCard(card: CabinetCard) {
  return {
    id: card.id,
    title: card.title,
    description: card.description,
    status: card.status,
    parent: card.parent,
    children: card.children,
    dependencies: card.dependencies,
    dependents: card.dependents,
    trackedFilesCount: card.trackedFilesCount,
    maintenanceScore: card.maintenanceScore,
    memoryScore: card.memoryScore,
    structureScore: card.structureScore,
    tags: card.metadata.tags,
    concepts: card.metadata.concepts,
  };
}

function toAiLine(line: CabinetLine) {
  return {
    type: line.type,
    source: line.source,
    target: line.target,
    label: line.label,
    weight: line.weight,
  };
}

function buildAiReadingGuide(cards: CabinetCard[]) {
  const byStructure = [...cards].sort((a, b) => b.structureScore - a.structureScore).slice(0, 5).map((card) => card.id);
  const hot = [...cards].filter((card) => card.maintenanceScore > 0).sort((a, b) => b.maintenanceScore - a.maintenanceScore).slice(0, 5).map((card) => card.id);
  const orphan = cards
    .filter((card) => !card.parent && card.children.length === 0 && card.dependencies.length === 0 && card.dependents.length === 0)
    .map((card) => card.id);
  return {
    centralCards: byStructure,
    maintenanceHotspots: hot,
    orphanCards: orphan,
    suggestedNextTools: ["memory_read", "memory_deps", "memory_audit"],
  };
}
