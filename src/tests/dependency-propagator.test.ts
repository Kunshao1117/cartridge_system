/**
 * 記憶卡匣外掛系統 — 依賴傳播引擎單元測試
 */

import { describe, it, expect } from "vitest";
import {
  buildReverseDependencyGraph,
  propagateStaleness,
  detectCycles,
} from "../dependency-propagator.js";
import type { CartridgeIndex } from "../types.js";
import type { DependencyGraph } from "../dependency-propagator.js";

// 輔助函式：建構測試用圖
function makeGraph(edges: Record<string, string[]>): DependencyGraph {
  return new Map(Object.entries(edges));
}

function makeIndex(
  cards: Record<string, { staleness: number }>,
): CartridgeIndex {
  const cartridges: Record<string, CartridgeIndex["cartridges"][string]> = {};
  for (const [id, { staleness }] of Object.entries(cards)) {
    cartridges[id] = {
      skillPath: "",
      description: "",
      trackedFiles: [],
      staleness,
      lastUpdated: "",
      pendingChanges: [],
      ghostFiles: [],
      dependencies: [],
      indirectStaleness: 0,
      depth: 1,
      parent: null,
    };
  }
  return {
    version: 1,
    lastScanned: "",
    cartridges,
    fileMap: {},
    untrackedFiles: [],
  };
}

describe("buildReverseDependencyGraph — 反向圖建構", () => {
  it("正確反轉依賴方向", () => {
    const graph = makeGraph({ A: ["B", "C"], B: ["C"], C: [] });
    const reverse = buildReverseDependencyGraph(graph);
    expect(reverse.get("C")).toEqual(expect.arrayContaining(["A", "B"]));
    expect(reverse.get("B")).toEqual(["A"]);
  });
});

describe("propagateStaleness — 過期傳播", () => {
  it("1 層傳播：B 過期 → 依賴 B 的 A 收到間接過期", () => {
    const graph = makeGraph({ A: ["B"], B: [] });
    const index = makeIndex({ A: { staleness: 0 }, B: { staleness: 10 } });
    const result = propagateStaleness(index, graph, 2);
    // A 依賴 B，B 過期 → A 收到間接過期
    expect(result.get("A")).toBeGreaterThan(0);
  });

  it("深度限制：maxDepth=1 時只有直接依賴者收到傳播", () => {
    const graph = makeGraph({ A: ["B"], B: ["C"], C: [] });
    const index = makeIndex({
      A: { staleness: 0 },
      B: { staleness: 0 },
      C: { staleness: 20 },
    });
    // maxDepth=1 → 只有 B（直接依賴 C）收到，A 不受影響
    const result = propagateStaleness(index, graph, 1);
    expect(result.get("B")).toBeGreaterThan(0);
    expect(result.has("A")).toBe(false);
  });

  it("深度 2 傳播應使用平方衰減", () => {
    const graph = makeGraph({ A: ["B"], B: ["C"], C: [] });
    const index = makeIndex({
      A: { staleness: 0 },
      B: { staleness: 0 },
      C: { staleness: 20 },
    });
    const result = propagateStaleness(index, graph, 2);
    expect(result.get("B")).toBe(20);
    expect(result.get("A")).toBe(5);
  });

  it("無過期卡匣時回傳空 Map", () => {
    const graph = makeGraph({ A: ["B"], B: [] });
    const index = makeIndex({ A: { staleness: 0 }, B: { staleness: 0 } });
    const result = propagateStaleness(index, graph, 2);
    expect(result.size).toBe(0);
  });
});

describe("detectCycles — 循環偵測", () => {
  it("無循環時回傳空陣列", () => {
    const graph = makeGraph({ A: ["B"], B: ["C"], C: [] });
    expect(detectCycles(graph)).toEqual([]);
  });

  it("偵測到直接循環", () => {
    const graph = makeGraph({ A: ["B"], B: ["A"] });
    const cycles = detectCycles(graph);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it("偵測到三角循環", () => {
    const graph = makeGraph({ A: ["B"], B: ["C"], C: ["A"] });
    const cycles = detectCycles(graph);
    expect(cycles.length).toBeGreaterThan(0);
  });
});
