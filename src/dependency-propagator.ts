/**
 * 記憶卡匣外掛系統 — 卡匣依賴圖建構與過期傳播引擎
 */

import fs from "node:fs";
import path from "node:path";
import matter from "./safe-frontmatter.js";
import { assertPathInsideProject } from "./file-containment.js";
import { resolveMemoryMainFileInDirectorySync } from "./memory-main-file.js";
import { createConfig } from "./config.js";
import type { CartridgeConfig, CartridgeEntry, CartridgeIndex } from "./types.js";
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
      if (!reverse.get(dep)!.includes(cartridgeId)) reverse.get(dep)!.push(cartridgeId);
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
      const factor = 1 / (depth * depth);

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

export interface DependencyStateResult {
  engineeringGraph: DependencyGraph;
  propagationGraph: DependencyGraph;
  diagnostics: Array<{ module: string; code: string; dependency: string; message: string }>;
}

/** Only explicit declarations and import-derived edges participate in propagation. */
export function buildPropagationGraph(
  index: CartridgeIndex,
  engineeringGraph: DependencyGraph,
  declarations: ReadonlyMap<string, readonly string[]> = new Map(),
): Pick<DependencyStateResult, "propagationGraph" | "diagnostics"> {
  const propagationGraph: DependencyGraph = new Map();
  const diagnostics: DependencyStateResult["diagnostics"] = [];
  for (const [module, entry] of Object.entries(index.cartridges)) {
    const declared = declarations.get(module) ?? entry.declaredDependencies ?? entry.dependencies ?? [];
    const edges = new Set<string>();
    const seen = new Set<string>();
    for (const dependency of declared) {
      if (seen.has(dependency)) {
        diagnostics.push({ module, code: "DEPENDENCY_DUPLICATE", dependency,
          message: `Duplicate dependency "${dependency}" is counted once.` });
      }
      seen.add(dependency);
      if (dependency === module) {
        diagnostics.push({ module, code: "DEPENDENCY_SELF", dependency,
          message: `Self dependency "${dependency}" is not propagated.` });
      } else if (!Object.hasOwn(index.cartridges, dependency)) {
        diagnostics.push({ module, code: "DEPENDENCY_TARGET_UNKNOWN", dependency,
          message: `Declared dependency "${dependency}" has no indexed card.` });
      } else {
        edges.add(dependency);
      }
    }
    for (const dependency of engineeringGraph.get(module) ?? []) {
      if (dependency !== module && Object.hasOwn(index.cartridges, dependency)) edges.add(dependency);
    }
    propagationGraph.set(module, [...edges]);
  }
  for (const cycle of detectCycles(propagationGraph)) {
    for (const module of cycle) {
      diagnostics.push({ module, code: "DEPENDENCY_CYCLE", dependency: module,
        message: `Dependency cycle is depth-bounded and counted once per source: ${cycle.join(" -> ")}.` });
    }
  }
  return { propagationGraph, diagnostics };
}

/**
 * Compute before replacing any derived fields. A thrown parser/I/O/import error
 * leaves all previously trusted edges and indirect scores intact. Callers doing
 * a commit supply that card's freshly parsed declarations explicitly; scans keep
 * fresh declarations as overrides. All other cards are read afresh, so an event
 * arriving before the card watcher cannot propagate a stale declaration.
 */
