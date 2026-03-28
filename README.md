# 記憶卡匣監控系統（Cartridge System）

> **主動式 AI 記憶防禦引擎** — 自動偵測記憶卡過期、植入攔截警報，確保 AI 不讀取失效的上下文。

[![version](https://img.shields.io/badge/version-0.1.2-blue)](./CHANGELOG.md)
[![license](https://img.shields.io/badge/license-MIT-green)](#)

---

## 📌 這是什麼？

Cartridge System 是一個為 [Antigravity 框架](https://github.com/Kunshao1117/cartridge_system) 設計的 VS Code 延伸模組 + MCP 工具伺服器。

它解決了一個根本問題：**AI 在跨會話工作時，往往不知道自己的「記憶」是否已過時。**

當你修改了專案原始碼，但忘記更新對應的記憶技能（`mem-*` 檔案）時，Cartridge System 會：

1. **即時偵測** — 透過檔案監聽器追蹤被記憶技能列管的原始碼異動
2. **計算過期指數** — 使用衰退演算法計算每張記憶卡的「失效程度」
3. **植入警報** — 在過期的記憶技能頂部自動插入攔截警告，阻止 AI 讀取舊資料
4. **引導更新** — AI 更新記憶卡後，系統自動清除警報，恢復健康狀態

---

## ✨ 功能一覽

| 功能 | 說明 |
|------|------|
| 🔍 **即時檔案監聽** | 使用 chokidar 監聽所有被記憶技能列管的原始碼檔案 |
| 📊 **過期指數計算** | 根據異動數量與時間計算衰退分數（0–100） |
| 🚨 **警報自動植入** | 過期指數超過閾值時，自動在 `mem-*.md` 頂部插入 YAML 警報區塊 |
| 🟢 **狀態列燈號** | VS Code 狀態列即時顯示記憶卡健康概覽 |
| 🛠️ **MCP 工具介面** | 提供三個標準化 AI 工具，供 AI 代理人查詢與更新記憶 |

---

## 🚀 安裝方式

### 方法一：透過 Antigravity IDE 安裝（推薦）

```bash
# 先建構外掛安裝檔
cd d:\cartridge_system
npm run build
npx vsce package

# 使用 Antigravity IDE CLI 安裝（注意：不可用 `code` 指令）
antigravity --install-extension cartridge-system-0.1.2.vsix
```

### 方法二：開發模式（直接從原始碼）

```bash
git clone https://github.com/Kunshao1117/cartridge_system.git
cd cartridge_system
npm install
npm run build
```

> ⚠️ **注意**：修改 `src/` 後必須重新執行 `npm run build`，外掛才會載入新版本。

---

## 🤖 MCP 工具伺服器設定

Cartridge System 同時提供 MCP（Model Context Protocol）工具伺服器，供 AI 代理人透過標準化介面存取記憶系統。

### 設定方式

在你的 AI 工具（如 Gemini CLI、Claude Desktop）的 MCP 設定檔中加入：

```json
{
  "mcpServers": {
    "cartridge-system": {
      "command": "node",
      "args": [
        "d:\\cartridge_system\\dist\\mcp-server.js",
        "--workspace",
        "你的專案根目錄路徑"
      ]
    }
  }
}
```

### `--workspace` 參數

> **這是最重要的參數。**

`--workspace` 指定 MCP 伺服器應掃描哪個專案的 `.agents/skills/` 目錄。

```bash
# 範例：監控 bartender_map 專案的記憶技能
node dist/mcp-server.js --workspace "D:\bartender_map"

# 若不指定，伺服器會使用當前工作目錄（通常是 Gateway 的目錄，這是錯誤的）
node dist/mcp-server.js  # ❌ 不建議
```

### 可用工具

| 工具名稱 | 說明 |
|----------|------|
| `memory_list` | 列出所有記憶技能及其過期指數 |
| `memory_read` | 讀取特定記憶技能的完整內容 |
| `memory_update` | 更新記憶技能內容並重置過期指數 |

---

## VS Code 指令

安裝後，可透過指令面板（`Ctrl+Shift+P`）使用以下指令：

| 指令 | 說明 |
|------|------|
| `記憶卡匣：重新掃描索引` | 強制重新讀取所有記憶技能，重建監聽清單 |
| `記憶卡匣：查看健康報告` | 在輸出面板顯示所有記憶卡的詳細狀態 |

---

## 🧪 執行測試

```bash
# 執行完整測試套件（18 個案例）
npm test

# 監聽模式（開發時使用）
npm run test:watch
```

測試涵蓋：
- **路徑解析邏輯**（9 個案例）：反引號去除、說明文字截斷、空行過濾等邊界情境
- **MCP 工具介面**（9 個案例）：正常流程、錯誤邊界、Zod 參數驗證

---

## 🏗️ 技術架構

```
cartridge_system/
├── src/
│   ├── extension.ts       # VS Code 外掛入口
│   ├── mcp-server.ts      # MCP 伺服器路由（SDK 層）
│   ├── mcp-handlers.ts    # MCP 工具商業邏輯（純函式層）
│   ├── index-manager.ts   # 記憶索引管理器
│   ├── watcher.ts         # 檔案監聽引擎
│   ├── analyzer.ts        # 過期指數計算器
│   └── writer.ts          # 記憶卡警報寫入器
├── .agents/
│   ├── skills/mem-*/      # 各模組的記憶技能
│   └── workflows/         # Antigravity 工作流程
└── CHANGELOG.md
```

---

## 📋 更新紀錄

請參閱 [CHANGELOG.md](./CHANGELOG.md)。

---

## 📄 授權

MIT License
