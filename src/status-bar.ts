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
   * 根據索引資料更新燈號（五層等級總分制）
   */
  update(index?: CartridgeIndex): void {
    if (!index) {
      this.item.text = '$(shield) 記憶卡匣 ⚠️ 未初始化'
      this.item.show()
      return
    }

    const cartridges = Object.values(index.cartridges)
    const totalScore = cartridges.reduce((sum, c) => sum + c.staleness, 0)
    const { icon, label, codicon, background } = getScoreTier(totalScore)

    this.item.text = `$(${codicon}) 記憶卡匣 ${icon} ${label}`
    this.item.backgroundColor = background
      ? new vscode.ThemeColor(background)
      : undefined

    this.item.show()
  }

  /**
   * 釋放資源
   */
  dispose(): void {
    this.item.dispose()
  }
}

/**
 * 五層等級判定（依總分）
 */
function getScoreTier(totalScore: number): {
  icon: string
  label: string
  codicon: string
  background: string | undefined
} {
  if (totalScore >= 100) {
    return { icon: '🔴', label: '嚴重過期', codicon: 'error', background: 'statusBarItem.errorBackground' }
  }
  if (totalScore >= 60) {
    return { icon: '🟠', label: '顯著過期', codicon: 'warning', background: 'statusBarItem.warningBackground' }
  }
  if (totalScore >= 30) {
    return { icon: '🟡', label: '需注意', codicon: 'warning', background: 'statusBarItem.warningBackground' }
  }
  if (totalScore >= 10) {
    return { icon: '🔵', label: '有變動', codicon: 'info', background: undefined }
  }
  return { icon: '🟢', label: '全部同步', codicon: 'shield', background: undefined }
}

