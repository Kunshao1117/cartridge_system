import * as vscode from "vscode";
import { auditContextInventory } from "./context-audit.js";
import { scanContextRegistry } from "./context-registry.js";
import { buildGovernanceSummary } from "./governance-summary.js";
import type { GovernanceSummary } from "./governance-summary.js";
import type { CartridgeIndexManager } from "./index-manager.js";

type OverviewNode = {
  label: string;
  description?: string;
  status?: "ready" | "warning" | "blocked";
  command?: string;
};

export class GovernanceTreeProvider
  implements vscode.TreeDataProvider<OverviewNode>
{
  private _onDidChange = new vscode.EventEmitter<OverviewNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(
    private indexManager: CartridgeIndexManager,
    private projectRoot: string,
  ) {}

  refresh(): void {
    this._onDidChange.fire(undefined);
  }

  getTreeItem(node: OverviewNode): vscode.TreeItem {
    const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
    item.description = node.description;
    item.iconPath = this.iconFor(node.status);
    if (node.command) {
      item.command = { command: node.command, title: node.label };
    }
    return item;
  }

  async getChildren(): Promise<OverviewNode[]> {
    const inventory = await scanContextRegistry(this.projectRoot);
    const findings = auditContextInventory(inventory);
    const summary = buildGovernanceSummary({
      index: this.indexManager.getIndex(),
      inventory,
      contextFindings: findings,
    });
    return this.toNodes(summary);
  }

  dispose(): void {
    this._onDidChange.dispose();
  }

  private toNodes(summary: GovernanceSummary): OverviewNode[] {
    return [
      {
        label: `AI 開工狀態：${this.statusLabel(summary.status)}`,
        description: `${summary.context.blockers} 阻塞 / ${summary.context.warnings} 提醒`,
        status: summary.status,
        command: "cartridge.status",
      },
      {
        label: "記憶卡健康",
        description: `${summary.memory.total} 張，${summary.memory.stale} 張需更新`,
        status: summary.memory.critical > 0 ? "blocked" : summary.memory.stale > 0 ? "warning" : "ready",
        command: "cartridge.status",
      },
      {
        label: "幽靈與未歸屬",
        description: `${summary.memory.ghostFiles} 幽靈 / ${summary.memory.untrackedFiles} 未歸屬`,
        status:
          summary.memory.ghostFiles > 0 || summary.memory.untrackedFiles > 0
            ? "warning"
            : "ready",
        command: "cartridge.scanGhosts",
      },
      {
        label: "規則檔檢查",
        description: `${summary.context.existing}/${summary.context.assets} 個檔案`,
        status:
          summary.context.blockers > 0
            ? "blocked"
            : summary.context.warnings > 0
              ? "warning"
              : "ready",
        command: "cartridge.contextAudit",
      },
    ];
  }

  private iconFor(status?: "ready" | "warning" | "blocked"): vscode.ThemeIcon {
    if (status === "blocked") return new vscode.ThemeIcon("error");
    if (status === "warning") return new vscode.ThemeIcon("warning");
    return new vscode.ThemeIcon("pass");
  }

  private statusLabel(status: GovernanceSummary["status"]): string {
    if (status === "blocked") return "需要先處理";
    if (status === "warning") return "可開工但有提醒";
    return "可以開工";
  }
}
