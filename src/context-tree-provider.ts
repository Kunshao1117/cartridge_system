import * as path from "node:path";
import * as vscode from "vscode";
import { auditContextInventory } from "./context-audit.js";
import { scanContextRegistry } from "./context-registry.js";
import type {
  ContextAsset,
  ContextAuditFinding,
  ContextInventory,
} from "./context-types.js";

type ContextNode =
  | { kind: "empty"; label: string }
  | { kind: "section"; label: string; severity: ContextAuditFinding["severity"] }
  | { kind: "finding"; finding: ContextAuditFinding; targetPath?: string }
  | { kind: "asset"; asset: ContextAsset };

export class ContextTreeProvider implements vscode.TreeDataProvider<ContextNode> {
  private _onDidChange = new vscode.EventEmitter<ContextNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(private projectRoot: string) {}

  refresh(): void {
    this._onDidChange.fire(undefined);
  }

  getTreeItem(node: ContextNode): vscode.TreeItem {
    if (node.kind === "section") return this.sectionItem(node);
    if (node.kind === "finding") return this.findingItem(node);
    if (node.kind === "asset") return this.assetItem(node.asset);
    return new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
  }

  async getChildren(node?: ContextNode): Promise<ContextNode[]> {
    const inventory = await scanContextRegistry(this.projectRoot);
    const findings = auditContextInventory(inventory);
    if (!node) return this.rootNodes(findings);
    if (node.kind === "section") return this.findingNodes(inventory, findings, node.severity);
    if (node.kind === "finding") return this.assetNodes(inventory, node.finding);
    return [];
  }

  dispose(): void {
    this._onDidChange.dispose();
  }

  private rootNodes(findings: ContextAuditFinding[]): ContextNode[] {
    if (findings.length === 0) return [{ kind: "empty", label: "規則檔檢查：可以開工" }];
    return (["error", "warning", "info"] as const)
      .filter((severity) => findings.some((item) => item.severity === severity))
      .map((severity) => ({
        kind: "section",
        severity,
        label: this.sectionLabel(severity, findings),
      }));
  }

  private findingNodes(
    inventory: ContextInventory,
    findings: ContextAuditFinding[],
    severity: ContextAuditFinding["severity"],
  ): ContextNode[] {
    const assetById = new Map(inventory.assets.map((asset) => [asset.id, asset]));
    return findings
      .filter((finding) => finding.severity === severity)
      .map((finding) => ({
        kind: "finding",
        finding,
        targetPath: finding.assets
          .map((id) => assetById.get(id))
          .find((asset) => asset?.exists)?.path,
      }));
  }

  private assetNodes(
    inventory: ContextInventory,
    finding: ContextAuditFinding,
  ): ContextNode[] {
    const assetById = new Map(inventory.assets.map((asset) => [asset.id, asset]));
    return finding.assets
      .map((id) => assetById.get(id))
      .filter((asset): asset is ContextAsset => Boolean(asset))
      .map((asset) => ({ kind: "asset", asset }));
  }

  private sectionItem(node: Extract<ContextNode, { kind: "section" }>) {
    const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.Expanded);
    item.iconPath = new vscode.ThemeIcon(
      node.severity === "error"
        ? "error"
        : node.severity === "warning"
          ? "warning"
          : "info",
    );
    return item;
  }

  private findingItem(node: Extract<ContextNode, { kind: "finding" }>) {
    const item = new vscode.TreeItem(
      node.finding.message,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    item.description = node.finding.code;
    item.tooltip = [node.finding.explanation, node.finding.recommendedAction]
      .filter(Boolean)
      .join("\n");
    if (node.targetPath) this.setOpenCommand(item, node.targetPath);
    return item;
  }

  private assetItem(asset: ContextAsset) {
    const item = new vscode.TreeItem(asset.id, vscode.TreeItemCollapsibleState.None);
    item.description = asset.path;
    item.tooltip = `${asset.owner} / ${asset.type} / priority=${asset.priority}`;
    if (asset.exists) this.setOpenCommand(item, asset.path);
    return item;
  }

  private setOpenCommand(item: vscode.TreeItem, relativePath: string): void {
    item.command = {
      command: "vscode.open",
      title: "開啟上下文檔案",
      arguments: [vscode.Uri.file(path.resolve(this.projectRoot, relativePath))],
    };
  }

  private sectionLabel(
    severity: ContextAuditFinding["severity"],
    findings: ContextAuditFinding[],
  ): string {
    const count = findings.filter((item) => item.severity === severity).length;
    if (severity === "error") return `需要先處理 (${count})`;
    if (severity === "warning") return `建議檢查 (${count})`;
    return `資訊提醒 (${count})`;
  }
}
