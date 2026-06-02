import cytoscape, { type Core, type ElementDefinition, type StylesheetStyle } from "cytoscape";
import {
  buildGraphSignature,
  clampUserZoom,
  clampReadableZoom,
  createGraphViewports,
  formatZoomPercent,
  getGraphLayoutReason,
  getGraphViewport,
  layoutForLens,
  rememberGraphViewport,
  type GraphLayoutReason,
  type GraphRenderState,
  type GraphViewport,
} from "./cabinet-graph-viewport.js";
import type { CabinetCard, CabinetLens, CabinetLine, CabinetWorkbenchModel } from "./cabinet-workbench-model.js";

declare function acquireVsCodeApi(): {
  postMessage(message: { type: string; cardId?: string }): void;
};

interface LensFilter {
  id: string;
  label: string;
  test: (card: CabinetCard, workbench: CabinetWorkbenchModel) => boolean;
}

const vscode = acquireVsCodeApi();
const lenses: CabinetLens[] = ["maintenance", "memory", "structure"];
const lensNames: Record<CabinetLens, string> = {
  maintenance: "維護艙",
  memory: "記憶艙",
  structure: "結構艙",
};
const lineTypesByLens: Record<CabinetLens, CabinetLine["type"][]> = {
  maintenance: ["slot", "signal", "heat"],
  memory: ["note", "slot"],
  structure: ["slot", "signal"],
};
const filtersByLens: Record<CabinetLens, LensFilter[]> = {
  maintenance: [
    { id: "hot", label: "發熱", test: (card) => card.maintenanceScore > 0 },
    { id: "review", label: "複審", test: (card) => card.reviewScore > 0 },
    { id: "ghost", label: "幽靈", test: (card) => card.ghostFilesCount > 0 },
    { id: "pending", label: "待同步", test: (card) => card.pendingChangesCount > 0 },
    {
      id: "unowned",
      label: "未歸屬",
      test: (card, workbench) => workbench.untrackedFiles.some((file) => file.suggestedOwner === card.id),
    },
  ],
  memory: [
    { id: "decisions", label: "有決策", test: (card) => card.metadata.decisions.length > 0 },
    { id: "lessons", label: "有經驗", test: (card) => card.metadata.lessons.length > 0 },
    { id: "concepts", label: "有概念", test: (card) => card.metadata.concepts.length > 0 },
    { id: "empty", label: "空白說明", test: (card) => card.description.trim().length === 0 },
  ],
  structure: [
    { id: "dependencies", label: "有依賴", test: (card) => card.dependencies.length > 0 },
    { id: "dependents", label: "被依賴", test: (card) => card.dependents.length > 0 },
    { id: "slots", label: "父卡 / 子卡", test: (card) => Boolean(card.parent) || card.children.length > 0 },
    { id: "files", label: "檔案數高", test: (card) => card.trackedFilesCount >= 5 },
  ],
};
const activeFilters: Record<CabinetLens, Set<string>> = {
  maintenance: new Set<string>(),
  memory: new Set<string>(),
  structure: new Set<string>(),
};

let cy: Core | undefined;
let model: CabinetWorkbenchModel | undefined;
let selectedCard: CabinetCard | undefined;
let focusedCardId: string | undefined;
let lens: CabinetLens = "maintenance";
let graphState: GraphRenderState | undefined;
let restoringViewport = false;
const graphViewports = createGraphViewports();

window.addEventListener("message", (event: MessageEvent<{ type: string; model?: CabinetWorkbenchModel }>) => {
  if (event.data.type !== "model" || !event.data.model) return;
  const selectedCardId = selectedCard?.id;
  model = event.data.model;
  selectedCard = model.cards.find((card) => card.id === selectedCardId) ?? model.cards[0];
  if (focusedCardId && !model.cards.some((card) => card.id === focusedCardId)) focusedCardId = undefined;
  render();
});

