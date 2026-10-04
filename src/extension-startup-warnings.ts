import type { CartridgeConfig } from "./types.js";
import type { CartridgeIndexManager } from "./index-manager.js";
import type { MemoryWriter } from "./writer.js";
import { runProjectIndexTransaction } from "./project-index-transaction.js";

/** Source warning writes participate in the same lock as MCP commits and watchers. */
export async function injectExtensionStartupWarnings(args: {
  config: CartridgeConfig;
  indexManager: CartridgeIndexManager;
  writer: MemoryWriter;
  isActive: () => boolean;
}): Promise<void> {
  await runProjectIndexTransaction({
    projectRoot: args.config.projectRoot,
    indexManager: args.indexManager,
    mutation: async () => {
      for (const entry of Object.values(args.indexManager.getIndex().cartridges)) {
        if (!args.isActive()) return;
        const mainType = entry.mainFile?.type ?? entry.mainFileType;
        if (mainType === "conflict" || mainType === "missing" || entry.idConflictPaths?.length) continue;
        if (entry.staleness >= args.config.thresholds.significant && entry.pendingChanges.length > 0) {
          await args.writer.injectWarning(entry.mainFile?.activePath ?? entry.skillPath, entry.pendingChanges.map(change => change.filePath), entry.staleness);
        }
      }
    },
  });
}
