import path from "node:path";
import type { CartridgeIndex } from "./types.js";
import { suggestOwner } from "./smart-owner.js";

/** Prepare a reviewable instruction. Selecting a suggestion does not mutate tracking. */
export async function createAttributionGuidance(args: {
  projectRoot: string;
  filePath: string;
  index: CartridgeIndex;
  choose: (choices: Array<{ id: string; label: string }>) => PromiseLike<string | undefined>;
}): Promise<{ message: string; prompt: string; targetPath: string | null } | null> {
  const relative = path.relative(args.projectRoot, args.filePath);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("檔案不在目前專案內。");
  const filePath = relative.replace(/\\/g, "/");
  const suggested = suggestOwner(filePath, args.index);
  const id = await args.choose(Object.keys(args.index.cartridges).map(id => ({ id, label: id === suggested ? `⭐ ${id} (推薦)` : id })));
  if (!id) return null;
  const entry = args.index.cartridges[id];
  if (!entry) throw new Error("找不到選定的記憶卡，請重新選擇。");
  const mainType = entry.mainFile?.type ?? entry.mainFileType;
  return {
    message: `已選擇歸屬建議 [${id}]，尚未修改 ${filePath} 的 Tracked Files。`,
    prompt: `請先比較 ${filePath} 的 owner/scope 與記憶卡 ${id}（${entry.skillPath}）。此歸屬建議尚未套用；確認適用且已獲授權後，才將來源加入 Tracked Files。需同步時另行執行已授權的 memory_commit 並檢查 synchronizationComplete 與 findings；不要只修改索引或宣稱已完成。`,
    targetPath: mainType === "conflict" || mainType === "missing" ? null : entry.mainFile?.activePath ?? entry.skillPath,
  };
}
