# 記憶卡匣監控系統（Cartridge System）

> **現實感知 AI 記憶防禦引擎** — 自動偵測記憶卡過期、幽靈檔案、跨模組依賴傳播，確保 AI 不讀取失效的上下文。

[![version](https://img.shields.io/badge/version-5.1.0-blue)](./CHANGELOG.md)
[![tests](https://img.shields.io/badge/tests-181%20passed-brightgreen)](#-執行測試)
[![license](https://img.shields.io/badge/license-MIT-green)](#)

---

## 📌 這是什麼？

Cartridge System 是一個為 [Antigravity 框架](https://github.com/Kunshao1117/cartridge_system) 設計的 **VS Code 延伸模組 + MCP 工具伺服器**。

它解決了一個根本問題：**AI 在跨會話工作時，往往不知道自己的「記憶」是否已過時。**

當你修改了專案原始碼，但忘記更新對應的記憶技能時，Cartridge System 會：

1. **全域追蹤** — 直接於根目錄層級架設雷達，整合原生 `.gitignore` 引擎，感知專案中每一個新生檔案。
2. **計算過期指數** — 使用衰退演算法計算每張記憶卡的「失效程度」
3. **幽靈偵測** — 已追蹤但被刪除的檔案自動標記為 💀 幽靈，狀態列懸浮報告即時顯示幽靈摘要，提醒 AI 清理追蹤清單
4. **依賴傳播** — 自動分析卡匣間 import 依賴，當上游過期時向下游卡匣傳播間接過期指數
5. **未歸屬提示** — 沒有歸屬的孤兒檔案將展示在前端狀態列，透過 👻 提示通知您建立/指派到對應技能。
6. **警報植入** — 在過期的記憶技能頂部自動插入攔截警告，阻止 AI 讀取舊資料
7. **引導更新** — AI 更新記憶卡後，系統自動清除警報，恢復健康狀態

---

## ✨ 功能一覽

| 功能 | 說明 |
|------|------|
| 🔍 **全域雷達** | 使用 VS Code 原生 FileSystemWatcher 全專案監聽，結合原生 `.gitignore` 規則精準屏除依賴庫。 |
| 💀 **幽靈偵測** | **v4.1.1 增強** — 自動標記已追蹤但磁碟不存在的幽靈檔案。**新增互動式修復指引（Modal）**，點擊側邊欄 💀 項目可直接彈出修復路徑與操作建議。 |
| 🕸️ **依賴圖引擎** | **v4.0 新增** — 自動掃描 import 語句推導卡匣依賴關係，BFS 演算法傳播間接過期，DFS 偵測循環依賴 |
| 👻 **未歸屬檔案池** | 智能偵測專案內新增但未被任何卡匣記錄的檔案，支援歸屬建議。 |
| 🧹 **未歸屬自動清除** | **v5.0 修復** — 檔案被加入任一記憶卡 `## Tracked Files` 後，`SKILL.md` 變更流程與 `memory_commit` 都會自動移除舊未歸屬提醒。 |
| 📊 **過期指數計算** | 根據異動類型（新增/修改/刪除）與時間衰退計算分數 |
| 🚨 **警報自動植入** | 過期指數超過閾值時，自動在 SKILL.md 頂部插入攔截警告 |
| 🟢 **狀態列燈號** | VS Code 狀態列即時顯示記憶卡指標（五層等級：🟢🔵🟡🟠🔴）以及 👻 幽靈計數 |
| 🌳 **獨立治理側邊欄**| **v5.1 增強** — Activity Bar 新增 Cartridge 入口，內含治理總覽、記憶卡匣、規則檔檢查與待處理項目四個原生 TreeView。 |
| 🔍 **CodeLens 標記**| 編輯器頂部行內標記，即時顯示當前檔案所屬的記憶卡與過期狀態 |
| 🛠️ **MCP 工具介面** | 提供十二個標準化 AI 工具（記憶治理 + 上下文治理 + 提交前治理），支援跨專案動態路徑解析 |
| 🧭 **規則檔檢查** | **v5.1 增強** — 掃描 Codex `AGENTS.md`、Claude `CLAUDE.md` / skills / subagents、GitHub Copilot instructions、Antigravity skills 與 `.agents/memory/`，用白話列出規則衝突、原因、相關檔案與建議工具。 |
| 🧭 **MCP 工具名冊** | **v5.1 增強** — 集中管理工具描述、風險等級、讀寫屬性、授權需求、開工安全性與預期耗時，並驅動 MCP dispatcher 執行路由。 |
| 🧯 **MCP 工具防線** | **v4.1.1 增強** — 寫入型工具 `memory_commit` 需要 `confirm: true`，由 server dispatcher 層硬性阻擋未確認呼叫。 |
| 🧪 **依賴語義警告** | **v4.1.1 增強** — `memory_commit` 會檢查 `dependencies` 是否疑似混入父子導覽、技能建議或缺少依賴理由；只產生 warning，不取代 `D:\AI_Rules` 的核心規範。`workspace_brief` 僅揭露依賴總邊數，避免在缺少 SKILL.md 內文時產生誤報。 |
| 📦 **治理回傳契約** | **v5.0 增強** — 十二個 MCP 工具統一回傳 `status`、`summary`、`findings`、`recommendedActions`、`metadata` 與 `legacy`，方便 AI、Gateway 與插件解析。 |
| 🧩 **MCP 分層摘要** | **v4.1.1 增強** — `memory_deps` 採標準 envelope 回傳，區分工程依賴、frontmatter 依賴與過期傳播；`workspace_brief` 提供提交 readiness；`commit_preflight` 彙整 dependency semantics warning。 |
| 🧾 **記憶卡完整健檢** | **v4.1.1 增強** — 新增只讀 `memory_audit`，完整掃描專案記憶卡、索引、Tracked Files、依賴循環與舊格式相容問題；循環報告會區分 frontmatter、engineering 與 persisted index 來源，避免舊索引殘留誤判主要健康狀態。 |
| 🕸️ **Memory Graph 瘦身** | **v4.1.1 增強** — 抽出共用路徑驗證、時間戳與過期等級工具，降低高階治理工具、索引器與底層 handlers 之間的不必要工程依賴，讓記憶圖譜更貼近真實分層。 |
| 🌐 **跨平台相容** | 完整支援 Windows CRLF 與 Unix LF 行尾格式 |
| 🛡️ **路徑安全防禦** | 雙層路徑驗證（Zod 格式守衛 + 語意守衛），阻擋路徑穿越攻擊 |
| 🌲 **巢狀目錄掃描** | 支援最大 4 層深度的記憶卡樹狀結構，目錄結構即層級 |
| 📂 **獨立記憶目錄** | 記憶卡存放於 `.agents/memory/`，與操作技能完全分離 |
| 🗃️ **系統目錄隱藏** | 外掛啟動時自動將 `.cartridge/` 寫入 VS Code 工作區排除名單，保持檔案總管整潔 |

---

## 🚀 安裝方式

### 方法一：下載正式版 VSIX（推薦）

1. 前往 [GitHub Releases](https://github.com/Kunshao1117/cartridge_system/releases)。
2. 下載最新版本的 `cartridge-system-*.vsix`。
3. 在 VS Code / Antigravity 使用 **Install from VSIX** 安裝，或使用 CLI：

```bash
antigravity --install-extension cartridge-system-5.1.0.vsix --force
```

### 方法二：本機打包安裝

```bash
# 先建構外掛安裝檔
cd d:\cartridge_system
npm run build
npm run package

# 使用 Antigravity IDE CLI 安裝（注意：不可用 code 指令）
antigravity --install-extension cartridge-system-5.1.0.vsix --force
```

### 方法三：開發模式

```bash
git clone https://github.com/Kunshao1117/cartridge_system.git
cd cartridge_system
npm install
npm run build
# 按 F5 啟動 Extension Development Host
```

> ⚠️ **注意**：修改 `src/` 後必須重新執行 `npm run build`，外掛才會載入新版本。

---

## 📦 發布 VSIX

Cartridge System 使用 GitHub Actions 自動發布 VSIX。正式版本不需要手動開 GitHub Release 拖檔案。

### 自動發布正式版

1. 更新 `package.json` 版本與 `CHANGELOG.md` 對應版本段落。
2. 完成本機驗證：

```bash
npm test
npm run lint
npm run build
npm run package
```

> Windows 若 `npm run *` 只印出 script header 後以 `ERR_INVALID_ARG_TYPE` 結束，先確認 `ComSpec` 指向 `C:\Windows\System32\cmd.exe`。本機修復命令：
>
> ```powershell
> $cmd = "$env:SystemRoot\System32\cmd.exe"
> $env:ComSpec = $cmd
> [Environment]::SetEnvironmentVariable('ComSpec', $cmd, 'User')
> ```

3. 推送版本 tag：

```bash
git tag v5.1.1
git push origin v5.1.1
```

GitHub Actions 會自動執行測試、打包 `cartridge-system-*.vsix`、建立或更新 Release，並把 VSIX 掛到 Release 附件。

### 手動補發

如果需要補發目前版本，進入 GitHub 的 **Actions → Release VSIX → Run workflow**，輸入版本號，例如 `5.1.0` 或 `v5.1.0`。Workflow 會確認輸入版本與 `package.json` 一致，然後重新打包並覆蓋 Release 裡的 VSIX 附件。

---

## 🤖 MCP 工具伺服器設定

Cartridge System 提供 MCP（Model Context Protocol）工具伺服器，供 AI 代理人透過標準化介面存取記憶系統。

### 設定方式

在你的 AI 工具（如 Gemini CLI、Claude Desktop）的 MCP 設定檔中加入：

```json
{
  "mcpServers": {
    "cartridge-system": {
      "command": "node",
      "args": [
        "d:\\cartridge_system\\dist\\mcp-server.js"
      ]
    }
  }
}
```

### 可用工具

| 工具名稱 | 說明 |
|----------|------|
| `memory_list` | 列出所有記憶卡匣（含過期指數、幽靈計數、依賴數量、間接過期指數） |
| `memory_read` | 讀取特定記憶技能的完整 SKILL.md 內容（自動解析巢狀點分隔路徑）；`moduleName` 只接受卡匣 ID，不接受 `/`、`\` 或 `..` 路徑片段 |
| `memory_status` | 查詢過期修復診斷：過期指數、待處理異動、**幽靈檔案清單**及清理行動指引 |
| `memory_commit` | AI 寫入 SKILL.md 後呼叫，自動完成：時間戳注入、staleness 歸零、索引同步、**幽靈清除**、未歸屬池清理與間接過期重算。**v5.1.x 強化 handler 層 `confirm:true` 驗證、moduleName 路徑片段拒絕、格式容錯、I/O 防護與 dependencies 語義警告**。 |
| `memory_deps` | **v4.1.1 增強** — 查詢卡匣依賴拓樸，分層回傳工程依賴、frontmatter 依賴、過期傳播與循環依賴警告，並保留舊欄位相容；`moduleName` 同樣拒絕路徑片段 |
| `memory_audit` | **v5.1.x 增強** — 只讀完整健檢專案記憶卡，回報舊格式相容、frontmatter 缺欄位、Tracked Files 問題、索引漂移、依賴循環、dependencies 語義可疑項，以及 `staleness=0` 但 `pendingChanges` 未清的索引同步異常；主要循環依據即時 frontmatter / engineering graph，舊索引循環只作診斷 |
| `workspace_brief` | **v5.1 增強** — 彙整專案身份、記憶卡健康、規則檔提醒、AI 開工狀態、提交前提醒與建議下一步 |
| `commit_preflight` | **v4.1.1 新增** — 提交前治理檢查，彙整 git dirty state、記憶卡健康阻塞、dependency semantics warning、建議行動與驗證命令 |
| `context_inventory` | **v5.1 增強** — 掃描 AI 規則來源，回傳檔案位置、負責代理、適用範圍、優先序、追蹤檔案、依賴、過期狀態與風險。 |
| `context_audit` | **v5.1 增強** — 檢查 Codex、Claude、Copilot、Antigravity 與記憶卡之間的語言、提交授權與寫入規則，並回傳白話原因、相關檔案與建議工具。 |
| `context_diff` | **v5.1 增強** — 比對兩個規則來源的治理訊號、優先序、支援代理與差異。 |
| `context_plan` | **v5.1 增強** — 依據規則檔檢查產出只讀整理建議，不執行自動修復或寫入。 |

### MCP 工具回傳格式

十二個 MCP 工具都採用統一 envelope，方便 AI、Gateway 與未來插件 UI 穩定解析：

```json
{
  "status": "ready | warning | blocked | error",
  "summary": {},
  "findings": [],
  "recommendedActions": [],
  "metadata": {
    "tool": "workspace_brief",
    "readOnly": true,
    "generatedAt": "2026-05-14T14:48:01+08:00",
    "projectRoot": "D:\\cartridge_system"
  },
  "legacy": {}
}
```

新版 AI 流程應優先讀取 `summary`、`findings` 與 `recommendedActions`。舊版文字、原始報告或舊欄位會收納於 `legacy`，用於相容既有 MCP 呼叫者。

### MCP 驗證層級

本專案的 MCP 工具驗證分成三層，避免把「直接呼叫 handler」誤認為「MCP 工具入口可用」：

| 層級 | 目的 | 驗證方式 |
|------|------|----------|
| 終端單元測試 | 驗證 TypeScript 純函式、摘要規則、路徑防線與回傳契約 | `npx vitest run`、`npx tsc --noEmit`、`npx eslint src/`、`npx tsup --config tsup.config.ts` |
| MCP stdio 協議 E2E | 驗證 `dist/mcp-server.js` 真的能透過 MCP JSON-RPC 對外提供工具 | 啟動 `node dist/mcp-server.js`，呼叫 `initialize`、`tools/list`、`tools/call` |
| Gateway 真實工具入口 | 驗證 `multi-mcp-gateway` 能找到並呼叫 `cartridge-system` 工具 | 呼叫 `cartridge-system__memory_deps`、`cartridge-system__workspace_brief`、`cartridge-system__commit_preflight`、`cartridge-system__memory_audit`、`cartridge-system__context_audit` |

目前已實測：MCP stdio `tools/list` 會列出十二個工具；`memory_audit`、`workspace_brief`、`commit_preflight` 在乾淨工作樹下回傳 ready；`memory_audit` 可偵測 `staleness=0` 但 `pendingChanges` 未清的索引漂移。Gateway 驗證需 `multi-mcp-gateway` 已註冊 `cartridge-system` 下游 server；若 Gateway 回報 server 未註冊，不得把 handler 或 stdio 測試替代宣稱為 Gateway 通過。

### 跨專案支援

所有工具均透過必填的 `projectRoot` 參數指定目標專案：

```javascript
// 讀取記憶卡
memory_read({
  moduleName: '_system',
  projectRoot: 'D:\\bartender_map'
})

// 查詢過期診斷（含幽靈檔案提示）
memory_status({
  moduleName: 'dashboard-ui',
  projectRoot: 'D:\\bartender_map'
})
// → 若有幽靈檔案，actionRequired 欄位會列出清理指引

// 查詢卡匣依賴關係
memory_deps({
  moduleName: 'mcp-tools',
  projectRoot: 'D:\\cartridge_system'
})
// → 回傳標準 envelope；summary.graph 區分工程依賴與 frontmatter 依賴，legacy 保留舊欄位

// 完整記憶卡健檢
memory_audit({
  projectRoot: 'D:\\cartridge_system'
})
// → 回傳 compatibility mode、frontmatter/Tracked Files/index/dependency findings 與建議行動

// AI 開工前摘要
workspace_brief({
  projectRoot: 'D:\\cartridge_system'
})
// → 回傳專案身份、記憶卡健康摘要、readiness 與 recommendedActions

// 提交前治理檢查
commit_preflight({
  projectRoot: 'D:\\cartridge_system'
})
// → 回傳 ready/blocked、git dirty state、阻塞原因與建議驗證命令

// v5 上下文治理健檢
context_audit({
  projectRoot: 'D:\\cartridge_system'
})
// → 回傳規則檔檢查結果、白話原因、相關檔案與建議工具

// ✅ 推薦流程：先用原生工具寫入 SKILL.md，再呼叫 memory_commit 同步
memory_commit({
  moduleName: 'dashboard-ui',
  projectRoot: 'D:\\bartender_map',
  confirm: true
})
// → 自動更新時間戳、歸零 staleness、同步索引、清除幽靈標記
```

---

## ⌨️ VS Code 指令

安裝後，可透過指令面板（`Ctrl+Shift+P`）使用以下指令：

| 指令 | 說明 |
|------|------|
| `記憶卡匣：重新掃描索引` | 強制重新讀取所有記憶技能，重建監聽清單 |
| `記憶卡匣：查看健康報告` | 在輸出面板顯示所有記憶卡的詳細狀態 |
| `記憶卡匣：重新掃描未歸屬檔案` | 清空並重新掃描全專案的未歸屬幽靈檔案 |
| `記憶卡匣：查看幽靈詳情` | **v4.1.1 新增** — 針對選定的幽靈檔案彈出 Modal 診斷報告與修復指引 |
| `記憶卡匣：歸屬到記憶卡…` | 透過 QuickPick 介面將當前檔案或選定檔案一鍵歸檔至目標記憶卡 |
| `Cartridge：開啟治理總覽` | **v5.0 新增** — 聚焦左側 Activity Bar 的 Cartridge 獨立治理側邊欄 |
| `Cartridge：重新整理治理側邊欄` | **v5.0 新增** — 重新整理治理總覽、記憶卡匣、上下文治理與待處理項目 |
| `Cartridge：查看上下文治理報告` | **v5.1 增強** — 在輸出面板顯示規則檔檢查結果、相關檔案與建議工具 |

---

## 🧪 執行測試

```bash
# 執行完整測試套件
npm test

# 監聽模式（開發時使用）
npm run test:watch
```

測試涵蓋 21 個測試檔案（**181 個案例**）：

| 測試模組 | 案例數 | 涵蓋範圍 |
|----------|--------|----------|
| 索引管理器 | 22 | 掃描、addPendingChange 去重、getChildren、resolveModulePath、空追蹤卡誤報防護、未歸屬池 refilter 自動清理 |
| MCP 工具介面 | 65 | 正常流程、路徑穿越防禦、moduleName 路徑片段拒絕、handler 層 `confirm:true` 驗證、時間戳驗證、過期狀態診斷、十二工具 envelope 契約、memory_commit 後設同步、workspace_brief 專案健康摘要、AI 開工狀態、提交 readiness、commit_preflight 提交前治理檢查與 dependency semantics 摘要、**標題錯字偵測 (HEADING_TYPO)**、**路徑格式驗證 (PATH_ABSOLUTE / PATH_TRAVERSAL)**、**dependencies 語義警告**、**未歸屬池清理**、**fileMap 同步**、**間接過期重算**、**警告區塊自動清除** |
| 監聽引擎 | 2 | `SKILL.md` 變更後重新 scan、refilter untracked、flush index 並觸發側邊欄刷新；`.agents/memory` 被 `.gitignore` 覆蓋時仍優先處理記憶卡變更 |
| 規則檔檢查 | 4 | 多代理指令掃描、規則來源摘要、提交授權衝突 blocking、context_diff 訊號比對與語言提醒 |
| 治理側邊欄 | 4 | Activity Bar view container、四個 Cartridge TreeView、公開 commands、governance summary 與白話 action items 轉換 |
| 記憶卡完整健檢 | 6 | memory_audit 現代格式 ready、舊格式 compatibility warning、缺索引 fallback、frontmatter 依賴循環 finding、舊索引循環診斷不誤報主要 cycle、staleness 歸零但 pendingChanges 未清的索引漂移 |
| 過期分析器 | 11 | 過期等級四分支、三種事件計分、閾值觸發 |
| 路徑安全驗證 | 8 | 絕對/相對路徑、穿越攻擊拒絕 |
| 時間戳格式 | 3 | ISO 8601 格式、台灣時區後綴 |
| 離線變動偵測 | 10 | 啟動校驗、目錄跳過、去重、幽靈標記 |
| 警報寫入器 | 9 | 冪等植入、條件式清除、狀態回復 |
| import 掃描器 | 5 | ES/動態/CJS 語法擷取、去重、node_modules 過濾 |
| 依賴傳播引擎 | 8 | 反向圖建構、BFS 傳播深度、平方衰減權重、循環偵測 |
| 依賴語義檢查器 | 6 | dependency reason、父子導覽可疑、技能名稱混用、Relations 鏡像可疑、warning 格式 |
| 過期等級工具 | 5 | healthy、mild、significant、critical 邊界轉換與 config 閾值語義 |
| 依賴拓樸輸出 | 1 | memory_deps 標準 envelope、工程依賴、frontmatter 依賴與 legacy 欄位相容 |
| MCP 工具名冊 | 4 | 工具登錄完整性、治理後設資料、寫入型工具授權要求、開工安全性與工具安全說明 |
| MCP 工具分派 | 6 | registry-driven routing、unknown tool envelope、memory_commit 明確確認防線、v5 context governance 工具路由 |
| MCP 回傳契約 | 2 | envelope 包裝、錯誤格式、台灣時區 metadata 與 legacy 相容欄位 |

---

## 🏗️ 技術架構

```
cartridge_system/
├── src/
│   ├── extension.ts          # VS Code 外掛入口與狀態列
│   ├── mcp-server.ts         # MCP 伺服器路由（SDK 層）
│   ├── mcp-handlers.ts       # MCP 工具商業邏輯（純函式層）
│   ├── tool-registry.ts      # MCP 工具名冊（描述、風險、授權需求、安全說明）
│   ├── tool-dispatcher.ts    # MCP 工具分派與高風險工具防線
│   ├── mcp-response.ts       # 高階治理工具統一回傳 envelope
│   ├── workspace-brief.ts    # 高階開工摘要工具（MCP handler）
│   ├── workspace-brief-summary.ts # 專案健康摘要規則引擎
│   ├── commit-preflight.ts   # 提交前治理檢查工具（MCP handler）
│   ├── commit-preflight-summary.ts # 提交阻塞與建議行動規則引擎
│   ├── memory-audit.ts       # 專案記憶卡完整健檢工具（只讀）
│   ├── memory-compatibility.ts # 舊格式相容模式提醒規則
│   ├── context-types.ts      # v5 規則檔檢查共用型別
│   ├── context-registry.ts   # v5 AI 規則來源清冊掃描器
│   ├── context-audit.ts      # v5 規則衝突與提醒偵測
│   ├── context-tools.ts      # v5 context_inventory/audit/diff/plan MCP handlers
│   ├── governance-views.ts   # v5 Activity Bar 治理側邊欄註冊器
│   ├── governance-tree-provider.ts # v5 治理總覽 TreeView
│   ├── context-tree-provider.ts # v5 規則檔檢查 findings TreeView
│   ├── action-items-provider.ts # v5 stale/ghost/untracked/context 待處理項目 TreeView
│   ├── index-manager.ts      # 記憶索引管理器（路徑掃描 + 反向映射 + 依賴推導）
│   ├── import-resolver.ts    # 🆕 輕量 import 路徑掃描器（ES/動態/CJS）
│   ├── dependency-propagator.ts # 🆕 依賴圖引擎（建構 + 傳播 + 循環偵測）
│   ├── dependency-semantics.ts # dependencies 欄位語義警告檢查器
│   ├── watcher.ts            # 檔案監聽引擎（原生 Watcher + 幽靈即時標記）
│   ├── analyzer.ts           # 過期指數計算器（事件計分 + 時間衰退）
│   ├── writer.ts             # 記憶卡警報寫入器（植入/清除）
│   ├── treeview-provider.ts  # 🌲 TreeView 側邊欄（含幽靈 💀 視覺化）
│   ├── codelens-provider.ts  # 🔍 CodeLens 行內狀態標記
│   ├── smart-owner.ts        # 🧠 智慧歸屬推薦引擎
│   ├── gitignore-filter.ts   # .gitignore 排除引擎（ignore 套件封裝）
│   ├── config.ts             # 外掛設定（閾值、計分、依賴深度）
│   ├── path-guard.ts         # 路徑安全驗證（雙層防禦）
│   ├── timestamp.ts          # 時間戳生成（Intl API）
│   ├── types.ts              # 共用型別定義（含 ghostFiles、dependencies）
│   └── tests/                # vitest 單元測試（21 檔 175 案例）
├── .agents/
│   ├── memory/               # 記憶卡匣（獨立目錄）
│   │   ├── _system/          # 系統記憶
│   │   ├── core-types/       # 共用型別與設定
│   │   ├── index-manager/    # 索引管理器
│   │   ├── extension/        # 外掛入口 ★ 父卡
│   │   │   ├── watcher/      # └ 監聽引擎
│   │   │   ├── analyzer/     # └ 過期分析器
│   │   │   └── writer/       # └ 寫入器
│   │   └── mcp-tools/        # MCP 工具介面
│   │       ├── server/       # MCP SDK server 入口
│   │       ├── handlers/     # 底層 memory_* handler
│   │       ├── tool-registry/# MCP 工具名冊與統一回傳契約
│   │       ├── dispatcher/   # MCP 工具分派與 guardrail
│   │       ├── memory-audit/ # 記憶卡完整健檢工具
│   │       └── context-governance/ # v5 規則檔檢查工具
│   ├── skills/               # 操作技能（框架提供）
│   └── workflows/            # Antigravity 工作流程
└── dist/                     # 編譯輸出（tsup 打包）

> 💡 **治理備註**：`.agents/` 目錄在 Git 中採取「白名單模式」，僅追蹤 `memory/` 核心卡匣，其餘殘留檔案（如 Workflows/Skills）預設不納入版本控制以保持儲存庫輕量化。

├── CHANGELOG.md              # v5.1.0 可讀性與側邊欄治理體驗
└── package.json              # v5.1.0
```

### 技術堆疊

| 項目 | 技術 |
|------|------|
| 語言 | TypeScript 5.x |
| 框架 | VS Code Extension API |
| 檔案監聽 | VS Code 原生 FileSystemWatcher |
| YAML 解析 | gray-matter |
| MCP SDK | @modelcontextprotocol/sdk |
| 打包 | tsup（CJS 輸出，vscode external） |
| 測試 | vitest |
| 知識圖譜 | GitNexus 1.6.4 (pnpm 整合) |
| 程式碼品質 | ESLint v9 + @typescript-eslint |

---

## 📋 更新紀錄

請參閱 [CHANGELOG.md](./CHANGELOG.md)。

---

## 📄 授權

MIT License
