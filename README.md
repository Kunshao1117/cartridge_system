# 記憶卡匣監控系統（Cartridge System）

> **主動式 AI 記憶防禦引擎** — 自動偵測記憶卡過期、植入攔截警報，確保 AI 不讀取失效的上下文。

[![version](https://img.shields.io/badge/version-0.3.0-blue)](./CHANGELOG.md)
[![tests](https://img.shields.io/badge/tests-87%20passed-brightgreen)](#-執行測試)
[![license](https://img.shields.io/badge/license-MIT-green)](#)

---

## 📌 這是什麼？

Cartridge System 是一個為 [Antigravity 框架](https://github.com/Kunshao1117/cartridge_system) 設計的 **VS Code 延伸模組 + MCP 工具伺服器**。

它解決了一個根本問題：**AI 在跨會話工作時，往往不知道自己的「記憶」是否已過時。**

當你修改了專案原始碼，但忘記更新對應的記憶技能（`mem-*` 檔案）時，Cartridge System 會：

1. **即時偵測** — 透過 chokidar 監聽所有被記憶技能列管的原始碼異動
2. **計算過期指數** — 使用衰退演算法計算每張記憶卡的「失效程度」
3. **植入警報** — 在過期的記憶技能頂部自動插入攔截警告，阻止 AI 讀取舊資料
4. **引導更新** — AI 更新記憶卡後，系統自動清除警報，恢復健康狀態
5. **動態追蹤** — 記憶卡新增追蹤檔案時，監聽器即時更新，不需重啟 IDE

---

## ✨ 功能一覽

| 功能 | 說明 |
|------|------|
| 🔍 **即時檔案監聽** | 使用 chokidar v4 監聽所有被記憶技能列管的原始碼檔案，支援動態新增/移除 |
| 📊 **過期指數計算** | 根據異動類型（新增/修改/刪除）與時間衰退計算分數 |
| 🚨 **警報自動植入** | 過期指數超過閾值時，自動在 SKILL.md 頂部插入攔截警報 |
| 🟢 **狀態列燈號** | VS Code 狀態列即時顯示記憶卡健康概覽（🟢/🟠/🔴） |
| 🛠️ **MCP 工具介面** | 提供三個標準化 AI 工具，支援跨專案動態路徑解析 |
| 🔄 **監聽器動態更新** | 記憶卡追蹤清單變更時，自動 diff 並動態調整 chokidar 監聽清單 |
| 🌐 **跨平台相容** | 完整支援 Windows CRLF 與 Unix LF 行尾格式 |
| 🛡️ **路徑安全防禦** | 雙層路徑驗證（Zod 格式守衛 + 語意守衛），阻擋路徑穿越攻擊 |

---

## 🚀 安裝方式

### 方法一：透過 Antigravity IDE 安裝（推薦）

```bash
# 先建構外掛安裝檔
cd d:\cartridge_system
npm run build
npm run package

# 使用 Antigravity IDE CLI 安裝（注意：不可用 code 指令）
antigravity --install-extension cartridge-system-0.3.0.vsix --force
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
| `memory_list` | 列出指定專案中所有記憶卡匣的名稱、過期指數與追蹤檔案數 |
| `memory_read` | 讀取特定記憶技能的完整 SKILL.md 內容 |
| `memory_update` | 更新記憶技能內容，支援 `replace`（整張替換）、`append`（附加到末尾）、`patch`（`##` 區段級替換）三種模式 |

### 跨專案支援

所有工具均透過必填的 `projectRoot` 參數指定目標專案，無需為每個專案啟動獨立的 MCP 伺服器：

```javascript
// 範例：讀取 bartender_map 專案的系統記憶
memory_read({
  moduleName: 'mem-_system',
  projectRoot: 'D:\\bartender_map'
})

// 範例：附加一條教訓到記憶卡
memory_update({
  moduleName: 'mem-dashboard-ui',
  content: '## Module Lessons\n- D19: 新教訓內容',
  mode: 'append',
  projectRoot: 'D:\\bartender_map'
})

// 範例：精確更新特定區段（patch 模式，不需先讀取完整檔案）
memory_update({
  moduleName: 'mem-dashboard-ui',
  content: '## Known Issues\n- 更新後的已知問題清單\n',
  mode: 'patch',
  projectRoot: 'D:\\bartender_map'
})
```

---

## ⌨️ VS Code 指令

安裝後，可透過指令面板（`Ctrl+Shift+P`）使用以下指令：

| 指令 | 說明 |
|------|------|
| `記憶卡匣：重新掃描索引` | 強制重新讀取所有記憶技能，重建監聽清單 |
| `記憶卡匣：查看健康報告` | 在輸出面板顯示所有記憶卡的詳細狀態 |

---

## 🧪 執行測試

```bash
# 執行完整測試套件（87 個案例）
npm test

# 監聽模式（開發時使用）
npm run test:watch
```

測試涵蓋 6 個測試檔案：

| 測試模組 | 案例數 | 涵蓋範圍 |
|----------|--------|----------|
| 路徑解析邏輯 | 12 | 反引號去除、說明文字截斷、CRLF 相容、分組標題過濾、HTML 標記過濾 |
| MCP 工具介面 | 44 | 正常流程、路徑穿越防禦、時間戳驗證、replace/append/patch 三模式、段落解析與合併 |
| 過期分析器 | 11 | 過期等級四分支、三種事件計分、閾值觸發 |
| 警報寫入器 | 9 | 冪等植入、條件式清除、狀態回復 |
| 路徑安全驗證 | 8 | 絕對/相對路徑、穿越攻擊拒絕 |
| 時間戳格式 | 3 | ISO 8601 格式、台灣時區後綴 |

---

## 🏗️ 技術架構

```
cartridge_system/
├── src/
│   ├── extension.ts       # VS Code 外掛入口與狀態列
│   ├── mcp-server.ts      # MCP 伺服器路由（SDK 層）
│   ├── mcp-handlers.ts    # MCP 工具商業邏輯（純函式層）
│   ├── index-manager.ts   # 記憶索引管理器（路徑掃描 + 反向映射）
│   ├── watcher.ts         # 檔案監聽引擎（chokidar + 動態 refresh）
│   ├── analyzer.ts        # 過期指數計算器（事件計分 + 時間衰退）
│   ├── writer.ts          # 記憶卡警報寫入器（植入/清除）
│   ├── config.ts          # 外掛設定（閾值、計分權重）
│   ├── path-guard.ts      # 路徑安全驗證（雙層防禦）
│   ├── timestamp.ts       # 時間戳生成（Intl API）
│   ├── types.ts           # 共用型別定義
│   └── tests/             # vitest 單元測試（6 檔 87 案例）
├── .agents/
│   ├── skills/mem-*/      # 各模組的記憶技能（8 個）
│   ├── workflows/         # Antigravity 工作流程
│   └── logs/              # 審計日誌與教訓日誌
├── dist/                  # 編譯輸出（tsup 打包）
├── CHANGELOG.md           # 更新紀錄
└── package.json           # v0.3.0
```

### 技術堆疊

| 項目 | 技術 |
|------|------|
| 語言 | TypeScript 5.x |
| 框架 | VS Code Extension API |
| 檔案監聽 | chokidar v4 |
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
