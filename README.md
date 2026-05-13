# 記憶卡匣監控系統（Cartridge System）

> **現實感知 AI 記憶防禦引擎** — 自動偵測記憶卡過期、幽靈檔案、跨模組依賴傳播，確保 AI 不讀取失效的上下文。

[![version](https://img.shields.io/badge/version-4.1.1-blue)](./CHANGELOG.md)
[![tests](https://img.shields.io/badge/tests-112%20passed-brightgreen)](#-執行測試)
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
| 💀 **幽靈偵測** | **v4.0 新增** — 自動標記已追蹤但磁碟不存在的幽靈檔案，側邊欄 💀 圖示視覺化提示，`memory_status` 輸出清理行動指引 |
| 🕸️ **依賴圖引擎** | **v4.0 新增** — 自動掃描 import 語句推導卡匣依賴關係，BFS 演算法傳播間接過期，DFS 偵測循環依賴 |
| 👻 **未歸屬檔案池** | 智能偵測專案內新增但未被任何卡匣記錄的檔案，支援歸屬建議。 |
| 📊 **過期指數計算** | 根據異動類型（新增/修改/刪除）與時間衰退計算分數 |
| 🚨 **警報自動植入** | 過期指數超過閾值時，自動在 SKILL.md 頂部插入攔截警告 |
| 🟢 **狀態列燈號** | VS Code 狀態列即時顯示記憶卡指標（五層等級：🟢🔵🟡🟠🔴）以及 👻 幽靈計數 |
| 🌳 **TreeView 面板**| 記憶卡匣專屬側邊欄，樹狀可視化呈現所有健康指標、幽靈池與 💀 幽靈檔案 |
| 🔍 **CodeLens 標記**| 編輯器頂部行內標記，即時顯示當前檔案所屬的記憶卡與過期狀態 |
| 🛠️ **MCP 工具介面** | 提供五個標準化 AI 工具（純讀取 + 後設同步 + 依賴查詢），支援跨專案動態路徑解析 |
| 🌐 **跨平台相容** | 完整支援 Windows CRLF 與 Unix LF 行尾格式 |
| 🛡️ **路徑安全防禦** | 雙層路徑驗證（Zod 格式守衛 + 語意守衛），阻擋路徑穿越攻擊 |
| 🌲 **巢狀目錄掃描** | 支援最大 4 層深度的記憶卡樹狀結構，目錄結構即層級 |
| 📂 **獨立記憶目錄** | 記憶卡存放於 `.agents/memory/`，與操作技能完全分離 |
| 🗃️ **系統目錄隱藏** | 外掛啟動時自動將 `.cartridge/` 寫入 VS Code 工作區排除名單，保持檔案總管整潔 |

---

## 🚀 安裝方式

### 方法一：透過 Antigravity IDE 安裝（推薦）

```bash
# 先建構外掛安裝檔
cd d:\cartridge_system
npm run build
npm run package

# 使用 Antigravity IDE CLI 安裝（注意：不可用 code 指令）
antigravity --install-extension cartridge-system-4.1.1.vsix --force
```

### 方法二：開發模式

```bash
git clone https://github.com/Kunshao1117/cartridge_system.git
cd cartridge_system
npm install
npm run build
# 按 F5 啟動 Extension Development Host
```

> ⚠️ **注意**：修改 `src/` 後必須重新執行 `npm run build`，外掛才會載入新版本。

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
| `memory_read` | 讀取特定記憶技能的完整 SKILL.md 內容（自動解析巢狀點分隔路徑） |
| `memory_status` | 查詢過期修復診斷：過期指數、待處理異動、**幽靈檔案清單**及清理行動指引 |
| `memory_commit` | AI 寫入 SKILL.md 後呼叫，自動完成：時間戳注入、staleness 歸零、索引同步、**幽靈清除** |
| `memory_deps` | **v4.0 新增** — 查詢卡匣依賴拓樸：上游依賴、下游被依賴者、間接過期指數、循環依賴警告 |

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
// → 回傳 dependencies（依賴誰）、dependents（誰依賴我）、indirectStaleness

// ✅ 推薦流程：先用原生工具寫入 SKILL.md，再呼叫 memory_commit 同步
memory_commit({
  moduleName: 'dashboard-ui',
  projectRoot: 'D:\\bartender_map'
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
| `記憶卡匣：歸屬到記憶卡…` | 透過 QuickPick 介面將當前檔案或選定檔案一鍵歸檔至目標記憶卡 |

---

## 🧪 執行測試

```bash
# 執行完整測試套件
npm test

# 監聽模式（開發時使用）
npm run test:watch
```

測試涵蓋 9 個測試檔案（**112 個案例**）：

| 測試模組 | 案例數 | 涵蓋範圍 |
|----------|--------|----------|
| 索引管理器 | 18 | 掃描、addPendingChange 去重、getChildren、resolveModulePath |
| MCP 工具介面 | 41 | 正常流程、路徑穿越防禦、時間戳驗證、過期狀態診斷、memory_commit 後設同步、**標題錯字偵測 (HEADING_TYPO)**、**路徑格式驗證 (PATH_ABSOLUTE / PATH_TRAVERSAL)**、**警告區塊自動清除** |
| 過期分析器 | 11 | 過期等級四分支、三種事件計分、閾值觸發 |
| 路徑安全驗證 | 8 | 絕對/相對路徑、穿越攻擊拒絕 |
| 時間戳格式 | 3 | ISO 8601 格式、台灣時區後綴 |
| 離線變動偵測 | 10 | 啟動校驗、目錄跳過、去重、幽靈標記 |
| 警報寫入器 | 9 | 冪等植入、條件式清除、狀態回復 |
| import 掃描器 | 5 | ES/動態/CJS 語法擷取、去重、node_modules 過濾 |
| 依賴傳播引擎 | 7 | 反向圖建構、BFS 傳播深度、循環偵測 |

---

## 🏗️ 技術架構

```
cartridge_system/
├── src/
│   ├── extension.ts          # VS Code 外掛入口與狀態列
│   ├── mcp-server.ts         # MCP 伺服器路由（SDK 層）
│   ├── mcp-handlers.ts       # MCP 工具商業邏輯（純函式層）
│   ├── index-manager.ts      # 記憶索引管理器（路徑掃描 + 反向映射 + 依賴推導）
│   ├── import-resolver.ts    # 🆕 輕量 import 路徑掃描器（ES/動態/CJS）
│   ├── dependency-propagator.ts # 🆕 依賴圖引擎（建構 + 傳播 + 循環偵測）
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
│   └── tests/                # vitest 單元測試（9 檔 112 案例）
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
│   ├── skills/               # 操作技能（框架提供）
│   └── workflows/            # Antigravity 工作流程
├── dist/                     # 編譯輸出（tsup 打包）
├── CHANGELOG.md              # 更新紀錄
└── package.json              # v4.1.1
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
| 程式碼品質 | ESLint v9 + @typescript-eslint |

---

## 📋 更新紀錄

請參閱 [CHANGELOG.md](./CHANGELOG.md)。

---

## 📄 授權

MIT License
