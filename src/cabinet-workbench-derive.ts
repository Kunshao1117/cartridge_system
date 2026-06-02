import type { CabinetCard, CabinetLens, CabinetLensStat, CabinetLine, CabinetLineType } from "./cabinet-workbench-model.js";
import type { CabinetMemoryMetadata } from "./cabinet-memory-metadata.js";
import type { CartridgeIndex } from "./types.js";

export function buildCabinetLines(index: CartridgeIndex, cards: CabinetCard[]): CabinetLine[] {
  const lines: CabinetLine[] = [];
  const hasCard = (id: string) => Boolean(index.cartridges[id]);
  for (const [id, entry] of Object.entries(index.cartridges)) {
    if (entry.parent && hasCard(entry.parent)) lines.push(line("slot", entry.parent, id, "卡槽", 1));
    for (const dependency of entry.dependencies ?? []) {
      if (!hasCard(dependency)) continue;
      lines.push(line("signal", id, dependency, "訊號", 1));
      if (index.cartridges[dependency].staleness > 0) {
        lines.push(line("heat", dependency, id, "熱度", index.cartridges[dependency].staleness));
      }
    }
  }
  return dedupeLines([...lines, ...buildKnowledgeLines(cards)]);
}

export function buildLensStats(
  cards: CabinetCard[],
  lines: CabinetLine[],
  _untrackedFiles: number,
): Record<CabinetLens, CabinetLensStat> {
  return {
    maintenance: {
      cards: cards.filter((card) => card.maintenanceScore > 0 || card.reviewScore > 0).length,
      primaryLabel: "發熱卡",
      primaryValue: cards.filter((card) => card.maintenanceScore > 0).length,
      secondaryLabel: "複審",
      secondaryValue: cards.filter((card) => card.reviewScore > 0).length,
      lineCount: lines.filter((line) => line.type === "heat" || line.type === "signal").length,
    },
    memory: {
      cards: cards.filter((card) => card.memoryScore > 0).length,
      primaryLabel: "決策",
      primaryValue: cards.reduce((sum, card) => sum + card.metadata.decisions.length, 0),
      secondaryLabel: "經驗",
      secondaryValue: cards.reduce((sum, card) => sum + card.metadata.lessons.length, 0),
      lineCount: lines.filter((line) => line.type === "note").length,
    },
    structure: {
      cards: cards.filter((card) => card.structureScore > 0).length,
      primaryLabel: "追蹤檔",
      primaryValue: cards.reduce((sum, card) => sum + card.trackedFilesCount, 0),
      secondaryLabel: "上下卡",
      secondaryValue: lines.filter((line) => line.type === "slot").length,
      lineCount: lines.filter((line) => line.type === "slot" || line.type === "signal").length,
    },
  };
}

export function maintenanceScore(
  staleness: number,
  pendingChangesCount: number,
  ghostFilesCount: number,
): number {
  return staleness + pendingChangesCount * 8 + ghostFilesCount * 20;
}

export function memoryScore(description: string, metadata: CabinetMemoryMetadata): number {
  return (
    (description.trim().length > 0 ? 1 : 0) +
    metadata.decisions.length * 3 +
    metadata.lessons.length * 2 +
    metadata.concepts.length * 2 +
    metadata.tags.length +
    metadata.relationNotes.length
  );
}

export function structureScore(
  trackedFilesCount: number,
  dependenciesCount: number,
  dependentsCount: number,
  childrenCount: number,
): number {
  return trackedFilesCount + dependenciesCount * 3 + dependentsCount * 3 + childrenCount * 2;
}

function buildKnowledgeLines(cards: CabinetCard[]): CabinetLine[] {
  const lines: CabinetLine[] = [];
  for (const card of cards) {
    for (const note of card.metadata.relationNotes) {
      const target = cards.find((candidate) => candidate.id !== card.id && note.toLowerCase().includes(candidate.id.toLowerCase()));
      if (target) lines.push(line("note", card.id, target.id, "記憶註記", 1));
    }
  }
  for (let index = 0; index < cards.length; index += 1) {
    for (let next = index + 1; next < cards.length; next += 1) {
      const source = cards[index];
      const target = cards[next];
      const topics = sharedTopics(source, target);
      if (topics.length > 0) lines.push(line("note", source.id, target.id, topics.slice(0, 2).join(" / "), Math.min(4, topics.length)));
    }
  }
  return lines;
}

function sharedTopics(source: CabinetCard, target: CabinetCard): string[] {
  const targetTopics = new Set([...topicMap(target).keys()]);
  return [...topicMap(source).entries()]
    .filter(([key]) => targetTopics.has(key))
    .map(([, value]) => value);
}

function topicMap(card: CabinetCard): Map<string, string> {
  const topics = [...card.metadata.concepts, ...card.metadata.tags, ...card.metadata.aliases];
  return new Map(
    topics
      .map((topic) => topic.trim())
      .filter((topic) => topic.length > 0)
      .map((topic) => [topic.toLowerCase(), topic]),
  );
}

function line(type: CabinetLineType, source: string, target: string, label: string, weight: number): CabinetLine {
  return { id: `${type}:${source}->${target}`, type, source, target, label, weight };
}

function dedupeLines(lines: CabinetLine[]): CabinetLine[] {
  const seen = new Set<string>();
  return lines.filter((line) => {
    if (seen.has(line.id)) return false;
    seen.add(line.id);
    return true;
  });
}
