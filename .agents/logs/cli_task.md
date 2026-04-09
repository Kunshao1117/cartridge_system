# 程式碼品質與安全掃描任務

## 角色
程式碼品質與安全掃描員

## 輸出路徑
d:\cartridge_system\.agents\logs\scan_report.md

## 掃描任務區塊

### 1. ESLint 程式碼品質掃描（優先用專案本地工具）
優先使用 run_shell_command 執行：
cd d:\cartridge_system; npx eslint --format json .
如果專案沒有安裝 ESLint，則改用 MCP 工具：
gateway__call_tool 呼叫 eslint__lint-files，傳入檔案路徑：
package.json
src/types.ts
src/config.ts
src/extension.ts
src/status-bar.ts
src/index-manager.ts
src/tests/index-manager.test.ts
src/tests/detect-missed-changes.test.ts
src/mcp-server.ts
src/mcp-handlers.ts
src/path-guard.ts
src/timestamp.ts
src/tests/mcp-handlers.test.ts
src/tests/path-guard.test.ts
src/tests/timestamp.test.ts
統計：錯誤總數 / 警告總數 / 最常違反的前 5 條規則 / 前 10 項嚴重問題

### 2. Snyk 原始碼安全掃描（MCP 工具）
使用 gateway__call_tool 呼叫 snyk__snyk_code_scan，path 設為 d:\cartridge_system
統計：漏洞總數（Critical / High / Medium / Low）/ 前 5 項最嚴重漏洞
> 降級：若 Snyk 認證不可用（snyk__snyk_auth 未完成），跳過此步驟並在報告中注記「Snyk 未認證，已跳過」。

### 3. Snyk 依賴漏洞掃描（MCP 工具）
使用 gateway__call_tool 呼叫 snyk__snyk_sca_scan，path 設為 d:\cartridge_system
統計：漏洞總數 / 前 5 項最嚴重的依賴漏洞
> 降級：若 Snyk 認證不可用，改用 `run_shell_command` 執行 `npm audit --json` 或 `yarn audit --json`，並按相同格式統計漏洞。

### 4. TypeScript 型別檢查
執行：cd d:\cartridge_system; npx tsc --noEmit
統計錯誤總數和前 10 項錯誤。

### 5. 代辦標記統計
使用 grep_search 掃描 TODO / FIXME / HACK / XXX / TEMP 標記。

### 6. 環境變數一致性
讀取 .env.example，搜尋 process.env 引用，比對差異。

### 7. 健康掃描腳本
請執行以下命令生成附帶報告：
pwsh .agents/scripts/Invoke-HealthAudit.ps1 -ProjectRoot d:\cartridge_system -AgentsDir d:\cartridge_system\.agents -Module all
