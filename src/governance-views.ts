import * as vscode from "vscode";
import { ActionItemsProvider } from "./action-items-provider.js";
import { auditContextInventory } from "./context-audit.js";
import { scanContextRegistry } from "./context-registry.js";
import { ContextTreeProvider } from "./context-tree-provider.js";
import { GovernanceTreeProvider } from "./governance-tree-provider.js";
import type { CartridgeIndexManager } from "./index-manager.js";
import { CartridgeTreeProvider } from "./treeview-provider.js";

export interface GovernanceViewsController {
  cartridgeTree: CartridgeTreeProvider;
  refresh(): void;
  dispose(): void;
}

export function registerGovernanceViews(args: {
  context: vscode.ExtensionContext;
  indexManager: CartridgeIndexManager;
  projectRoot: string;
}): GovernanceViewsController {
  const overview = new GovernanceTreeProvider(args.indexManager, args.projectRoot);
  const cartridgeTree = new CartridgeTreeProvider(args.indexManager, args.projectRoot);
  const contextTree = new ContextTreeProvider(args.projectRoot);
  const actionItems = new ActionItemsProvider(args.indexManager, args.projectRoot);
  const providers = [overview, cartridgeTree, contextTree, actionItems];

  args.context.subscriptions.push(
    vscode.window.registerTreeDataProvider("cartridgeGovernanceOverview", overview),
    vscode.window.registerTreeDataProvider("cartridgeExplorer", cartridgeTree),
    vscode.window.registerTreeDataProvider("cartridgeContextExplorer", contextTree),
    vscode.window.registerTreeDataProvider("cartridgeActionItems", actionItems),
    vscode.commands.registerCommand("cartridge.openGovernanceDashboard", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.cartridgeGovernance");
    }),
    vscode.commands.registerCommand("cartridge.refreshGovernance", () => {
      for (const provider of providers) provider.refresh();
    }),
    vscode.commands.registerCommand("cartridge.contextAudit", async () => {
      const inventory = await scanContextRegistry(args.projectRoot);
      const findings = auditContextInventory(inventory);
      const channel = vscode.window.createOutputChannel("Cartridge Context Audit");
      channel.clear();
      channel.appendLine(`Context assets: ${inventory.totals.existing}/${inventory.totals.assets}`);
      channel.appendLine(`Findings: ${findings.length}`);
      channel.appendLine("");
      for (const finding of findings) {
        channel.appendLine(`[${finding.severity}] ${finding.code}`);
        channel.appendLine(`  ${finding.message}`);
        if (finding.assets.length > 0) {
          channel.appendLine(`  assets: ${finding.assets.join(", ")}`);
        }
        channel.appendLine("");
      }
      if (findings.length === 0) channel.appendLine("No context governance findings.");
      channel.show(true);
    }),
  );

  return {
    cartridgeTree,
    refresh: () => {
      for (const provider of providers) provider.refresh();
    },
    dispose: () => {
      for (const provider of providers) provider.dispose();
    },
  };
}
