/**
 * 記憶卡匣外掛系統 — 狀態列燈號元件
 * 在 VS Code 底部狀態列即時顯示記憶健康狀態
 */

import * as vscode from "vscode";
import type { CartridgeIndex } from "./types";

/**
 * 狀態列燈號元件
 */
export class CartridgeStatusBar {
  private item: vscode.StatusBarItem;

  constructor(context: vscode.ExtensionContext) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      10,
    );
    this.item.command = "cartridge.status";
    this.item.tooltip = "點擊查看記憶卡匣健康報告";
    context.subscriptions.push(this.item);
  }

  /**
   * 顯示初始化或自訂訊息
   */
  show(message: string): void {
    this.item.text = `$(shield) 記憶卡匣 ${message}`;
    this.item.show();
  }

  /**
   * 根據索引資料更新燈號（五層等級總分制 + 未歸屬檔案提示）
   */
  update(index?: CartridgeIndex): void {
    if (!index) {
      this.item.text = "$(shield) 記憶卡匣 ⚠️ 未初始化";
      this.item.show();
      return;
    }

    const cartridges = Object.values(index.cartridges);
    const totalScore = cartridges.reduce((sum, c) => sum + c.staleness, 0);
    const { icon, label, codicon, background } = getScoreTier(totalScore);

    // 基礎燈號
    let text = `$(${codicon}) 記憶卡匣 ${icon} ${label}`;

    // 未歸屬檔案提示
    const untrackedCount = index.untrackedFiles?.length ?? 0;
    if (untrackedCount > 0) {
      text += ` | 👻 ${untrackedCount} 未歸屬`;
    }

    this.item.text = text;
    this.item.backgroundColor = background
      ? new vscode.ThemeColor(background)
      : undefined;

    // 動態提示文字
    this.item.tooltip = this.buildTooltip(index, totalScore, untrackedCount);
    this.item.show();
  }

  /**
   * 建構滑鼠懸停提示
   */
  private buildTooltip(
    index: CartridgeIndex,
    totalScore: number,
    untrackedCount: number,
  ): string {
    const lines: string[] = [
      `記憶卡匣健康報告`,
      `─────────────────`,
      `總過期指數: ${totalScore}`,
      `記憶卡數量: ${Object.keys(index.cartridges).length}`,
    ];

    // 列出異常記憶卡
    const stale = Object.entries(index.cartridges)
      .filter(([, c]) => c.staleness > 0)
      .sort(([, a], [, b]) => b.staleness - a.staleness);

    if (stale.length > 0) {
      lines.push(``, `⚠️ 過期記憶卡:`);
      for (const [id, entry] of stale.slice(0, 5)) {
        lines.push(`  • ${id}: 過期指數 ${entry.staleness}`);
      }
      if (stale.length > 5) {
        lines.push(`  ...及其他 ${stale.length - 5} 張`);
      }
    }

    // 未歸屬檔案摘要
    if (untrackedCount > 0) {
      lines.push(``, `👻 未歸屬檔案 (${untrackedCount}):`);
      const untracked = index.untrackedFiles ?? [];
      for (const entry of untracked.slice(0, 5)) {
        const owner = entry.suggestedOwner
          ? ` → 建議歸屬: ${entry.suggestedOwner}`
          : "";
        lines.push(`  • ${entry.filePath}${owner}`);
      }
      if (untrackedCount > 5) {
        lines.push(`  ...及其他 ${untrackedCount - 5} 個`);
      }
    }

    // 💀 幽靈檔案摘要
    const ghostEntries = Object.entries(index.cartridges).filter(
      ([, c]) => (c.ghostFiles?.length ?? 0) > 0,
    );
    if (ghostEntries.length > 0) {
      lines.push(``, `💀 幽靈檔案 (需清理):`);
      for (const [id, c] of ghostEntries) {
        lines.push(`  • ${id}: ${c.ghostFiles!.length} 個幽靈`);
      }
    }

    lines.push(``, `點擊查看完整健康報告`);
    return lines.join("\n");
  }

  /**
   * 釋放資源
   */
  dispose(): void {
    this.item.dispose();
  }
}

/**
 * 五層等級判定（依總分）
 */
function getScoreTier(totalScore: number): {
  icon: string;
  label: string;
  codicon: string;
  background: string | undefined;
} {
  if (totalScore >= 100) {
    return {
      icon: "🔴",
      label: "嚴重過期",
      codicon: "error",
      background: "statusBarItem.errorBackground",
    };
  }
  if (totalScore >= 60) {
    return {
      icon: "🟠",
      label: "顯著過期",
      codicon: "warning",
      background: "statusBarItem.warningBackground",
    };
  }
  if (totalScore >= 30) {
    return {
      icon: "🟡",
      label: "需注意",
      codicon: "warning",
      background: "statusBarItem.warningBackground",
    };
  }
  if (totalScore >= 10) {
    return {
      icon: "🔵",
      label: "有變動",
      codicon: "info",
      background: undefined,
    };
  }
  return {
    icon: "🟢",
    label: "全部同步",
    codicon: "shield",
    background: undefined,
  };
}