document.querySelectorAll<HTMLButtonElement>("[data-lens]").forEach((button) => {
  button.addEventListener("click", () => {
    rememberCurrentGraphViewport();
    lens = button.dataset.lens as CabinetLens;
    document.body.dataset.lens = lens;
    focusedCardId = undefined;
    render();
  });
});

document.getElementById("search")?.addEventListener("input", () => render());
document.getElementById("zoomOut")?.addEventListener("click", () => adjustGraphZoom(-0.15));
document.getElementById("zoomPercent")?.addEventListener("click", () => setGraphZoom(1));
document.getElementById("zoomIn")?.addEventListener("click", () => adjustGraphZoom(0.15));
document.getElementById("fit")?.addEventListener("click", () => resetGraphView());
document.getElementById("refresh")?.addEventListener("click", () => vscode.postMessage({ type: "refresh" }));
vscode.postMessage({ type: "ready" });

function render(): void {
  if (!model) return;
  renderLensDock(model);
  renderFilters();
  const visibleCards = filterCards(model);
  const visibleIds = new Set(visibleCards.map((card) => card.id));
  const lines = filterLines(model.lines, visibleIds);
  if (focusedCardId && !visibleIds.has(focusedCardId)) focusedCardId = undefined;
  const detailCard = selectedCard && visibleIds.has(selectedCard.id) ? selectedCard : visibleCards[0];
  selectedCard = detailCard;
  const signature = buildGraphSignature(visibleCards, lines);
  const layoutReason = getGraphLayoutReason(graphState, lens, signature);
  graphState = { lens, signature };
  renderSearchCount(visibleCards.length, model.cards.length);
  renderStats(model, visibleCards, lines);
  renderDetails(detailCard);
  renderGraph(visibleCards, lines, layoutReason);
}

function renderLensDock(workbench: CabinetWorkbenchModel): void {
  for (const currentLens of lenses) {
    document.querySelector(`[data-lens="${currentLens}"]`)?.classList.toggle("active", currentLens === lens);
    const stat = workbench.summary.lenses[currentLens];
    const counter = document.querySelector(`[data-lens-count="${currentLens}"]`);
    if (counter) counter.textContent = `${stat.cards} 卡 | ${stat.primaryValue} ${stat.primaryLabel}`;
  }
}

function renderFilters(): void {
  const filterBar = document.getElementById("filterBar");
  if (!filterBar) return;
  const active = activeFilters[lens];
  filterBar.innerHTML = [
    ...filtersByLens[lens].map((filter) => {
      const activeClass = active.has(filter.id) ? " active" : "";
      return `<button class="filter-chip${activeClass}" data-filter="${filter.id}">${escapeHtml(filter.label)}</button>`;
    }),
    `<button class="filter-chip filter-reset" data-filter-reset="true">清除</button>`,
  ].join("");
  filterBar.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const filterId = button.dataset.filter;
      if (!filterId) return;
      if (active.has(filterId)) active.delete(filterId);
      else active.add(filterId);
      render();
    });
  });
  filterBar.querySelector<HTMLButtonElement>("[data-filter-reset]")?.addEventListener("click", () => {
    active.clear();
    render();
  });
}

function filterCards(workbench: CabinetWorkbenchModel): CabinetCard[] {
  const query = searchQuery();
  const filters = activeFilters[lens];
  return workbench.cards.filter((card) => {
    const matchesQuery = query.length === 0 || searchableText(card).includes(query);
    const matchesFilters =
      filters.size === 0 ||
      filtersByLens[lens].some((filter) => filters.has(filter.id) && filter.test(card, workbench));
    return matchesQuery && matchesFilters;
  });
}

function filterLines(lines: CabinetLine[], visibleIds: Set<string>): CabinetLine[] {
  const allowedTypes = lineTypesByLens[lens];
  return lines.filter((line) => {
    if (!visibleIds.has(line.source) || !visibleIds.has(line.target)) return false;
    return allowedTypes.includes(line.type);
  });
}

