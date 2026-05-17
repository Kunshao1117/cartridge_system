import * as path from "node:path";
import * as vscode from "vscode";
import { buildGovernanceActionItems } from "./action-items-model.js";
import type { GovernanceActionItem } from "./action-items-model.js";
import { auditContextInventory } from "./context-audit.js";
import { scanContextRegistry } from "./context-registry.js";
import type { CartridgeIndexManager } from "./index-manager.js";

type ActionNode = GovernanceActionItem | { kind: "empty"; label: string };

export class ActionItemsProvider implements vscode.TreeDataProvider<ActionNode> {
  private _onDidChange = new vscode.EventEmitter<ActionNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(
    private indexManager: CartridgeIndexManager,
    private projectRoot: string,
  ) {}

  refresh(): void {
    this._onDidChange.fire(undefined);
  }

  getTreeItem(node: ActionNode): vscode.TreeItem {
    if (node.kind === "empty") {
      return new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
    }
    const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
    item.description = node.description;
    item.tooltip = [node.reason, node.recommendedAction].filter(Boolean).join("\n");
    item.iconPath = this.iconFor(node);
    this.attachCommand(item, node);
    return item;
  }

  async getChildren(): Promise<ActionNode[]> {
    const inventory = await scanContextRegistry(this.projectRoot);
    const findings = auditContextInventory(inventory);
    const items = buildGovernanceActionItems({
      index: this.indexManager.getIndex(),
      inventory,
      contextFindings: findings,
    });
    return items.length > 0 ? items : [{ kind: "empty", label: "目前沒有待處理項目" }];
  }

  dispose(): void {
    this._onDidChange.dispose();
  }

  private attachCommand(item: vscode.TreeItem, node: GovernanceActionItem): void {
    if (node.kind === "ghost") {
      item.command = {
        command: "cartridge.showGhostFileInfo",
        title: "查看幽靈檔案報告",
        arguments: [{ filePath: node.affectedPath ?? node.label, cartridgeId: node.cartridgeId }],
      };
      return;
    }
    if (!node.targetPath) return;
    const command = node.kind === "untracked" ? "cartridge.attributeFile" : "vscode.open";
    item.command = {
      command,
      title: node.kind === "untracked" ? "歸屬到記憶卡" : "開啟檔案",
      arguments: [vscode.Uri.file(path.resolve(this.projectRoot, node.targetPath))],
    };
  }

  private iconFor(node: GovernanceActionItem): vscode.ThemeIcon {
    if (node.severity === "error") return new vscode.ThemeIcon("error");
    if (node.kind === "context") return new vscode.ThemeIcon("symbol-event");
    if (node.kind === "ghost") return new vscode.ThemeIcon("warning");
    if (node.kind === "untracked") return new vscode.ThemeIcon("question");
    return new vscode.ThemeIcon("pulse");
  }
}