export function recomputeDependencyState(
  index: CartridgeIndex,
  projectRoot: string,
  maxDepth: number,
  overrides: ReadonlyMap<string, readonly string[]> = new Map(),
  roots: Pick<CartridgeConfig, "memoryDir" | "skillsDir"> = createConfig(projectRoot),
): DependencyStateResult {
  const declarations = new Map<string, string[]>();
  for (const [module, entry] of Object.entries(index.cartridges)) {
    const provided = overrides.get(module);
    if (provided !== undefined) {
      declarations.set(module, normalizeDeclaredDependencies(provided));
      continue;
    }
    if (entry.mainFile?.type === "conflict" || entry.mainFile?.type === "missing") {
      declarations.set(module, []);
      continue;
    }
    const candidate = entry.mainFile?.activePath ?? entry.skillPath;
    if (!/^(MEMORY|SKILL)\.md$/.test(path.basename(candidate))) {
      throw new Error(`Invalid memory main file for dependency declarations: ${module}`);
    }
    const safe = assertPathInsideProject(projectRoot, candidate);
    const allowed = (root: string, legacy: boolean): boolean => {
      const absoluteRoot = assertPathInsideProject(projectRoot, root);
      if (!fs.existsSync(absoluteRoot) || !fs.existsSync(safe)) return false;
      const parts = path.relative(absoluteRoot, safe).split(path.sep);
      if (parts.length < 2 || parts.includes("..") || path.isAbsolute(path.relative(absoluteRoot, safe)) ||
          parts.slice(0, -1).some((part) => part.toLowerCase() === "archive") ||
          (legacy && !parts[0].startsWith("mem-"))) return false;
      // Fail closed for links whose target escapes the configured card root.
      const physicalRelative = path.relative(fs.realpathSync(absoluteRoot), fs.realpathSync(safe));
      return physicalRelative !== ".." && !physicalRelative.startsWith(`..${path.sep}`) && !path.isAbsolute(physicalRelative);
    };
    if (!allowed(roots.memoryDir, false) && !allowed(roots.skillsDir, true)) {
      throw new Error(`Dependency main file is outside configured memory roots: ${module}`);
    }
    const resolution = resolveMemoryMainFileInDirectorySync(projectRoot, path.dirname(safe));
    if (!resolution.mainFile.activePath) {
      throw new Error(`Cannot resolve dependency declarations for ${module}: ${resolution.mainFile.type}`);
    }
    const raw = fs.readFileSync(assertPathInsideProject(projectRoot, resolution.mainFile.activePath), "utf8");
    declarations.set(module, normalizeDeclaredDependencies(matter(raw).data.dependencies));
  }
  const engineeringGraph = buildDependencyGraph(index, projectRoot);
  const { propagationGraph, diagnostics } = buildPropagationGraph(index, engineeringGraph, declarations);
  const scores = propagateStaleness(index, propagationGraph, maxDepth);
  const updates: Array<{ entry: CartridgeEntry; fields: Partial<CartridgeEntry> }> = [];
  for (const [module, entry] of Object.entries(index.cartridges)) {
    const declaredDependencies = declarations.get(module) ?? [];
    const engineeringDependencies = engineeringGraph.get(module) ?? [];
    // Stage every field, including diagnostic processing, before mutating any
    // entry. A malformed optional field cannot half-publish a derived snapshot.
    if (entry.dependencyDiagnostics !== undefined && !Array.isArray(entry.dependencyDiagnostics)) {
      throw new Error(`Invalid dependency diagnostics for ${module}`);
    }
    const dependencyDiagnostics = [
      ...(entry.dependencyDiagnostics ?? []).filter((item) => !GRAPH_DIAGNOSTIC_CODES.has(item.code)),
      ...diagnostics.filter((item) => item.module === module).map((item) => ({ code: item.code, dependency: item.dependency, message: item.message })),
    ];
    updates.push({ entry, fields: {
      declaredDependencies, engineeringDependencies,
      // Unknown declarations remain public without inventing graph nodes.
      dependencies: [...new Set([...engineeringDependencies, ...declaredDependencies])],
      indirectStaleness: scores.get(module) ?? 0,
      dependencyDiagnostics,
    } });
  }
  for (const { entry, fields } of updates) {
    Object.assign(entry, fields);
    delete entry.dependencySyncWarning;
  }
  return { engineeringGraph, propagationGraph, diagnostics };
}

const GRAPH_DIAGNOSTIC_CODES = new Set([
  "DEPENDENCY_DUPLICATE", "DEPENDENCY_SELF", "DEPENDENCY_TARGET_UNKNOWN", "DEPENDENCY_CYCLE",
]);

export function normalizeDeclaredDependencies(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error("Memory dependencies must be an array of card IDs.");
  }
  return value.map((item: string) => item.trim()).filter(Boolean);
}
