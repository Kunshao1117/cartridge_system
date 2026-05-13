export interface PreflightCartridgeEntry {
  staleness?: number;
  ghostFiles?: unknown[];
  indirectStaleness?: number;
}

export interface PreflightIndex {
  cartridges?: Record<string, PreflightCartridgeEntry>;
  untrackedFiles?: unknown[];
}

export interface GitStatusEntry {
  raw: string;
  index: string;
  workingTree: string;
  path: string;
  category: "tracked" | "untracked";
}

type Blocker = {
  type:
    | "memory_stale"
    | "memory_ghost_files"
    | "memory_untracked_files"
    | "memory_indirect_stale"
    | "git_dirty";
  target: string;
  reason: string;
};

type RecommendedAction = {
  priority: "P1" | "P2";
  action: string;
  target: string;
  reason: string;
};

export function parseGitStatusPorcelain(output: string): GitStatusEntry[] {
  return output
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const rawPath = line.slice(3);
      const path = rawPath.includes(" -> ")
        ? rawPath.split(" -> ").at(-1) ?? rawPath
        : rawPath;
      return {
        raw: line,
        index: line[0] ?? " ",
        workingTree: line[1] ?? " ",
        path,
        category: line.startsWith("??") ? "untracked" : "tracked",
      };
    });
}

function buildMemoryGate(index: PreflightIndex) {
  const entries = Object.entries(index.cartridges ?? {});
  const staleModules = entries
    .filter(([, entry]) => (entry.staleness ?? 0) > 0)
    .map(([module, entry]) => ({
      module,
      staleness: entry.staleness ?? 0,
    }));
  const ghostModules = entries
    .filter(([, entry]) => (entry.ghostFiles?.length ?? 0) > 0)
    .map(([module, entry]) => ({
      module,
      ghostFiles: entry.ghostFiles?.length ?? 0,
    }));
  const indirectStaleModules = entries
    .filter(([, entry]) => (entry.indirectStaleness ?? 0) > 0)
    .map(([module, entry]) => ({
      module,
      indirectStaleness: entry.indirectStaleness ?? 0,
    }));
  const untrackedFiles = index.untrackedFiles?.length ?? 0;
  const blockers: Blocker[] = [
    ...staleModules.map((item) => ({
      type: "memory_stale" as const,
      target: item.module,
      reason: `staleness=${item.staleness}`,
    })),
    ...ghostModules.map((item) => ({
      type: "memory_ghost_files" as const,
      target: item.module,
      reason: `ghostFiles=${item.ghostFiles}`,
    })),
    ...indirectStaleModules.map((item) => ({
      type: "memory_indirect_stale" as const,
      target: item.module,
      reason: `indirectStaleness=${item.indirectStaleness}`,
    })),
  ];
  if (untrackedFiles > 0) {
    blockers.push({
      type: "memory_untracked_files",
      target: "workspace",
      reason: `untrackedFiles=${untrackedFiles}`,
    });
  }
  return {
    summary: {
      stale: staleModules.length,
      ghostFiles: ghostModules.reduce((sum, item) => sum + item.ghostFiles, 0),
      untrackedFiles,
      indirectStale: indirectStaleModules.length,
    },
    blockers,
  };
}

function buildGitGate(entries: GitStatusEntry[]) {
  const tracked = entries.filter((entry) => entry.category === "tracked");
  const untracked = entries.filter((entry) => entry.category === "untracked");
  const staged = tracked.filter((entry) => entry.index !== " ");
  const unstaged = tracked.filter((entry) => entry.workingTree !== " ");
  const blockers: Blocker[] = entries.length
    ? [
        {
          type: "git_dirty",
          target: "workspace",
          reason: `dirtyFiles=${entries.length}`,
        },
      ]
    : [];
  return {
    summary: {
      dirty: entries.length > 0,
      modified: tracked.length,
      untracked: untracked.length,
      staged: staged.length,
      unstaged: unstaged.length,
      files: entries.map((entry) => ({
        path: entry.path,
        status: `${entry.index}${entry.workingTree}`,
        category: entry.category,
      })),
    },
    blockers,
  };
}

function buildRecommendedActions(
  memory: ReturnType<typeof buildMemoryGate>,
  git: ReturnType<typeof buildGitGate>,
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  for (const blocker of memory.blockers) {
    actions.push({
      priority: blocker.type === "memory_stale" ? "P2" : "P1",
      action:
        blocker.type === "memory_stale"
          ? "repair_stale_memory"
          : "repair_memory_health",
      target: blocker.target,
      reason: blocker.reason,
    });
  }
  if (git.summary.dirty) {
    actions.push({
      priority: "P1",
      action: "review_dirty_files",
      target: "workspace",
      reason: "提交前需確認哪些檔案屬於本次變更",
    });
  }
  return actions.sort((a, b) => a.priority.localeCompare(b.priority));
}

function buildSuggestedCommands() {
  return [
    "git status --short",
    "npx gitnexus detect-changes --scope all",
    "npx vitest run",
    "npx tsc --noEmit",
    "npx eslint src/ --format json",
    "npx tsup --config tsup.config.ts",
  ];
}

export function buildCommitPreflight(
  index: PreflightIndex,
  gitStatus: GitStatusEntry[],
) {
  const memory = buildMemoryGate(index);
  const git = buildGitGate(gitStatus);
  const blockers = [...memory.blockers, ...git.blockers];
  return {
    status: blockers.length > 0 ? "blocked" : "ready",
    summary: {
      memory: memory.summary,
      git: git.summary,
    },
    blockers,
    recommendedActions: buildRecommendedActions(memory, git),
    suggestedCommands: buildSuggestedCommands(),
  };
}
