/**
 * 記憶卡匣外掛系統 — 卡匣依賴圖建構與過期傳播引擎
 */

import type { CartridgeIndex } from "./types.js";
import { scanFileImports } from "./import-resolver.js";

/** 依賴圖：卡匣 ID → 該卡匣依賴的卡匣 ID 列表 */
export type DependencyGraph = Map<string, string[]>;

/**
 * 從 import 掃描結果 + fileMap 建構卡匣間依賴圖
 *
 * 演算法：
 * 1. 對每張卡匣的每個追蹤檔案，掃描 import 語句
 * 2. 將 import 路徑透過 fileMap 反查歸屬卡匣
 * 3. 若歸屬卡匣 ≠ 來源卡匣，記錄依賴關係
 */
export function buildDependencyGraph(
  index: CartridgeIndex,
  projectRoot: string,
): DependencyGraph {
  const graph: DependencyGraph = new Map();

  for (const [cartridgeId, entry] of Object.entries(index.cartridges)) {
    const deps: Set<string> = new Set();

    for (const trackedFile of entry.trackedFiles) {
      // 跳過目錄型路徑
      if (trackedFile.endsWith("/")) continue;

      const importedFiles = scanFileImports(trackedFile, projectRoot);

      for (const importedFile of importedFiles) {
        // 從 fileMap 查詢被引用檔案屬於哪張卡匣
        const owners = index.fileMap[importedFile];
        if (!owners) continue;

        for (const owner of owners) {
          if (owner !== cartridgeId) {
            deps.add(owner);
          }
        }
      }
    }

    graph.set(cartridgeId, [...deps]);
  }

  return graph;
}

/**
 * 建構反向依賴圖（誰依賴此卡匣）
 */
export function buildReverseDependencyGraph(
  graph: DependencyGraph,
): DependencyGraph {
  const reverse: DependencyGraph = new Map();

  for (const [cartridgeId, deps] of graph.entries()) {
    if (!reverse.has(cartridgeId)) reverse.set(cartridgeId, []);
    for (const dep of deps) {
      if (!reverse.has(dep)) reverse.set(dep, []);
      reverse.get(dep)!.push(cartridgeId);
    }
  }

  return reverse;
}

/**
 * 計算間接過期傳播
 * 當卡匣 A 過期時，依賴 A 的所有卡匣會收到按深度衰減的間接過期
 *
 * @param index - 當前索引（讀取 staleness）
 * @param graph - 依賴圖（正向：A 依賴 B）
 * @param maxDepth - 傳播深度上限
 * @returns 每張卡匣的間接過期指數
 */
export function propagateStaleness(
  index: CartridgeIndex,
  graph: DependencyGraph,
  maxDepth: number,
): Map<string, number> {
  const results: Map<string, number> = new Map();
  const reverseGraph = buildReverseDependencyGraph(graph);

  // 找出所有過期的來源卡匣
  for (const [sourceId, entry] of Object.entries(index.cartridges)) {
    if (entry.staleness <= 0) continue;

    // BFS 傳播
    const visited = new Set<string>([sourceId]);
    let currentLayer = [sourceId];

    for (let depth = 1; depth <= maxDepth; depth++) {
      const nextLayer: string[] = [];
      // 衰減因子：深度越深影響越小
      const factor = 1 / depth;

      for (const nodeId of currentLayer) {
        const dependents = reverseGraph.get(nodeId) ?? [];
        for (const dependent of dependents) {
          if (visited.has(dependent)) continue;
          visited.add(dependent);
          nextLayer.push(dependent);

          const propagatedScore = Math.ceil(entry.staleness * factor);
          const current = results.get(dependent) ?? 0;
          results.set(dependent, current + propagatedScore);
        }
      }

      currentLayer = nextLayer;
      if (currentLayer.length === 0) break;
    }
  }

  return results;
}

/**
 * 偵測循環依賴
 * @returns 所有環路陣列（每個環路是卡匣 ID 的有序列表）
 */
export function detectCycles(graph: DependencyGraph): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const stack: string[] = [];

  function dfs(node: string): void {
    if (inStack.has(node)) {
      // 找到環路
      const cycleStart = stack.indexOf(node);
      cycles.push(stack.slice(cycleStart));
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    stack.push(node);

    for (const dep of graph.get(node) ?? []) {
      dfs(dep);
    }

    stack.pop();
    inStack.delete(node);
  }

  for (const node of graph.keys()) {
    dfs(node);
  }

  return cycles;
}
