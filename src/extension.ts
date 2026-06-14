/**
 * 記憶卡匣外掛系統 v2.0 — VS Code 擴充套件入口
 * activate：開啟含 .agents 目錄的工作區時自動執行
 * deactivate：VS Code 關閉時自動執行
 *
 * v2.0 架構核心升級：
 * - 原生 VS Code FileSystemWatcher 取代 chokidar
 * - Cache-First 寫入機制 + 安全心跳
 * - 背景化幽靈掃描（不阻塞啟動）
 * - TreeView 側邊欄 + CodeLens 行內標記
 * - 智慧歸屬推薦引擎 + 右鍵歸檔指令
 */

import * as vscode from "vscode";
import path from "node:path";
import { createConfig } from "./config";

import { CartridgeIndexManager } from "./index-manager";
import { StalenessAnalyzer } from "./analyzer";
import { MemoryWriter } from "./writer";
import { CartridgeWatcher } from "./watcher";
import { CartridgeStatusBar } from "./status-bar";
import { GitignoreFilter } from "./gitignore-filter";
import { refreshMemoryIndex } from "./memory-reindex";
import { CartridgeCodeLensProvider } from "./codelens-provider";
import { registerGovernanceViews } from "./governance-views";
import type { GovernanceViewsController } from "./governance-views";
import { suggestOwner } from "./smart-owner";
import { checkForExtensionUpdate } from "./update-checker";

let watcher: CartridgeWatcher | undefined;
let indexManager: CartridgeIndexManager | undefined;
let statusBar: CartridgeStatusBar | undefined;
let gitignoreFilter: GitignoreFilter | undefined;
let config: ReturnType<typeof createConfig> | undefined;
let governanceViews: GovernanceViewsController | undefined;
let codeLensProvider: CartridgeCodeLensProvider | undefined;
let heartbeatTimer: NodeJS.Timeout | undefined;

const SUPPRESSED_UPDATE_VERSION_KEY = "cartridge.updateCheck.suppressedVersion";

/**
 * 擴充套件啟動（VS Code 開啟含 .agents 工作區時自動呼叫）
 */