function renderSearchCount(visibleCards: number, totalCards: number): void {
  const searchCount = document.getElementById("searchCount");
  if (!searchCount) return;
  const suffix = searchQuery().length > 0 || activeFilters[lens].size > 0 ? "命中" : "可見";
  searchCount.textContent = `${visibleCards}/${totalCards} ${suffix}`;
}

function renderStats(workbench: CabinetWorkbenchModel, cards: CabinetCard[], lines: CabinetLine[]): void {
  const stats = document.getElementById("stats");
  if (!stats) return;
  const stat = workbench.summary.lenses[lens];
  stats.innerHTML = [
    statCell(cards.length, "可見卡匣"),
    statCell(stat.primaryValue, stat.primaryLabel),
    statCell(stat.secondaryValue, stat.secondaryLabel),
    statCell(lines.length, "顯示連線"),
  ].join("");
}

function renderGraph(cards: CabinetCard[], lines: CabinetLine[], layoutReason: GraphLayoutReason | null): void {
  const empty = document.getElementById("empty");
  if (empty) empty.style.display = cards.length === 0 ? "grid" : "none";
  const elements: ElementDefinition[] = [
    ...cards.map((card) => ({
      group: "nodes" as const,
      data: {
        id: card.id,
        label: graphLabel(card),
        title: card.title,
        status: card.status,
        heat: card.maintenanceScore,
        memoryScore: card.memoryScore,
        structureScore: card.structureScore,
        files: card.trackedFilesCount,
      },
      classes: cardClasses(card),
    })),
    ...lines.map((line) => ({
      group: "edges" as const,
      data: {
        id: line.id,
        source: line.source,
        target: line.target,
        label: line.label,
        weight: line.weight,
      },
      classes: line.type,
    })),
  ];
  if (!cy) {
    const container = document.getElementById("cy");
    if (!container) return;
    cy = cytoscape({
      container,
      elements,
      style: graphStyle(),
      layout: { name: "preset" },
      maxZoom: 2.4,
      minZoom: 0.35,
      wheelSensitivity: 0.34,
    });
    bindGraphEvents();
    runGraphLayout(layoutReason ?? "initial", cards.length);
    applyFocus(focusedCardId);
    return;
  }
  cy.style(graphStyle()).update();
  if (layoutReason) {
    cy.elements().remove();
    cy.add(elements);
    runGraphLayout(layoutReason, cards.length);
  } else {
    restoreGraphViewport(getGraphViewport(graphViewports, lens));
  }
  applyFocus(focusedCardId);
}

function bindGraphEvents(): void {
  if (!cy) return;
  cy.on("pan zoom", () => {
    rememberCurrentGraphViewport();
    renderZoomPercent();
  });
  cy.on("tap", "node", (event) => {
    const card = model?.cards.find((item) => item.id === event.target.id());
    if (!card) return;
    selectedCard = card;
    focusedCardId = card.id;
    renderDetails(card);
    applyFocus(card.id);
  });
  cy.on("tap", (event) => {
    if (event.target !== cy) return;
    focusedCardId = undefined;
    applyFocus(undefined);
  });
}

function resetGraphView(): void {
  const current = currentVisibleGraph();
  if (!current) return;
  const signature = buildGraphSignature(current.cards, current.lines);
  graphState = { lens, signature };
  renderGraph(current.cards, current.lines, "reset");
}

function currentVisibleGraph(): { cards: CabinetCard[]; lines: CabinetLine[] } | undefined {
  if (!model) return undefined;
  const cards = filterCards(model);
  const visibleIds = new Set(cards.map((card) => card.id));
  return { cards, lines: filterLines(model.lines, visibleIds) };
}

function runGraphLayout(reason: GraphLayoutReason, visibleCards: number): void {
  if (!cy) return;
  const padding = reason === "reset" ? 110 : 96;
  cy.one("layoutstop", () => fitGraphToReadableArea(visibleCards, padding));
  cy.layout(layoutForLens(lens)).run();
}

