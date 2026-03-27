/**
 * 記憶卡匣外掛系統 — 狀態列燈號元件
 * 在 VS Code 底部狀態列即時顯示記憶健康狀態
 */

import * as vscode from 'vscode'
import type { CartridgeIndex } from './types'

/**
 * 狀態列燈號元件
 */
export class CartridgeStatusBar {
  private item: vscode.StatusBarItem

  constructor(context: vscode.ExtensionContext) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      10,
    )
    this.item.command = 'cartridge.status'
    this.item.tooltip = '點擊查看記憶卡匣健康報告'
    context.subscriptions.push(this.item)
  }

  /**
   * 顯示初始化或自訂訊息
   */
  show(message: string): void {
    this.item.text = `$(shield) 記憶卡匣 ${message}`
    this.item.show()
  }

  /**
   * 根據索引資料更新燈號
   */
  update(index?: CartridgeIndex): void {
    if (!index) {
      this.item.text = '$(shield) 記憶卡匣 ⚠️ 未初始化'
      this.item.show()
      return
    }

    const cartridges = Object.values(index.cartridges)
    const critical = cartridges.filter(c => c.staleness >= 30)
    const significant = cartridges.filter(
      c => c.staleness >= 10 && c.staleness < 30,
    )
    const total = cartridges.length

    if (critical.length > 0) {
      this.item.text = `$(error) 記憶卡匣 🔴 ${critical.length} 張嚴重過期`
      this.item.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.errorBackground',
      )
    } else if (significant.length > 0) {
      this.item.text = `$(warning) 記憶卡匣 🟠 ${significant.length} 張顯著過期`
      this.item.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground',
      )
    } else {
      this.item.text = `$(shield) 記憶卡匣 🟢 ${total} 張健康`
      this.item.backgroundColor = undefined
    }

    this.item.show()
  }

  /**
   * 釋放資源
   */
  dispose(): void {
    this.item.dispose()
  }
}
