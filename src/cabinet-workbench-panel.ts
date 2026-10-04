import * as vscode from "vscode";
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
  private requestSequence = 0;

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
    const panel = this.panel;
    panel.onDidDispose(() => {
      if (this.panel === panel) {
        this.panel = undefined;
        this.requestSequence++;
      }
    });
    this.panel.webview.onDidReceiveMessage((message: { type?: string; cardId?: string }) => {
      if (message.type === "ready" || message.type === "refresh") void this.postModel();
      if (message.type === "openCard" && message.cardId) void this.openCard(message.cardId).catch(error => {
        if (this.panel === panel) void vscode.window.showWarningMessage(`開啟記憶卡失敗：${String(error)}`);
      });
    });
  }

  refresh(): Promise<void> {
    return this.postModel();
  }

  dispose(): void {
    this.panel?.dispose();
  }

  private async postModel(): Promise<void> {
    const panel = this.panel;
    if (!panel) return;
    const request = ++this.requestSequence;
    try {
      const model = await buildCabinetWorkbenchModelForProject(
        this.args.indexManager.getVisibleIndex(), this.args.projectRoot,
      );
      if (this.panel !== panel || request !== this.requestSequence) return;
      await panel.webview.postMessage({ type: "model", model });
    } catch (error) {
      if (this.panel === panel && request === this.requestSequence) {
        void vscode.window.showWarningMessage(`機櫃更新失敗：${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async openCard(cardId: string): Promise<void> {
    const cartridges = this.args.indexManager.getIndex().cartridges;
    if (!Object.hasOwn(cartridges, cardId)) return;
    const entry = cartridges[cardId];
    const mainType = entry.mainFile?.type ?? entry.mainFileType;
    if (mainType === "conflict" || mainType === "missing" || entry.idConflictPaths?.length) {
      return;
    }
    const targetPath = entry.mainFile?.activePath ?? entry.skillPath;
    await vscode.commands.executeCommand(
      "cartridge.openProjectFile",
      this.args.projectRoot,
      targetPath,
    );
  }
}

function nonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
