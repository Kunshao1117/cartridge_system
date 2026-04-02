/**
 * 記憶卡匣外掛系統 — VS Code 擴充套件入口
 * activate：開啟含 .agents 目錄的工作區時自動執行
 * deactivate：VS Code 關閉時自動執行
 */

import * as vscode from 'vscode'
import { createConfig } from './config'
import { CoreInjector } from './injector'
import { CartridgeIndexManager } from './index-manager'
import { StalenessAnalyzer } from './analyzer'
import { MemoryWriter } from './writer'
import { CartridgeWatcher } from './watcher'
import { CartridgeStatusBar } from './status-bar'

let watcher: CartridgeWatcher | undefined
let indexManager: CartridgeIndexManager | undefined
let statusBar: CartridgeStatusBar | undefined

/**
 * 擴充套件啟動（VS Code 開啟含 .agents 工作區時自動呼叫）
 */
export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {

  // === 最優先：無條件註冊指令 ===

  // 命令：重新掃描索引
  context.subscriptions.push(
    vscode.commands.registerCommand('cartridge.scan', async () => {
      if (!indexManager) {
        vscode.window.showWarningMessage('記憶卡匣：系統尚未初始化完成')
        return
      }
      const newIndex = await indexManager.scan()
      await indexManager.persist()
      statusBar?.update(newIndex)
      const count = Object.keys(newIndex.cartridges).length
      vscode.window.showInformationMessage(
        `記憶卡匣：已掃描 ${count} 個卡匣`,
      )
    }),
  )

  // 命令：查看健康報告
  context.subscriptions.push(
    vscode.commands.registerCommand('cartridge.status', () => {
      const idx = indexManager?.getIndex()
      if (!idx) {
        vscode.window.showWarningMessage('記憶卡匣：尚未初始化')
        return
      }
      const entries = Object.entries(idx.cartridges)
      const totalScore = entries.reduce(
        (sum, [, v]) => sum + v.staleness, 0,
      )
      if (totalScore === 0) {
        vscode.window.showInformationMessage(
          '記憶卡匣 🟢 全部健康，無過期卡匣',
        )
      } else {
        const channel = vscode.window.createOutputChannel(
          '記憶卡匣健康報告',
        )
        const sorted = entries
          .filter(([, v]) => v.staleness > 0)
          .sort(([, a], [, b]) => b.staleness - a.staleness)
        const tierIcon = (s: number) =>
          s >= 100 ? '🔴' : s >= 60 ? '🟠' : s >= 30 ? '🟡' : s >= 10 ? '🔵' : '🟢'

        channel.clear()
        channel.appendLine(`⚠️ 記憶卡匣過期報告（總分：${totalScore}）`)
        channel.appendLine('')
        for (const [id, v] of sorted) {
          const icon = tierIcon(v.staleness)
          const changes = v.pendingChanges?.length ?? 0
          channel.appendLine(
            `${icon} ${id.padEnd(24)} staleness=${String(v.staleness).padStart(3)}  (${changes} 個檔案異動)`,
          )
        }
        const healthy = entries.filter(([, v]) => v.staleness === 0)
        for (const [id] of healthy) {
          channel.appendLine(`🟢 ${id.padEnd(24)} staleness=  0`)
        }
        channel.show(true)
      }
    }),
  )

  // === 工作區檢查（僅影響初始化，不影響指令） ===
  const workspaceFolders = vscode.workspace.workspaceFolders
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return
  }

  const projectRoot = workspaceFolders[0].uri.fsPath

  // === 自動排除設定 ===
  try {
    const wsConfig = vscode.workspace.getConfiguration()
    // files.exclude 影響檔案總管顯示
    const filesExclude = wsConfig.get<Record<string, boolean>>('files.exclude') || {}
    // search.exclude 影響全域搜尋
    const searchExclude = wsConfig.get<Record<string, boolean>>('search.exclude') || {}
    let settingsUpdated = false

    if (filesExclude['**/.cartridge'] !== true) {
      filesExclude['**/.cartridge'] = true
      settingsUpdated = true
    }
    if (searchExclude['**/.cartridge'] !== true) {
      searchExclude['**/.cartridge'] = true
      settingsUpdated = true
    }

    if (settingsUpdated) {
      await wsConfig.update('files.exclude', filesExclude, vscode.ConfigurationTarget.Workspace)
      await wsConfig.update('search.exclude', searchExclude, vscode.ConfigurationTarget.Workspace)
      console.log('[記憶卡匣] 已將 .cartridge 自動加入工作區排除清單')
    }
  } catch (err) {
    console.error('[記憶卡匣] 自動排除設定失敗：', err)
  }

  // === 初始化流程（允許失敗但不影響指令） ===
  try {
    const config = createConfig(projectRoot)

    statusBar = new CartridgeStatusBar(context)
    statusBar.show('初始化中...')

    const injector = new CoreInjector(config)
    await injector.inject()
    vscode.window.setStatusBarMessage(injector.formatReport(), 5000)

    indexManager = new CartridgeIndexManager(config)
    const index = await indexManager.scan()
    indexManager.detectMissedChanges(config.scoring)
    await indexManager.persist()

    statusBar.update(index)

    const writer = new MemoryWriter(config)
    const analyzer = new StalenessAnalyzer(config, indexManager, writer)
    const refreshStatusBar = () => statusBar?.update(indexManager?.getIndex())
    watcher = new CartridgeWatcher(config, indexManager, analyzer, refreshStatusBar)
    await watcher.start()

    context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(async () => {
        if (!indexManager) return
        const newIndex = await indexManager.scan()
        statusBar?.update(newIndex)
      }),
    )
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[記憶卡匣] 初始化失敗：', msg)
    vscode.window.showErrorMessage(`記憶卡匣初始化失敗：${msg}`)
  }
}

/**
 * 擴充套件關閉（VS Code 關閉時自動呼叫）
 */
export async function deactivate(): Promise<void> {
  await watcher?.stop()
  await indexManager?.persist()
  statusBar?.dispose()
}