function fitGraphToReadableArea(visibleCards: number, padding: number): void {
  if (!cy || cy.elements().empty()) return;
  restoringViewport = true;
  try {
    cy.fit(undefined, padding);
    const zoom = clampReadableZoom(cy.zoom(), visibleCards);
    if (zoom !== cy.zoom()) {
      cy.zoom(zoom);
      cy.center();
    }
  } finally {
    restoringViewport = false;
  }
  rememberCurrentGraphViewport();
  renderZoomPercent();
}

function restoreGraphViewport(viewport: GraphViewport | undefined): void {
  if (!cy || !viewport) return;
  restoringViewport = true;
  try {
    cy.zoom(viewport.zoom);
    cy.pan(viewport.pan);
  } finally {
    restoringViewport = false;
  }
  renderZoomPercent();
}

function rememberCurrentGraphViewport(): void {
  if (!cy || restoringViewport) return;
  rememberGraphViewport(graphViewports, lens, {
    zoom: cy.zoom(),
    pan: cy.pan(),
  });
}

function adjustGraphZoom(delta: number): void {
  if (!cy) return;
  setGraphZoom(cy.zoom() + delta);
}

function setGraphZoom(level: number): void {
  if (!cy) return;
  const zoom = clampUserZoom(level, cy.minZoom(), cy.maxZoom());
  restoringViewport = true;
  try {
    cy.zoom(zoom);
  } finally {
    restoringViewport = false;
  }
  rememberCurrentGraphViewport();
  renderZoomPercent();
}

function renderZoomPercent(): void {
  const zoomPercent = document.getElementById("zoomPercent");
  if (!zoomPercent || !cy) return;
  zoomPercent.textContent = formatZoomPercent(cy.zoom());
}

function renderDetails(card: CabinetCard | undefined): void {
  const details = document.getElementById("details");
  if (!details) return;
  if (!card) {
    details.innerHTML = `<div class="detail-head"><div class="detail-lens">${lensNames[lens]}</div><h2 class="title">未選取卡匣</h2></div>`;
    return;
  }
  selectedCard = card;
  details.innerHTML = `
    <div class="detail-head">
      <div class="detail-lens">${lensNames[lens]}</div>
      <h2 class="title">${escapeHtml(card.title)}</h2>
      <div class="muted">${escapeHtml(card.id)}</div>
    </div>
    ${detailsForLens(card)}
    <button id="openCard" class="open-card">開啟記憶卡</button>
  `;
  document.getElementById("openCard")?.addEventListener("click", () => {
    vscode.postMessage({ type: "openCard", cardId: card.id });
  });
}

function detailsForLens(card: CabinetCard): string {
  if (lens === "memory") return memoryDetails(card);
  if (lens === "structure") return structureDetails(card);
  return maintenanceDetails(card);
}

function maintenanceDetails(card: CabinetCard): string {
  const suggestedFiles = model?.untrackedFiles
    .filter((file) => file.suggestedOwner === card.id)
    .map((file) => file.filePath) ?? [];
  return `
    <p class="description">${escapeHtml(card.description || "尚未提供卡匣說明。")}</p>
    <div class="metric-grid">
      ${metric("狀態燈", statusLabel(card))}
      ${metric("維護熱度", card.maintenanceScore)}
      ${metric("直接熱度", card.staleness)}
      ${metric("複審提醒", card.reviewScore)}
      ${metric("待同步", card.pendingChangesCount)}
      ${metric("幽靈檔", card.ghostFilesCount)}
    </div>
    ${listBlock("待同步檔案", card.pendingChanges.slice(0, 8))}
    ${listBlock("幽靈檔案", card.ghostFiles.slice(0, 8))}
    ${listBlock("未歸屬建議", suggestedFiles.slice(0, 8))}
    ${listBlock("熱度來源", card.dependencies)}
  `;
}

