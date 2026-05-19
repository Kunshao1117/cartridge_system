import type { LayoutOptions } from "cytoscape";

export type GraphLens = "maintenance" | "memory" | "structure";

export interface GraphCardSnapshot {
  id: string;
  label: string;
  title: string;
  status: string;
  maintenanceScore: number;
  memoryScore: number;
  structureScore: number;
  trackedFilesCount: number;
}

export interface GraphLineSnapshot {
  id: string;
  type: string;
  source: string;
  target: string;
  label: string;
  weight: number;
}

export interface GraphViewport {
  zoom: number;
  pan: {
    x: number;
    y: number;
  };
}

export interface GraphRenderState {
  lens: GraphLens;
  signature: string;
}

export type GraphLayoutReason = "initial" | "lens" | "content" | "reset";

export function createGraphViewports(): Record<GraphLens, GraphViewport | undefined> {
  return { maintenance: undefined, memory: undefined, structure: undefined };
}

export function buildGraphSignature(cards: GraphCardSnapshot[], lines: GraphLineSnapshot[]): string {
  const cardKey = cards
    .map(
      (card) =>
        `${card.id}:${card.label}:${card.title}:${card.status}:${card.maintenanceScore}:${card.memoryScore}:${card.structureScore}:${card.trackedFilesCount}`,
    )
    .join("|");
  const lineKey = lines
    .map((line) => `${line.id}:${line.type}:${line.source}:${line.target}:${line.label}:${line.weight}`)
    .join("|");
  return `${cardKey}::${lineKey}`;
}

export function getGraphLayoutReason(
  previous: GraphRenderState | undefined,
  lens: GraphLens,
  signature: string,
): GraphLayoutReason | null {
  if (!previous) return "initial";
  if (previous.lens !== lens) return "lens";
  if (previous.signature !== signature) return "content";
  return null;
}

export function rememberGraphViewport(
  viewports: Record<GraphLens, GraphViewport | undefined>,
  lens: GraphLens,
  viewport: GraphViewport,
): void {
  viewports[lens] = viewport;
}

export function getGraphViewport(
  viewports: Record<GraphLens, GraphViewport | undefined>,
  lens: GraphLens,
): GraphViewport | undefined {
  return viewports[lens];
}

export function clampReadableZoom(zoom: number, visibleCards: number): number {
  const minimum = visibleCards > 12 ? 0.72 : 0.9;
  return Math.max(minimum, Math.min(1.22, zoom));
}

export function clampUserZoom(zoom: number, min = 0.35, max = 2.4): number {
  return Math.max(min, Math.min(max, zoom));
}

export function formatZoomPercent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

export function layoutForLens(lens: GraphLens): LayoutOptions {
  if (lens === "memory") {
    return {
      name: "concentric",
      animate: true,
      fit: false,
      padding: 88,
      minNodeSpacing: 58,
      concentric: (node) => Number(node.data("memoryScore")) || 1,
      levelWidth: () => 4,
    } as LayoutOptions;
  }
  if (lens === "structure") {
    return {
      name: "breadthfirst",
      directed: true,
      animate: true,
      fit: false,
      padding: 88,
      spacingFactor: 1.55,
    } as LayoutOptions;
  }
  return {
    name: "cose",
    animate: true,
    fit: false,
    padding: 82,
    nodeRepulsion: 9800,
    idealEdgeLength: 164,
    gravity: 0.12,
  } as LayoutOptions;
}
