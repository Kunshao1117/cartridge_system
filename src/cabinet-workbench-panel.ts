import * as vscode from "vscode";
import path from "node:path";
import type { CartridgeIndexManager } from "./index-manager.js";
import { buildCabinetWorkbenchHtml } from "./cabinet-workbench-html.js";
import { buildCabinetWorkbenchModelForProject } from "./cabinet-workbench-model.js";

type PanelArgs = {
  extensionUri: vscode.Uri;
  indexManager: CartridgeIndexManager;
  projectRoot: string;
};

export class CabinetWorkbenchPanel {
  private panel?: vscode.WebviewPanel;

  constructor(private readonly args: PanelArgs) {}

  open(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      void this.postModel();
      return;
    }
    this.panel = vscode.window.createWebviewPanel(
      "cartridgeCabinetWorkbench",
      "卡匣機櫃",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.args.extensionUri, "dist"),
          vscode.Uri.joinPath(this.args.extensionUri, "assets"),
        ],
      },
    );
    this.panel.iconPath = vscode.Uri.joinPath(this.args.extensionUri, "assets", "logo.png");
    this.panel.webview.html = buildCabinetWorkbenchHtml({
      cspSource: this.panel.webview.cspSource,
      nonce: nonce(),
      scriptUri: this.panel.webview.asWebviewUri(
        vscode.Uri.joinPath(this.args.extensionUri, "dist", "cabinet-webview.global.js"),
      ).toString(),
    });
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
    this.panel.webview.onDidReceiveMessage((message: { type?: string; cardId?: string }) => {
      if (message.type === "ready" || message.type === "refresh") void this.postModel();
      if (message.type === "openCard" && message.cardId) void this.openCard(message.cardId);
    });
  }

  refresh(): void {
    if (this.panel) void this.postModel();
  }

  dispose(): void {
    this.panel?.dispose();
  }

  private async postModel(): Promise<void> {
    if (!this.panel) return;
    const model = await buildCabinetWorkbenchModelForProject(
      this.args.indexManager.getIndex(),
      this.args.projectRoot,
    );
    await this.panel.webview.postMessage({ type: "model", model });
  }

  private async openCard(cardId: string): Promise<void> {
    const entry = this.args.indexManager.getIndex().cartridges[cardId];
    if (!entry) return;
    await vscode.commands.executeCommand(
      "vscode.open",
      vscode.Uri.file(path.resolve(this.args.projectRoot, entry.skillPath)),
    );
  }
}

function nonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