export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  // === 最優先：無條件註冊指令 ===

  // 命令：重新掃描索引
  context.subscriptions.push(
    vscode.commands.registerCommand("cartridge.scan", async () => {
      if (!indexManager || !config || !gitignoreFilter) {
        vscode.window.showWarningMessage("記憶卡匣：系統尚未初始化完成");
        return;
      }
      const result = await refreshMemoryIndex({
        projectRoot: config.projectRoot,
        config,
        indexManager,
        gitignoreFilter,
        detectMissedChanges: true,
        includeProjectFiles: true,
        persist: false,
      });
      await indexManager.flushIfDirty();
      await indexManager.persist();
      statusBar?.update(indexManager.getVisibleIndex());
      governanceViews?.refresh();
      const count = result.summary.cartridgeCount;
      vscode.window.showInformationMessage(
        `記憶卡匣：已掃描 ${count} 個卡匣；衝突 ${result.summary.conflicts.length}，需遷移 ${result.summary.migrationRequired}`,
      );
    }),
  );

  // 命令：重新掃描未歸屬檔案
  context.subscriptions.push(
    vscode.commands.registerCommand("cartridge.scanGhosts", async () => {
      if (!indexManager || !gitignoreFilter) {
        vscode.window.showWarningMessage("記憶卡匣：系統尚未初始化完成");
        return;
      }
      gitignoreFilter.reload();
      indexManager.clearUntrackedFiles();

      // v2.0: 使用 findFiles 取代 scanDirectory
      const projectRoot =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
      const uris = await vscode.workspace.findFiles("**/*", "**/.git/**");
      const allFiles = uris.map((u) =>
        path.relative(projectRoot, u.fsPath).replace(/\\/g, "/"),
      );
      indexManager.detectUntrackedFiles(allFiles, gitignoreFilter);

      indexManager.markDirty();
      await indexManager.flushIfDirty();
      statusBar?.update(indexManager.getVisibleIndex());
      governanceViews?.refresh();
      const count = indexManager.getUntrackedFiles().length;
      vscode.window.showInformationMessage(
        `記憶卡匣：已掃描 ${count} 個未歸屬檔案`,
      );
    }),
  );

  // 命令：查看健康報告
  context.subscriptions.push(
    vscode.commands.registerCommand("cartridge.status", () => {
      const idx = indexManager?.getVisibleIndex();
      if (!idx) {
        vscode.window.showWarningMessage("記憶卡匣：尚未初始化");
        return;
      }
      const entries = Object.entries(idx.cartridges);
      const totalScore = entries.reduce((sum, [, v]) => sum + v.staleness, 0);
      if (totalScore === 0) {
        vscode.window.showInformationMessage(
          "記憶卡匣 🟢 全部健康，無過期卡匣",
        );
      } else {
        const channel = vscode.window.createOutputChannel("記憶卡匣健康報告");
        const sorted = entries
          .filter(([, v]) => v.staleness > 0)
          .sort(([, a], [, b]) => b.staleness - a.staleness);
        const tierIcon = (s: number) =>
          s >= 100
            ? "🔴"
            : s >= 60
              ? "🟠"
              : s >= 30
                ? "🟡"
                : s >= 10
                  ? "🔵"
                  : "🟢";

        channel.clear();
        channel.appendLine(`⚠️ 記憶卡匣過期報告（總分：${totalScore}）`);
        channel.appendLine("");
        for (const [id, v] of sorted) {
          const icon = tierIcon(v.staleness);
          const changes = v.pendingChanges?.length ?? 0;
          channel.appendLine(
            `${icon} ${id.padEnd(24)} staleness=${String(v.staleness).padStart(3)}  (${changes} 個檔案異動)`,
          );
        }
        const healthy = entries.filter(([, v]) => v.staleness === 0);
        for (const [id] of healthy) {
          channel.appendLine(`🟢 ${id.padEnd(24)} staleness=  0`);
        }
        channel.show(true);
      }

      // 未歸屬檔案報告
      const untracked = idx.untrackedFiles ?? [];
      if (untracked.length > 0) {
        const channel = vscode.window.createOutputChannel("記憶卡匣未歸屬檔案");
        channel.clear();
        channel.appendLine(`👻 未歸屬檔案 (共 ${untracked.length} 個)`);
        channel.appendLine("");
        for (const entry of untracked) {
          const owner = entry.suggestedOwner
            ? ` → 建議歸屬: ${entry.suggestedOwner}`
            : " → 無匹配的記憶卡";
          channel.appendLine(`  • ${entry.filePath}${owner}`);
        }
        channel.show(true);
      }

      // 幽靈檔案報告（已追蹤但磁碟不存在）
      const ghostEntries = Object.entries(idx.cartridges).filter(
        ([, v]) => (v.ghostFiles?.length ?? 0) > 0,
      );
      if (ghostEntries.length > 0) {
        const ghostChannel = vscode.window.createOutputChannel(
          "記憶卡匣幽靈報告",
        );
        ghostChannel.clear();
        ghostChannel.appendLine(`💀 幽靈檔案報告（已追蹤但磁碟不存在）`);
        ghostChannel.appendLine("");
        for (const [id, v] of ghostEntries) {
          ghostChannel.appendLine(`  記憶卡：${id}`);
          for (const f of v.ghostFiles ?? []) {
            ghostChannel.appendLine(`    💀 ${f}`);
          }
          ghostChannel.appendLine(`  → 修復：更新記憶卡並呼叫 memory_commit`);
          ghostChannel.appendLine("");
        }
        ghostChannel.show(true);
      }
    }),
  );

  // 命令：查看幽靈檔案詳情（由 TreeView 💀 項目點擊觸發）
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "cartridge.showGhostFileInfo",
      async (args?: { filePath?: string; cartridgeId?: string }) => {
        if (!indexManager || !config) {
          vscode.window.showWarningMessage("記憶卡匣：系統尚未初始化完成");
          return;
        }
        const filePath = args?.filePath ?? "未知檔案";
        const cartridgeId = args?.cartridgeId ?? "未知記憶卡";
        const entry = indexManager.getIndex().cartridges[cartridgeId];

        const choice = await vscode.window.showWarningMessage(
          `💀 幽靈檔案：${path.basename(filePath)}`,
          {
            detail: `此檔案已從磁碟刪除，仍登記在記憶卡 [${cartridgeId}] 的追蹤清單中。\n\n修復方式：更新記憶卡，從 ## Tracked Files 區段移除此路徑後，呼叫 memory_commit 即可自動清除幽靈標記。`,
            modal: true,
          },
          "開啟記憶卡",
        );

        if (choice === "開啟記憶卡" && entry?.skillPath) {
          const targetPath = entry.mainFile?.activePath ?? entry.skillPath;
          await vscode.commands.executeCommand(
            "vscode.open",
            vscode.Uri.file(path.resolve(config.projectRoot, targetPath)),
          );
        }
      },
    ),
  );

  // 命令：歸屬到記憶卡（智慧推薦 + QuickPick 選擇）
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "cartridge.attributeFile",
      async (uri?: vscode.Uri) => {
        if (!indexManager || !config) return;
        const fileUri = uri ?? vscode.window.activeTextEditor?.document.uri;
        if (!fileUri) return;
        const relPath = path
          .relative(config.projectRoot, fileUri.fsPath)
          .replace(/\\/g, "/");
        const index = indexManager.getIndex();
        const suggested = suggestOwner(relPath, index);
        const cartridgeIds = Object.keys(index.cartridges);
        const picked = await vscode.window.showQuickPick(
          cartridgeIds.map((id) => ({
            label: id === suggested ? `⭐ ${id} (推薦)` : id,
            id,
          })),
          { placeHolder: "選擇要歸屬的記憶卡" },
        );
        if (picked) {
          vscode.window.showInformationMessage(
            `已將 ${path.basename(relPath)} 標記歸屬至 [${picked.id}]。請使用 MCP 工具更新記憶卡的追蹤清單。`,
          );
        }
      },
    ),
  );

  // 命令：手動檢查插件更新
  context.subscriptions.push(
    vscode.commands.registerCommand("cartridge.checkForUpdates", async () => {
      await runUpdateCheck(context, true);
    }),
  );

  if (isAutomaticUpdateCheckEnabled()) {
    void runUpdateCheck(context, false);
  }

  // === 工作區檢查（僅影響初始化，不影響指令） ===
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return;
  }

  const projectRoot = workspaceFolders[0].uri.fsPath;

  // === 自動排除設定 ===
  try {
    const wsConfig = vscode.workspace.getConfiguration();
    const filesExclude =
      wsConfig.get<Record<string, boolean>>("files.exclude") || {};
    const searchExclude =
      wsConfig.get<Record<string, boolean>>("search.exclude") || {};
    let settingsUpdated = false;

    if (filesExclude["**/.cartridge"] !== true) {
      filesExclude["**/.cartridge"] = true;
      settingsUpdated = true;
    }
    if (searchExclude["**/.cartridge"] !== true) {
      searchExclude["**/.cartridge"] = true;
      settingsUpdated = true;
    }

    if (settingsUpdated) {
      await wsConfig.update(
        "files.exclude",
        filesExclude,
        vscode.ConfigurationTarget.Workspace,
      );
      await wsConfig.update(
        "search.exclude",
        searchExclude,
        vscode.ConfigurationTarget.Workspace,
      );
      console.log("[記憶卡匣] 已將 .cartridge 自動加入工作區排除清單");
    }
  } catch (err) {
    console.error("[記憶卡匣] 自動排除設定失敗：", err);
  }

  // === 初始化流程（允許失敗但不影響指令） ===
  try {
    config = createConfig(projectRoot);

    statusBar = new CartridgeStatusBar(context);
    statusBar.show("初始化中...");

    // v3.0: 框架基礎注入機制已移除，外掛不再管理 .agents/ 的框架結構

    // Gitignore 排除引擎初始化
    gitignoreFilter = new GitignoreFilter(projectRoot);

    indexManager = new CartridgeIndexManager(config);

    const writer = new MemoryWriter(config);

    const { index } = await refreshMemoryIndex({
      projectRoot,
      config,
      indexManager,
      gitignoreFilter,
      detectMissedChanges: true,
      includeProjectFiles: false,
      persist: false,
    });

    // v2.0: 啟動時將過期警報寫入 SKILL.md（修復 #3：原本只更新 RAM 沒有寫入檔案）
    for (const [, entry] of Object.entries(index.cartridges)) {
      if (
        entry.staleness >= config.thresholds.significant &&
        entry.pendingChanges.length > 0
      ) {
        const changedFiles = entry.pendingChanges.map((c) => c.filePath);
        await writer.injectWarning(
          entry.mainFile?.activePath ?? entry.skillPath,
          changedFiles,
          entry.staleness,
        );
      }
    }

    // v2.0: 立即顯示基礎燈號（不等待幽靈掃描）
    statusBar.update(indexManager.getVisibleIndex());

    // v5.0: 獨立 Activity Bar 治理側邊欄
    governanceViews = registerGovernanceViews({
      context,
      indexManager,
      projectRoot,
    });

    // v2.0: CodeLens 行內標記
    codeLensProvider = new CartridgeCodeLensProvider(indexManager, projectRoot);
    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider("*", codeLensProvider),
    );

    // v2.0: 記憶體變動通知 hook（連動 UI 三兄弟）
    indexManager.onChanged = () => {
      statusBar?.update(indexManager?.getVisibleIndex());
      governanceViews?.refresh();
      codeLensProvider?.refresh();
    };

    const analyzer = new StalenessAnalyzer(config, indexManager, writer);
    watcher = new CartridgeWatcher(
      config,
      indexManager,
      analyzer,
      gitignoreFilter,
      writer,
    );
    await watcher.start();

    // v2.0: 背景化幽靈掃描（不阻塞啟動流程）
    setTimeout(async () => {
      try {
        const uris = await vscode.workspace.findFiles("**/*", "**/.git/**");
        const allFiles = uris.map((u) =>
          path.relative(projectRoot, u.fsPath).replace(/\\/g, "/"),
        );
        indexManager?.detectUntrackedFiles(allFiles, gitignoreFilter!);
        indexManager?.markDirty();
        statusBar?.update(indexManager?.getVisibleIndex());
        governanceViews?.refresh();
      } catch (err) {
        console.error("[記憶卡匣] 背景幽靈掃描失敗：", err);
      }
    }, 3000);

    // v2.0: 安全心跳（每 5 分鐘落地一次）
    heartbeatTimer = setInterval(() => indexManager?.flushIfDirty(), 300_000);

    context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(async () => {
        if (!indexManager) return;
        await indexManager.scan();
        statusBar?.update(indexManager.getVisibleIndex());
      }),
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[記憶卡匣] 初始化失敗：", msg);
    vscode.window.showErrorMessage(`記憶卡匣初始化失敗：${msg}`);
  }
}

