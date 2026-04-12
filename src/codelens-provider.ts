/**
 * 記憶卡匣外掛系統 — CodeLens 行內標記
 * 在每個開啟的檔案頂部標示歸屬狀態與過期指數
 */

import * as vscode from "vscode";
import path from "node:path";
import type { CartridgeIndexManager } from "./index-manager.js";

/**
 * 記憶卡匣 CodeLens 提供者
 */
export class CartridgeCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChange.event;

  constructor(
    private indexManager: CartridgeIndexManager,
    private projectRoot: string,
  ) {}

  /** 觸發 CodeLens 全量刷新 */
  refresh(): void {
    this._onDidChange.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const relPath = path
      .relative(this.projectRoot, document.uri.fsPath)
      .replace(/\\/g, "/");

    // 排除非專案檔案
    if (relPath.startsWith("..")) return [];

    const range = new vscode.Range(0, 0, 0, 0);
    const affected = this.indexManager.getAffectedCartridges(relPath);

    if (affected.length > 0) {
      const cartridgeId = affected[0];
      const entry = this.indexManager.getIndex().cartridges[cartridgeId];
      const staleness = entry?.staleness ?? 0;
      return [
        new vscode.CodeLens(range, {
          title: `$(shield) 屬於 [${cartridgeId}] 記憶卡 · 過期指數 ${staleness}`,
          command: "cartridge.status",
        }),
      ];
    }

    // 未歸屬檔案
    return [
      new vscode.CodeLens(range, {
        title: "$(ghost) 未歸屬檔案 — 點擊歸檔…",
        command: "cartridge.attributeFile",
        arguments: [document.uri],
      }),
    ];
  }

  /** 釋放資源 */
  dispose(): void {
    this._onDidChange.dispose();
  }
}