function memoryDetails(card: CabinetCard): string {
  return `
    <p class="description">${escapeHtml(card.description || "尚未提供卡匣說明。")}</p>
    <div class="metric-grid">
      ${metric("記憶密度", card.memoryScore)}
      ${metric("決策", card.metadata.decisions.length)}
      ${metric("經驗", card.metadata.lessons.length)}
      ${metric("概念", card.metadata.concepts.length)}
    </div>
    ${tagBlock("標籤", card.metadata.tags)}
    ${tagBlock("概念", card.metadata.concepts)}
    ${tagBlock("別名", card.metadata.aliases)}
    ${listBlock("最近決策", card.metadata.decisions)}
    ${listBlock("經驗紀錄", card.metadata.lessons)}
    ${listBlock("關聯筆記", card.metadata.relationNotes)}
  `;
}

function structureDetails(card: CabinetCard): string {
  return `
    <div class="metric-grid">
      ${metric("結構強度", card.structureScore)}
      ${metric("追蹤檔案", card.trackedFilesCount)}
      ${metric("訊號輸入", card.dependencies.length)}
      ${metric("被依賴", card.dependents.length)}
    </div>
    ${card.parent ? tagBlock("父卡", [card.parent]) : ""}
    ${tagBlock("子卡", card.children)}
    ${listBlock("追蹤檔案", card.trackedFiles.slice(0, 12))}
    ${listBlock("依賴卡匣", card.dependencies)}
    ${listBlock("被依賴卡匣", card.dependents)}
  `;
}

function applyFocus(cardId: string | undefined): void {
  if (!cy) return;
  cy.elements().removeClass("focused related dimmed inbound outbound");
  if (!cardId) return;
  const node = cy.getElementById(cardId);
  if (node.empty()) return;
  const connectedEdges = node.connectedEdges();
  const connectedNodes = connectedEdges.connectedNodes();
  cy.elements().difference(node.union(connectedEdges).union(connectedNodes)).addClass("dimmed");
  node.addClass("focused");
  connectedNodes.not(node).addClass("related");
  connectedEdges.addClass("focused");
  connectedEdges.forEach((edge) => {
    edge.addClass(edge.target().id() === cardId ? "inbound" : "outbound");
  });
}

function graphStyle(): StylesheetStyle[] {
  const lensStyles: StylesheetStyle[] =
    lens === "memory" ? memoryGraphStyle() : lens === "structure" ? structureGraphStyle() : maintenanceGraphStyle();
  return [
    {
      selector: "node",
      style: {
        "shape": "round-rectangle",
        "width": "168px",
        "height": "76px",
        "background-color": "#111c29",
        "border-width": "2px",
        "border-color": "#3a4d63",
        "label": "data(label)",
        "color": "#e8f0f5",
        "font-size": "12px",
        "font-weight": 700,
        "text-valign": "center",
        "text-halign": "center",
        "text-wrap": "wrap",
        "text-max-width": "142px",
      },
    },
    {
      selector: "edge",
      style: {
        "curve-style": "bezier",
        "target-arrow-shape": "triangle",
        "width": "2px",
        "line-color": "#3c5268",
        "target-arrow-color": "#3c5268",
        "opacity": .78,
      },
    },
    { selector: "node.dimmed, edge.dimmed", style: { "opacity": .22 } },
    { selector: "node.related", style: { "opacity": .94, "border-width": "2.2px" } },
    { selector: "node.focused", style: { "background-color": "#17283a", "border-width": "3px", "z-index": 20 } },
    { selector: "edge.focused", style: { "opacity": 1, "width": "3px", "z-index": 18 } },
    { selector: "edge.inbound", style: { "line-style": "solid" } },
    { selector: "edge.outbound", style: { "line-style": "dashed" } },
    ...lensStyles,
  ];
}

