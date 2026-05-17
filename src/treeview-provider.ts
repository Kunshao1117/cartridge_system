/**
 * 記憶卡匣外掛系統 — 側邊欄 TreeView 面板
 * 以樹狀結構展示記憶卡匣、追蹤檔案與幽靈池
 */

import * as vscode from "vscode";
import path from "node:path";
import type { CartridgeIndex } from "./types.js";
import type { CartridgeIndexManager } from "./index-manager.js";

type ItemType = "cartridge" | "file" | "ghost-header" | "ghost-file";

class CartridgeTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly itemType: ItemType,
    collapsible: vscode.TreeItemCollapsibleState,
    public readonly meta?: { cartridgeId?: string; filePath?: string },
  ) {
    super(label, collapsible);
  }
}

/**
 * 記憶卡匣 TreeView 資料提供者
 */
export class CartridgeTreeProvider implements vscode.TreeDataProvider<CartridgeTreeItem> {
  private _onDidChange = new vscode.EventEmitter<
    CartridgeTreeItem | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(
    private indexManager: CartridgeIndexManager,
    private projectRoot: string,
  ) {}

  /** 觸發 TreeView 全量刷新 */
  refresh(): void {
    this._onDidChange.fire(undefined);
  }

  getTreeItem(el: CartridgeTreeItem): vscode.TreeItem {
    return el;
  }

  getChildren(el?: CartridgeTreeItem): CartridgeTreeItem[] {
    const index = this.indexManager.getIndex();
    if (!el) return this.getRootItems(index);
    if (el.itemType === "cartridge")
      return this.getCartridgeChildren(el, index);
    if (el.itemType === "ghost-header") return this.getGhostChildren(index);
    return [];
  }

  /** 根節點：depth=1 的記憶卡 + 幽靈池標題 */
  private getRootItems(index: CartridgeIndex): CartridgeTreeItem[] {
    const items: CartridgeTreeItem[] = [];
    for (const [id, entry] of Object.entries(index.cartridges)) {
      if (entry.depth !== 1) continue;
      const icon = this.stalenessIcon(entry.staleness);
      const item = new CartridgeTreeItem(
        `${icon} ${id}`,
        "cartridge",
        vscode.TreeItemCollapsibleState.Collapsed,
        { cartridgeId: id },
      );
      item.tooltip = `過期指數: ${entry.staleness} | 追蹤 ${entry.trackedFiles.length} 個檔案`;
      item.command = {
        command: "vscode.open",
        title: "開啟記憶卡",
        arguments: [vscode.Uri.file(path.resolve(this.projectRoot, entry.skillPath))],
      };
      items.push(item);
    }

    const ghostCount = index.untrackedFiles?.length ?? 0;
    if (ghostCount > 0) {
      items.push(
        new CartridgeTreeItem(
          `👻 幽靈池 (${ghostCount})`,
          "ghost-header",
          vscode.TreeItemCollapsibleState.Collapsed,
        ),
      );
    }
    return items;
  }

  /** 卡片子節點：子卡 + 追蹤檔案 */
  private getCartridgeChildren(
    el: CartridgeTreeItem,
    index: CartridgeIndex,
  ): CartridgeTreeItem[] {
    const id = el.meta?.cartridgeId;
    if (!id) return [];
    const items: CartridgeTreeItem[] = [];

    // 子卡
    for (const [childId, childEntry] of Object.entries(index.cartridges)) {
      if (childEntry.parent !== id) continue;
      const icon = this.stalenessIcon(childEntry.staleness);
      const item = new CartridgeTreeItem(
        `${icon} ${childId.split(".").pop()}`,
        "cartridge",
        vscode.TreeItemCollapsibleState.Collapsed,
        { cartridgeId: childId },
      );
      item.tooltip = `過期指數: ${childEntry.staleness} | 追蹤 ${childEntry.trackedFiles.length} 個檔案`;
      item.command = {
        command: "vscode.open",
        title: "開啟記憶卡",
        arguments: [
          vscode.Uri.file(path.resolve(this.projectRoot, childEntry.skillPath)),
        ],
      };
      items.push(item);
    }

    // 追蹤檔案
    const entry = index.cartridges[id];
    if (entry) {
      for (const f of entry.trackedFiles) {
        const isGhost = entry.ghostFiles?.includes(f) ?? false;
        const item = new CartridgeTreeItem(
          isGhost ? `💀 ${path.basename(f)}` : path.basename(f),
          "file",
          vscode.TreeItemCollapsibleState.None,
          { filePath: f },
        );
        if (isGhost) {
          item.tooltip = `⚠️ 此檔案已從磁碟刪除，仍登記於追蹤清單。點擊查看修復指引。`;
          item.command = {
            command: "cartridge.showGhostFileInfo",
            title: "查看幽靈檔案報告",
            arguments: [{ filePath: f, cartridgeId: id }],
          };
        } else {
          item.command = {
            command: "vscode.open",
            title: "開啟檔案",
            arguments: [vscode.Uri.file(path.resolve(this.projectRoot, f))],
          };
          item.tooltip = f;
        }
        items.push(item);
      }
    }
    return items;
  }

  /** 幽靈池子節點 */
  private getGhostChildren(index: CartridgeIndex): CartridgeTreeItem[] {
    return (index.untrackedFiles ?? []).map((entry) => {
      const item = new CartridgeTreeItem(
        `👻 ${entry.filePath}`,
        "ghost-file",
        vscode.TreeItemCollapsibleState.None,
        { filePath: entry.filePath },
      );
      item.tooltip = entry.suggestedOwner
        ? `建議歸屬: ${entry.suggestedOwner}`
        : "無匹配的記憶卡";
      return item;
    });
  }

  /** 過期指數 → 圖示對應 */
  private stalenessIcon(s: number): string {
    if (s >= 100) return "🔴";
    if (s >= 60) return "🟠";
    if (s >= 30) return "🟡";
    if (s >= 10) return "🔵";
    return "🟢";
  }

  /** 釋放資源 */
  dispose(): void {
    this._onDidChange.dispose();
  }
}
