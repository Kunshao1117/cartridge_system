/** CI-only fixture: runs the production monitor handler in a fresh OS process. */
import path from "node:path";
import { createConfig } from "../../config.js";
import { CartridgeIndexManager } from "../../index-manager.js";
import { StalenessAnalyzer } from "../../analyzer.js";
import { MemoryWriter } from "../../writer.js";
import { handleProjectFileEvent } from "../../monitoring/project-event-handler.js";
import type { GitignoreFilter } from "../../gitignore-filter.js";
import type { FileEventType } from "../../types.js";

async function main(): Promise<void> {
  const [root, source, event] = process.argv.slice(2);
  const config = createConfig(root, { scoring: { fileChanged: 10, fileDeleted: 20, fileAdded: 5, dailyDecay: 0 } });
  const indexManager = new CartridgeIndexManager(config);
  if (!await indexManager.load()) throw new Error("Missing fixture canonical index");
  const writer = new MemoryWriter(config);
  const analyzer = new StalenessAnalyzer(config, indexManager, writer);
  // Exclusion decisions are fixed; canonical index, disk content, locking and
  // production event handling are real and not shared in RAM between workers.
  const gitignoreFilter = {
    reload() {},
    async checkIgnored() { return { ignored: false, mode: "git-standard", diagnostics: [] }; },
    async discoverProjectFiles() { return { files: ["src/a.ts", "src/b.ts"], mode: "git-standard", diagnostics: [] }; },
  } as unknown as GitignoreFilter;
  for (const [file, eventType] of [[source, event], [".agents/memory/A/MEMORY.md", "change"]]) {
    await handleProjectFileEvent({ config, indexManager, writer, analyzer, gitignoreFilter,
      absFilePath: path.join(root, file), eventType: eventType as FileEventType });
  }
  const entry = indexManager.getIndex().cartridges.A;
  process.stdout.write(JSON.stringify({ pid: process.pid, pending: entry.pendingChanges, ghosts: entry.ghostFiles, staleness: entry.staleness }));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