/**
 * 擴充套件關閉（VS Code 關閉時自動呼叫）
 */
export async function deactivate(): Promise<void> {
  watcher?.stop();
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  await indexManager?.flushIfDirty();
  statusBar?.dispose();
  governanceViews?.dispose();
  codeLensProvider?.dispose();
}

async function runUpdateCheck(
  context: vscode.ExtensionContext,
  manual: boolean,
): Promise<void> {
  const currentVersion = String(
    context.extension.packageJSON?.version ?? "0.0.0",
  );
  const result = await checkForExtensionUpdate({ currentVersion });

  if (result.status === "available") {
    const suppressedVersion = context.globalState.get<string>(
      SUPPRESSED_UPDATE_VERSION_KEY,
    );
    if (!manual && suppressedVersion === result.latestVersion) {
      return;
    }

    const choice = await vscode.window.showInformationMessage(
      `Cartridge System 有新版本 ${result.latestVersion}（目前 ${result.currentVersion}）`,
      "開啟 Release",
      "本版不再提醒",
    );

    if (choice === "開啟 Release" && result.releaseUrl) {
      await vscode.env.openExternal(vscode.Uri.parse(result.releaseUrl));
    }
    if (choice === "本版不再提醒" && result.latestVersion) {
      await context.globalState.update(
        SUPPRESSED_UPDATE_VERSION_KEY,
        result.latestVersion,
      );
    }
    return;
  }

  if (result.status === "current") {
    if (manual) {
      vscode.window.showInformationMessage(
        `Cartridge System 已是最新版 ${result.currentVersion}`,
      );
    }
    return;
  }

  const reason = result.reason ?? "未知原因";
  if (manual) {
    const level = result.status === "error" ? "錯誤" : "無可用版本";
    vscode.window.showWarningMessage(`Cartridge 更新檢查${level}：${reason}`);
    return;
  }

  console.warn(`[Cartridge] 更新檢查未完成：${reason}`);
}

function isAutomaticUpdateCheckEnabled(): boolean {
  return vscode.workspace
    .getConfiguration("cartridge")
    .get<boolean>("updateCheck.enabled", true);
}
