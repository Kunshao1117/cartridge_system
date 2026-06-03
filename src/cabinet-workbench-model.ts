import type { CartridgeIndex } from "./types.js";
import { emptyMetadata, loadCabinetMemoryMetadata, type CabinetMemoryMetadata } from "./cabinet-memory-metadata.js";
import { buildCabinetLines, buildLensStats, maintenanceScore, memoryScore, structureScore } from "./cabinet-workbench-derive.js";
import type { MemoryCompactionMetrics } from "./memory-compaction.js";
import { getTaiwanISO } from "./timestamp.js";
export type CabinetLens = "maintenance" | "memory" | "structure";
export type CabinetLineType = "slot" | "signal" | "note" | "heat";
export type CabinetCardStatus = "healthy" | "mild" | "significant" | "critical";
export interface CabinetCard {
  id: string;
  label: string;
  title: string;
  description: string;
  skillPath: string;
  depth: number;
  parent: string | null;
  status: CabinetCardStatus;
  staleness: number;
  indirectStaleness: number;
  trackedFilesCount: number;
  pendingChangesCount: number;
  ghostFilesCount: number;
  compactionDue: boolean;
  compactionAdvisoryCount: number;
  maintenanceScore: number;
  reviewScore: number;
  memoryScore: number;
  structureScore: number;
  dependencies: string[];
  dependents: string[];
  children: string[];
  trackedFiles: string[];
  pendingChanges: string[];
  ghostFiles: string[];
  compaction: MemoryCompactionMetrics | null;
  metadata: CabinetMemoryMetadata;
}
export interface CabinetSlot {
  id: string;
  label: string;
  parent: string | null;
  depth: number;
  cardIds: string[];
}
export interface CabinetLine {
  id: string;
  type: CabinetLineType;
  source: string;
  target: string;
  label: string;
  weight: number;
}
export interface CabinetLensStat {
  cards: number;
  primaryLabel: string;
  primaryValue: number;
  secondaryLabel: string;
  secondaryValue: number;
  lineCount: number;
}

export interface CabinetWorkbenchModel {
  generatedAt: string;
  summary: {
    totalCards: number;
    staleCards: number;
    ghostFiles: number;
    pendingChanges: number;
    untrackedFiles: number;
    signalLines: number;
    heatLines: number;
    noteLines: number;
    lenses: Record<CabinetLens, CabinetLensStat>;
  };
  cards: CabinetCard[];
  slots: CabinetSlot[];
  lines: CabinetLine[];
  untrackedFiles: Array<{
    filePath: string;
    suggestedOwner: string | null;
  }>;
}

export async function buildCabinetWorkbenchModelForProject(
  index: CartridgeIndex,
  projectRoot: string,
): Promise<CabinetWorkbenchModel> {
  const metadataByCard = await loadCabinetMemoryMetadata(index, projectRoot);
  return buildCabinetWorkbenchModel(index, metadataByCard);
}