function maintenanceGraphStyle(): StylesheetStyle[] {
  return [
    { selector: "node.hot", style: { "border-color": "#ffb14a", "background-color": "#231b13" } },
    { selector: "node.review", style: { "border-color": "#55a8ff", "background-color": "#111d2e" } },
    { selector: "node.critical, node.ghost", style: { "border-color": "#ff5d64", "background-color": "#241319" } },
    { selector: "node.healthy", style: { "border-color": "#536171" } },
    { selector: "edge.heat", style: { "width": "mapData(weight, 1, 100, 2, 6)", "line-color": "#ffb14a", "target-arrow-color": "#ffb14a" } },
    { selector: "edge.signal", style: { "line-color": "#42d9c8", "target-arrow-color": "#42d9c8" } },
    { selector: "edge.slot", style: { "line-style": "dashed", "line-color": "#6b7c8f", "target-arrow-color": "#6b7c8f", "opacity": .42 } },
  ];
}

function memoryGraphStyle(): StylesheetStyle[] {
  return [
    { selector: "node.memory-rich", style: { "border-color": "#42d9c8", "background-color": "#10252b" } },
    { selector: "node.low-memory", style: { "border-color": "#a889ff", "background-color": "#181526" } },
    { selector: "edge.note", style: { "width": "2.4px", "line-color": "#a889ff", "target-arrow-color": "#a889ff" } },
    { selector: "edge.slot", style: { "line-style": "dotted", "line-color": "#566274", "target-arrow-color": "#566274", "opacity": .18 } },
  ];
}

function structureGraphStyle(): StylesheetStyle[] {
  return [
    { selector: "node.structured", style: { "border-color": "#8de38f", "background-color": "#102418" } },
    { selector: "node.parented", style: { "border-style": "double" } },
    { selector: "edge.slot", style: { "line-style": "dashed", "line-color": "#8de38f", "target-arrow-color": "#8de38f" } },
    { selector: "edge.signal", style: { "line-color": "#55a8ff", "target-arrow-color": "#55a8ff", "width": "2.2px" } },
  ];
}

function graphLabel(card: CabinetCard): string {
  const label = card.label.length > 18 ? `${card.label.slice(0, 17)}...` : card.label;
  if (lens === "memory") return `${label}\n記憶 ${card.memoryScore}`;
  if (lens === "structure") return `${label}\n檔案 ${card.trackedFilesCount}`;
  return `${label}\n熱度 ${card.maintenanceScore}`;
}

function cardClasses(card: CabinetCard): string {
  return [
    card.status,
    card.maintenanceScore > 0 ? "hot" : "",
    card.reviewScore > 0 ? "review" : "",
    card.memoryScore > 3 ? "memory-rich" : "low-memory",
    card.structureScore > 0 ? "structured" : "",
    card.parent || card.children.length > 0 ? "parented" : "",
    card.ghostFilesCount > 0 ? "ghost" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function searchableText(card: CabinetCard): string {
  return [
    card.id,
    card.title,
    card.description,
    ...card.trackedFiles,
    ...card.pendingChanges,
    ...card.ghostFiles,
    ...card.dependencies,
    ...card.dependents,
    ...card.children,
    ...card.metadata.tags,
    ...card.metadata.concepts,
    ...card.metadata.aliases,
    ...card.metadata.decisions,
    ...card.metadata.lessons,
    ...card.metadata.relationNotes,
  ]
    .join(" ")
    .toLowerCase();
}

function searchQuery(): string {
  return (document.getElementById("search") as HTMLInputElement | null)?.value.trim().toLowerCase() ?? "";
}

function statCell(value: number, label: string): string {
  return `<div class="stat-cell"><strong>${value}</strong><small>${escapeHtml(label)}</small></div>`;
}

function metric(label: string, value: number | string): string {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function tagBlock(title: string, values: string[]): string {
  if (values.length === 0) return "";
  return `<h3>${escapeHtml(title)}</h3>${values.map((value) => `<span class="pill">${escapeHtml(value)}</span>`).join("")}`;
}

function listBlock(title: string, values: string[]): string {
  if (values.length === 0) return "";
  return `<h3>${escapeHtml(title)}</h3><ul class="list">${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>`;
}

function statusLabel(card: CabinetCard): string {
  if (card.status === "critical") return "紅燈";
  if (card.status === "significant") return "橘燈";
  if (card.status === "mild") return "藍燈";
  return "綠燈";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}