export function buildCabinetWorkbenchModel(
  index: CartridgeIndex,
  metadataByCard: Record<string, CabinetMemoryMetadata> = {},
): CabinetWorkbenchModel {
  const dependentsByCard = buildDependents(index);
  const childrenByCard = buildChildren(index);
  const cards = Object.entries(index.cartridges).map(([id, entry]) => {
    const metadata = metadataByCard[id] ?? emptyMetadata();
    const trackedFilesCount = entry.trackedFiles.length;
    const pendingChangesCount = entry.pendingChanges.length;
    const ghostFilesCount = entry.ghostFiles.length;
    const compactionDue = entry.compaction?.needsCompaction ?? false;
    const compactionAdvisoryCount =
      (entry.compaction?.isLegacy ? 1 : 0) +
      (entry.compaction?.reasons.includes("highChineseRatio") ? 1 : 0) +
      (trackedFilesCount > 8 ? 1 : 0);
    const reviewScore = entry.indirectStaleness;
    const children = childrenByCard.get(id) ?? [];
    const dependencies = [...(entry.dependencies ?? [])];
    const dependents = dependentsByCard.get(id) ?? [];
    return {
      id,
      label: id.split(".").pop() ?? id,
      title: metadata.title ?? id,
      description: metadata.summary ?? entry.description.trim(),
      skillPath: normalizePath(entry.skillPath),
      depth: entry.depth,
      parent: entry.parent,
      status: statusFromEntry(entry.staleness, compactionDue),
      staleness: entry.staleness,
      indirectStaleness: entry.indirectStaleness,
      trackedFilesCount,
      pendingChangesCount,
      ghostFilesCount,
      compactionDue,
      compactionAdvisoryCount,
      maintenanceScore:
        maintenanceScore(entry.staleness, pendingChangesCount, ghostFilesCount) +
        (compactionDue ? 30 : compactionAdvisoryCount * 5),
      reviewScore,
      memoryScore: memoryScore(entry.description, metadata),
      structureScore: structureScore(trackedFilesCount, dependencies.length, dependents.length, children.length),
      dependencies,
      dependents,
      children,
      trackedFiles: [...entry.trackedFiles],
      pendingChanges: entry.pendingChanges.map((change) => change.filePath),
      ghostFiles: [...entry.ghostFiles],
      compaction: entry.compaction ?? null,
      metadata,
    };
  });
  const lines = buildCabinetLines(index, cards);
  return {
    generatedAt: getTaiwanISO(),
    summary: {
      totalCards: cards.length,
      staleCards: cards.filter((card) => card.staleness > 0).length,
      ghostFiles: cards.reduce((sum, card) => sum + card.ghostFilesCount, 0),
      pendingChanges: cards.reduce((sum, card) => sum + card.pendingChangesCount, 0),
      untrackedFiles: index.untrackedFiles.length,
      signalLines: lines.filter((line) => line.type === "signal").length,
      heatLines: lines.filter((line) => line.type === "heat").length,
      noteLines: lines.filter((line) => line.type === "note").length,
      lenses: buildLensStats(cards, lines, index.untrackedFiles.length),
    },
    cards,
    slots: buildSlots(index),
    lines,
    untrackedFiles: index.untrackedFiles.map((entry) => ({
      filePath: entry.filePath,
      suggestedOwner: entry.suggestedOwner,
    })),
  };
}

function buildChildren(index: CartridgeIndex): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const [id, entry] of Object.entries(index.cartridges)) {
    if (!entry.parent) continue;
    if (!result.has(entry.parent)) result.set(entry.parent, []);
    result.get(entry.parent)!.push(id);
  }
  return result;
}

function buildDependents(index: CartridgeIndex): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const [id, entry] of Object.entries(index.cartridges)) {
    for (const dependency of entry.dependencies ?? []) {
      if (!result.has(dependency)) result.set(dependency, []);
      result.get(dependency)!.push(id);
    }
  }
  return result;
}

function buildSlots(index: CartridgeIndex): CabinetSlot[] {
  const slots = new Map<string, CabinetSlot>();
  slots.set("slot:root", { id: "slot:root", label: "主機櫃", parent: null, depth: 0, cardIds: [] });
  for (const [id, entry] of Object.entries(index.cartridges)) {
    const slotId = entry.parent ? `slot:${entry.parent}` : "slot:root";
    if (!slots.has(slotId)) {
      slots.set(slotId, {
        id: slotId,
        label: entry.parent ?? "主機櫃",
        parent: null,
        depth: Math.max(0, entry.depth - 1),
        cardIds: [],
      });
    }
    slots.get(slotId)!.cardIds.push(id);
  }
  return [...slots.values()];
}

function statusFromStaleness(staleness: number): CabinetCardStatus {
  if (staleness >= 100) return "critical";
  if (staleness >= 60) return "significant";
  if (staleness >= 10) return "mild";
  return "healthy";
}

function statusFromEntry(
  staleness: number,
  compactionDue: boolean,
): CabinetCardStatus {
  if (compactionDue) return "critical";
  return statusFromStaleness(staleness);
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}
