# 更新紀錄

## [Unreleased]

## [5.3.4] — 2026-05-19

### feat

- 插件更新檢查 — VSIX 安裝版啟動時會查詢 GitHub Release 最新正式版，若新版 Release 含 `cartridge-system-*.vsix` 則提示開啟 Release；同時新增 `Cartridge：檢查插件更新` 手動命令與 `cartridge.updateCheck.enabled` 啟動檢查設定。

### chore

- 測試覆蓋 — 新增插件更新檢查單元測試與 manifest 設定回歸測試，總測試案例提升至 220 個。

## [5.3.3] — 2026-05-19

### feat

- AI 記憶圖譜工具 — 新增只讀 `memory_graph` MCP 工具，輸出整體卡匣 overview、cards、lines 與 `aiReadingGuide`，支援三艙位視角與 `focusModule` 一跳關聯範圍。
- 卡匣機櫃縮放控制 — 圖譜右下角新增縮小、百分比、放大控制，點百分比可回到 100%，並加快滾輪縮放速度。

### chore

- 測試覆蓋 — 新增 `memory_graph`、縮放百分比 helper、工具名冊與 dispatcher 路由回歸測試，總測試案例提升至 212 個。

## [5.3.2] — 2026-05-19

### fix

- 卡匣機櫃圖譜穩定性 — 修復縮放或平移後因重新 layout 跳回原始位置的問題，三個艙位會各自保存視角，點選卡匣只更新詳情與聚焦狀態。
- 卡匣機櫃可讀性 — 放大中央圖譜節點與文字、提高連線對比並降低格線干擾，讓卡匣與上下游關係在一般視窗大小下更容易辨識。
- 工作台控制語意 — 將右下角 `FIT` / `R` 改為 `重置視角` / `刷新資料`，保留 tooltip 與 aria-label。

### chore

- 測試覆蓋 — 新增圖譜 viewport helper 回歸測試，補強控制文字驗收，總測試案例提升至 204 個。

## [5.3.1] — 2026-05-19

### fix

- 卡匣機櫃工作台視覺重設計 — 將原本差異不明顯的三顆模式按鈕改為左側三艙位模式艙門，維護艙、記憶艙、結構艙會分別切換統計、篩選、圖譜樣式、layout 與右側詳情面板。
- 記憶艙差異修復 — 新增工作台專用推導層，從 metadata 的 tags、concepts、aliases 與 Relations 產生 note 記憶連線，並以記憶分數驅動節點呈現，避免記憶模式只剩卡槽線。
- 卡匣聚焦互動 — 點選卡匣後會聚光選中節點、標示相鄰卡匣與上下游連線，並淡化無關節點，讓搜尋與篩選後的上下文更清楚。

### chore

- 測試覆蓋 — 補強卡匣機櫃三模式統計、metadata note 連線與新版 Webview HTML 結構測試，總測試案例提升至 200 個。

## [5.3.0] — 2026-05-19

### feat

- 卡匣機櫃工作台 — 新增 `Cartridge：開啟卡匣機櫃`，從側邊欄入口在編輯區開啟 WebviewPanel，以卡匣、卡槽、訊號線與熱度線呈現記憶卡關係。
- 工作台資料模型 — 新增卡匣工作台模型與 V2 metadata 相容解析，優先讀取 `title`、`summary`、`tags`、`concepts`、`aliases`，缺失時回退到既有記憶卡描述與章節。
- Gateway-first workspace — MCP dispatcher 會以 Gateway 每次呼叫提供的 `workspace` 或 CLI `--workspace` 補齊 `projectRoot`；若可信 workspace 與 `arguments.projectRoot` 不一致，會回傳 `workspace_project_root_conflict`，避免多專案路徑污染。
- npm MCP runtime — package 新增 `cartridge-system` / `cartridge-mcp` bin，可用 `npx cartridge-system --workspace <projectRoot>` 啟動 MCP server；MCP server 同步支援 `--help`、`--version` 與 `--workspace`。
- 公開 schema 相容 — 十二個 MCP tools/list schema 保留 `projectRoot` 欄位但不再列為 required，讓 Gateway / CLI 可集中補路徑，同時維持舊客戶端手動傳參相容。

### fix

- 依賴安全修補 — 更新 lockfile 中 `fast-uri`、`hono`、`express-rate-limit`、`ip-address` 與 `postcss` 的相容版本，`npm audit` 由 1 high / 4 moderate 降為 0 vulnerabilities。
- MCP 輸入防線 — `memory_read`、`memory_status`、`memory_commit`、`memory_deps` 共用 `moduleName` 驗證，拒絕 `/`、`\`、`..` 等路徑片段；`memory_commit` handler 層也要求 `confirm:true`，與 dispatcher 防線一致。
- 記憶索引一致性 — `memory_audit` 新增 `INDEX_PENDING_WITH_ZERO_STALENESS`，可偵測 staleness 已歸零但 pendingChanges 未清的索引漂移。
- Windows npm script 穩定性 — 文件補上 User 層 `ComSpec=C:\Windows\System32\cmd.exe` 修復方式，避免 `npm run lint/test/build` 只輸出 script header 後以 `ERR_INVALID_ARG_TYPE` 結束。
- 記憶 watcher 穩定性 — `SKILL.md` 變更事件會正規化 Windows 路徑分隔符後比對索引 `skillPath`，並同步清除 pending 與 ghost，避免 extension RAM index 覆寫 `memory_commit` 已清理的磁碟索引。

### chore

- npm 發布白名單 — `package.json` 新增 `files` 與 `prepublishOnly`，npm tarball 僅包含 runtime JS、assets 與公開文件，避免 `.agents/`、`src/`、測試、source map 與 GitHub workflow 被發布。
- VSIX 打包腳本 — `npm run package` 改由 `scripts/package-vsix.mjs` 執行，統一使用 `package.json.files` 白名單並可重複覆蓋同版本 VSIX。
- npm manifest 正規化 — package repository URL 與 `bin` path 對齊 `npm publish --dry-run` 實際正規化結果，避免發布前測試與 npm 產物形狀不一致。
- 打包白名單收斂 — 移除與 `package.json.files` 互斥的 `.vscodeignore`，避免 VSCE 3.x 在本機與 GitHub Actions 打包時中止。
- VSIX 自動發版 — 新增 GitHub Actions 發布流程，支援推送 `v*` tag 自動建立 / 更新 Release，也支援手動輸入版本補發並覆蓋 VSIX 附件。
- 發布文件 — README 新增 GitHub Releases 下載入口、tag 發版步驟與 Actions 手動補發說明。
- 測試覆蓋 — 補強 moduleName 路徑片段拒絕、memory_commit confirm 驗證、memory_audit 索引漂移偵測、Gateway workspace 注入、MCP server CLI 解析、watcher 路徑分隔符同步與卡匣機櫃模型/Webview HTML，總測試案例提升至 199 個。

## [5.1.0] — 2026-05-17

### feat

- AI 開工清單 — `workspace_brief` 新增 `startupReadiness`，用「可以開工」、「需要先處理記憶卡提醒」、「需要先處理規則檔衝突」這類白話狀態說明下一步。
- 規則檔檢查 — `context_audit` findings 新增白話原因、相關檔案、是否阻塞、建議工具與建議動作，讓 AI 與側邊欄不用猜測 finding 代表什麼。
- 側邊欄可讀性 — `治理總覽`、`上下文治理` 與 `待處理項目` 改用使用者看得懂的標籤，例如「AI 開工狀態」、「規則檔檢查」、「歸屬檔案」。
- MCP 工具安全說明 — 工具名冊新增 `safetySummary`、`safeForStartup` 與 `expectedLatency`，MCP tools/list 描述會包含安全性說明。

### chore

- 版本升級 — package 與 MCP server 版本同步至 5.1.0。
- 測試覆蓋 — 補強 workspace_brief、context governance、governance sidebar 與 tool registry 測試，總測試案例提升至 175 個。
- 文件同步 — README 改用「AI 開工檢查」、「規則檔檢查」、「側邊欄提醒」描述 v5.1 功能，並同步 21 個測試檔案、175 個測試案例。

## [5.0.0] — 2026-05-17

### feat

- 上下文治理 OS — 新增 `context_inventory`、`context_audit`、`context_diff`、`context_plan` 四個只讀 MCP 工具，將 Cartridge 從記憶卡健康監控擴展為跨代理上下文治理入口。
- Context Registry — 掃描 Codex `AGENTS.md`、Claude `CLAUDE.md` / skills / subagents、GitHub Copilot instructions、Antigravity skills 與 `.agents/memory/`，產出 owner、scope、priority、supported agents、tracked files、dependencies、staleness 與 risk。
- Cross-Agent Drift Audit — 偵測多代理上下文中的語言規則、提交授權與寫入政策衝突；提交與寫入政策衝突列為 blocking，語言差異列為 warning，重複規則列為 informational。
- Workspace Brief 升級 — `workspace_brief` 新增 context readiness，AI 開工前可同時看到記憶健康與上下文治理狀態。
- MCP 工具名冊擴充 — tools/list 從八個工具擴充為十二個工具，維持統一 envelope 與 read-only v5.0 範圍。
- 獨立治理側邊欄 — VS Code Activity Bar 新增 Cartridge container，將 `cartridgeExplorer` 從 Explorer 移入獨立側邊欄，並新增 `治理總覽`、`上下文治理`、`待處理項目` 三個原生 TreeView。
- 治理側邊欄指令 — 新增 `cartridge.openGovernanceDashboard`、`cartridge.refreshGovernance`、`cartridge.contextAudit`，維持只讀診斷、開檔與引導修復邊界。

### fix

- 未歸屬自動清除 — 記憶卡 `SKILL.md` 變更後會重新 scan、refilter `untrackedFiles` 並 flush index；已加入 `## Tracked Files` 的檔案不再需要手動執行「重新掃描未歸屬檔案」才會從側邊欄消失。
- 記憶卡事件排除修復 — `.agents/memory/**/SKILL.md` 會在 `.gitignore` / exclude 檢查前優先處理，避免專案 `.gitignore` 的 `.agents/*` 規則擋掉記憶卡同步事件。
- `memory_commit` 回歸覆蓋 — 補強測試確認 trackedFiles 會同步更新 fileMap、已歸卡檔案會自動移出 `untrackedFiles`，且 `ghostFiles`、`pendingChanges`、`staleness` 仍維持清除行為。

### chore

- 版本升級 — package 與 MCP server 版本同步至 5.0.0。
- 測試覆蓋 — 新增 context governance、governance sidebar 與 watcher untracked refilter 測試，總測試案例提升至 174 個，測試檔案提升至 21 個。
- 文件同步 — README 更新為十二個 MCP 工具、21 個測試檔案、174 個測試案例、v5 上下文治理架構、獨立 Activity Bar 側邊欄與未歸屬自動清除行為。

## [2026-05-14]

### feat

- 專案治理入口 — 新增開工摘要工具，讓 AI 可在進入專案前快速掌握記憶卡健康、幽靈檔案、未歸屬檔案與建議下一步。
- 提交前治理檢查 — 新增提交前檢查工具，彙整記憶健康、Git 工作樹狀態、阻塞原因與建議驗證命令，降低混合變更直接提交的風險。
- MCP 工具名冊 — 新增集中式工具名冊，統一管理工具描述、風險等級、讀寫屬性與授權需求。
- MCP 工具防線 — 新增集中式工具分派層，讓高風險寫入工具必須取得明確確認後才會執行。
- 記憶依賴語義 — 新增記憶卡依賴語義警告，協助辨識父子導覽、技能建議與缺少依賴理由的錯誤依賴寫法。
- MCP 操作摘要 — 強化依賴拓樸、開工摘要與提交前檢查輸出，分層呈現工程依賴、frontmatter 依賴、提交 readiness 與 dependency semantics 摘要。
- 治理回傳契約 — 高階治理工具採用統一狀態回傳格式，讓 AI 與未來插件介面可穩定解析摘要、發現項目與建議行動。
- MCP 報告標準化 — `memory_deps` 採用統一 envelope，並以 `legacy` 欄位保留舊版依賴拓樸輸出，降低 AI 判讀成本與相容風險。
- MCP 介面收斂 — `memory_list`、`memory_read`、`memory_status`、`memory_commit` 也改採統一 envelope，成功與錯誤回傳都具備 `status`、`summary`、`findings`、`recommendedActions`、`metadata` 與 `legacy`。
- MCP 依賴圖瘦身 — 抽出共用路徑驗證、時間戳與過期等級工具，並移除高階治理工具對底層 handlers 的不必要型別依賴，讓 Memory Graph 更貼近實際模組分層。
- MCP 雙重驗證 — 補齊 `dist/mcp-server.js` stdio JSON-RPC E2E 與 `multi-mcp-gateway` 真實工具入口驗證，確認七個 MCP 工具可被協議層與 Gateway 正常列出並呼叫。
- 記憶卡完整健檢 — 新增只讀 `memory_audit` MCP 工具，完整掃描記憶卡 frontmatter、Tracked Files、索引漂移、舊格式相容、依賴循環與 dependencies 語義可疑項。
- 雙層預防架構 — `workspace_brief` 與 `commit_preflight` 新增日常 compatibility warning，遇到舊索引或格式漂移時建議 AI 執行 `memory_audit`，但不自動修復或遷移。
- 記憶循環來源分層 — `memory_audit` 改以即時 frontmatter graph 與 engineering graph 判斷主要循環，並將 persisted index cycle 降為診斷資訊，避免舊索引殘留誤判專案健康。
- 文件同步 — README 更新為八個 MCP 工具、18 個測試檔案、161 個測試案例、工具名冊、治理回傳契約、工具防線、依賴語義警告、cycle 來源分層與最新治理架構檔案。

### fix

- 依賴過期傳播 — 深層依賴的間接過期權重改為平方衰減，降低多層傳播造成的誤報強度。
- MCP 版本宣告 — MCP server 對外版本同步至目前套件版本，避免 Gateway 與使用者看到過期版本號。
- GitNexus CLI 環境 — 修復 Windows 使用者層級的 `npx gitnexus` 入口，避免其他專案再次撞到殘缺全域 shim。
- 記憶工程循環 — 將過期等級判斷移至共用 `staleness.ts`，解除 `writer.ts` 對 `analyzer.ts` 的依賴，讓 `extension.analyzer` 與 `extension.writer` 的工程循環歸零。

### chore

- 記憶卡治理 — 新增高階 MCP 工具子卡，並同步系統、資產、MCP 工具與依賴引擎記憶。
- 測試覆蓋 — 新增工具名冊與治理回傳契約單元測試，總測試案例提升至 128 個。
- 測試覆蓋 — 新增工具分派與記憶依賴語義檢查測試，總測試案例提升至 141 個。
- 測試覆蓋 — 拆分 workspace_brief、commit_preflight 與 staleness 測試，總測試案例提升至 149 個。
- 測試覆蓋 — 新增底層 memory_* 工具 envelope 契約測試，總測試案例提升至 154 個。
- 測試覆蓋 — 新增 memory_audit 與舊索引相容提醒測試，總測試案例提升至 159 個。
- 測試覆蓋 — 新增 memory_audit cycle 來源分層與 getStalenessLevel 共用語義測試，總測試案例提升至 161 個。

## [4.1.1] — 2026-05-13

### 🚀 治理與治理 (Governance & Governance)

- **GitNexus 知識圖譜整合** — 完成 GitNexus 1.6.4 環境部署與索引建立（576 節點 / 1198 關係）。修復 pnpm 編譯權限與 ONNX 執行階段路徑鎖定問題，實現全專案程式碼智慧感知與影響分析能力
- **專案身份濃縮 (Condense)** — 執行 `/05_condense` 工作流，將專案身份（TS/VSCode Extension API）與工作模式正式萃取並轉為英文版，同步鎖定至 `AGENTS.md`、`CLAUDE.md` 與 `_system` 記憶卡保護區段
- **Git 儲存庫輕量化治理** — 優化 `.gitignore` 配置採「白名單模式」，全域忽略 `.agents/` 殘留追蹤（123 個檔案）但精確保留 `.agents/memory/` 核心記憶。新增 `*.vsix` 排除規則，確保儲存庫維持輕量且身份一致

### 🔧 修復

- **幽靈熱更新修復** — 修正幽靈檔案標記後 UI 未即時刷新的時序 Bug。`watcher.ts` 的 `handleEvent()` 在 `markGhostFile()` 迴圈結束後補呼叫 `markDirty()`，確保 TreeView 與狀態列的 💀 圖示能在刪除追蹤檔案的瞬間更新，不再需要手動重掃或重啟外掛
- **幽靈點選互動修復** — 修正 TreeView 幽靈檔案項目點擊靜音的問題。幽靈 TreeItem 新增 `command` 綁定 `cartridge.showGhostFileInfo`，點擊後彈出 Modal 警告框，顯示幽靈路徑與修復指引，並提供「開啟記憶卡」快捷按鈕
- **健康報告補充幽靈段落** — `cartridge.status` 指令輸出面板新增 `💀 幽靈檔案報告` 獨立段落，列出磁碟不存在但仍登記在追蹤清單中的幽靈路徑與修復指引
- **新增幽靈詳情指令** — 新增 `cartridge.showGhostFileInfo` 指令（由 TreeView 💀 項目點擊觸發），以 modal 顯示幽靈檔案路徑、所屬記憶卡名稱與修復說明

### 🛡️ 穩定性強化

- **記憶卡解析正則容錯升級** — `parseTrackedFiles()` 正則升級為接受 `## Tracked Files` 行尾空格（`[ \t]*`），並以 `\s*$` 支援 EOF 無換行情境，防止些微格式偏差導致追蹤清單靜默回傳空陣列
- **掃描引擎 I/O 雙層防護** — `scanRecursive()` 的 `readFileSync` 與 `matter()` 各自包裝獨立 try-catch；YAML 格式錯誤或讀取失敗改為 `console.warn` 跳過並繼續；新增格式異常偵測：`trackedFiles` 解析為空但 content 含 `## Tracked` 的卡片將輸出 `console.warn` 協助診斷
- **依賴傳播引擎崩潰防護** — `buildAndMergeDependencies()` 的 `require()` 呼叫包裝 try-catch，載入失敗時輸出 `console.error` 並繼續，不崩潰插件
- **unhandled Promise 修復** — `debounceEvent()` 的 setTimeout callback 改為 `void this.handleEvent(...).catch(err => console.error(...))` 捕獲 async 例外，防止未處理的 Promise rejection 崩潰插件

## [4.1.0] — 2026-05-08

### 🛡️ 記憶卡健康合約強化

- **標題精確匹配驗證 (HEADING_TYPO)** — `memory_commit` 的 `## Tracked Files` 標題偵測從模糊字串比對（`includes`）升級為精確正則匹配（`/^## Tracked Files\s*$/m`），新增二階段診斷邏輯：標題錯字（如 `## Tracked FilesD`）將回報 `[HEADING_TYPO]` 告警代碼，並說明解析器將忽略此區塊導致所有追蹤檔案被誤判為未歸屬；完全缺失的情境維持原有 `body 缺少 ## Tracked Files 區段` 錯誤訊息
- **路徑基準驗證 (PATH_ABSOLUTE / PATH_TRAVERSAL)** — 新增 `validateTrackedFilePaths()` 私有函式，在 `memory_commit` 步驟 3 結構驗證後，自動掃描 `## Tracked Files` 中的所有路徑，偵測並回報絕對路徑（`[PATH_ABSOLUTE]`）與路徑穿越符號（`[PATH_TRAVERSAL] `）違規。兩類告警均整合至 `warnings` 欄位，不阻斷 commit 流程，確保 AI 可讀取告警後自行修正
- **操作規範文件化** — 更新 `memory-ops` 技能，新增 `§ 4.7 Heading Accuracy Contract`、`Path Baseline Rule (v4.1)`、`Auto-Cleanup Guarantee (v4.0)` 三條英文規範，明確化標題精確性合約與路徑基準義務

### 🧪 測試覆蓋擴展

- **MCP 工具介面測試案例由 35 升至 41** — 新增 6 個驗證場景：`[HEADING_TYPO]` 正反向、`[PATH_ABSOLUTE]`、`[PATH_TRAVERSAL]`、`[PATH_VALID]`、`[WARNING_STRIP]`；全套測試案例數從 **106** 升至 **112**

## [4.0.1] — 2026-05-06

### 🔧 修復

- **狀態列 Tooltip 幽靈感知缺口** — 修正狀態列懸浮健康報告不顯示幽靈檔案資訊的設計缺口。刪除已追蹤檔案後，健康報告 Tooltip 現在將顯示 `💀 幽靈檔案 (需清理)` 摘要區塊，列出受影響的記憶卡名稱與幽靈數量，與 TreeView 側邊欄的 💀 圖示達成顯示一致性

### 📝 文檔

- **v4.0.1 架構與記憶卡同步** — 全面更新 README.md（精確化測試案例數、補齊 VS Code 擴充指令、架構樹修正），並同步 6 張關鍵記憶卡（`_assets`、`_system`、`mcp-tools`、`index-manager` 等）以準確反映 v4.0.1 的 `memory_deps` 依賴引擎與幽靈感知的最終架構設計

## [4.0.0] — 2026-05-06


### 🎉 次世代依賴拓樸與幽靈感知 (v4.0)

- **幽靈檔案偵測引擎** — 系統自動追蹤並標記已被刪除但仍殘留在卡匣中的「幽靈檔案」(Ghost Files)。不僅在 VS Code 側邊欄以 💀 視覺化提示，`memory_status` MCP 工具亦會輸出清理指引，杜絕 AI 被舊紀錄干擾
- **自動化依賴推導引擎** — 導入 `import-resolver` 輕量掃描器，支援 ES、動態 `import()` 及 CJS 語法，全自動解析專案實體檔案間的引入關係，並結合卡匣配置推導出系統級的**模組依賴圖**
- **間接過期傳播 (Indirect Staleness)** — 基於 BFS 演算法建構深度傳播機制（預設向下滲透 2 層），當上游核心記憶過期時，下游依賴模組會自動收到衰減的間接過期指數，徹底解決「底層改動、高層忘記更新」的長期痛點
- **循環依賴偵測防禦** — 依賴圖建構過程中內建 DFS 循環偵測器，有效阻止套件耦合度過高所產生的無窮計算，並會在 MCP 工具端明確印出警告
- **全新拓樸查詢工具 (`memory_deps`)** — 釋出 `memory_deps` MCP 介面，供 AI 隨時查詢指定卡匣的「上游依賴」、「下游被依賴者」及整體傳播指標

### 🔧 改善

- **MCP 工具清單擴充** — `memory_list` 回傳結構補齊 `ghostFilesCount`、`dependencyCount` 與 `indirectStaleness`
- **MCP 後設資料同步增強** — `memory_commit` 在執行歸零操作的同時，會自動將目標卡匣的幽靈檔案陣列清空，免除手動清理負擔
- **依賴動態匯入** — 為防止頂層循環依賴發生，全面採用非同步 `import()` 載入 `config`、`index-manager` 與 `dependency-propagator`，保證載入時序安全
- **測試覆蓋率擴展** — 隨著兩大引擎上線，單元測試從 94 個案例躍升至 **106 個案例**（新增 12 個，分佈於 9 支測試檔）## [3.0.0] — 2026-05-04

### 🔥 破壞性變更

- **框架基礎注入機制移除** — 外掛安裝時不再自動注入 Antigravity 框架的基礎作業系統（Rules、Workflows、Skills 模板）。`CoreInjector` 類別、`src/templates/` 目錄、`.cartridge/injector.json` 狀態檔均已移除。Antigravity 框架的生命週期由獨立的安裝腳本（`install.ps1`）全權管理，與記憶卡管理工具解耦
- **`memory_update` MCP 工具移除** — MCP API 正式確立「只讀 + 元資料同步」設計哲學。`memory_update` 工具（含整張替換功能）已全面移除，唯一的記憶卡寫入路徑為 `write_to_file → memory_commit` 兩步驟流程。若需建立新記憶卡，請直接使用 `write_to_file` 建立 SKILL.md 後呼叫 `memory_commit` 同步索引

### 🧹 清理

- **`chokidar` 依賴移除** — 從 `tsup.config.ts` 的 `noExternal` 清單移除（v2.0 已全面改用 VS Code 原生 FileSystemWatcher，chokidar 早已無實質作用）
- **注入器測試移除** — 刪除 `src/tests/injector.test.ts`（11 個測試案例），MCP 工具測試刪除三個 `handleMemoryUpdate` describe 區塊（13 個測試案例）
- **全套測試精簡** — 從 128 個案例調整為 **94 個案例**（7 個測試檔案），聚焦核心記憶卡管理功能

### ✨ 設計哲學

外掛職責自 v3.0.0 起明確定義為：**記憶卡匣的生命週期追蹤（檔案監聽、過期分析、UI 呈現）以及 AI 代理的 MCP 查詢介面**。框架安裝與記憶卡內容寫入均不在外掛管轄範圍內。

## [2.0.1] — 2026-04-12


### 🔧 修復

- **啟動偵測警報未寫入** — 修復 `detectMissedChanges` 偵測到過期記憶卡時，只更新記憶體分數而未將紅色警報區塊寫入 `SKILL.md` 的問題。現在啟動時若發現嚴重過期的卡匣，會自動寫入警報標記 (#3)
- **MCP 核銷警報殘留** — 修復 AI 透過 MCP `memory_commit` 或 `memory_update` 更新記憶卡並將 `staleness` 歸零後，原本檔案頂端的 Markdown 警報區塊未被移除導致「假警報」的問題 (#4)
- **幽靈池無歸屬推薦** — 修復背景幽靈掃描將未追蹤檔案加入 `untrackedFiles` 時未呼叫推薦引擎，導致 TreeView 幽靈池建議永遠為空的問題。現在能在 TreeView 直接看到最長路徑匹配的推薦歸屬卡匣 (#5)

## [2.0.0] — 2026-04-12

### 🎉 次世代企業級架構 (v2.0)

- **原生 FileSystemWatcher** — 完全棄用 `chokidar`，改用 VS Code 原生 API，大幅提升穩定性並減少第三方依賴。配合自製 `debounceMap` (300ms) 消除檔案快速存取時的 UI 抖動
- **Cache-First 寫入機制** — 徹底解耦磁碟 I/O 寫入。記憶卡與幽靈池的變動改以 RAM Dirty 標記處理，磁碟落地被延遲至安全時機（deactivate、5 分鐘安全心跳或手動掃描），徹底消除檔案存取時的 IO 阻塞
- **背景化幽靈掃描** — 外掛啟動流程中的全專案幽靈檔案掃描改為啟動後 3 秒背景非同步執行，不再阻塞 VS Code 核心啟動序列
- **TreeView 側邊欄** — 新增整合式側邊欄面板 (`cartridgeExplorer`)，以樹狀結構視覺化展示所有記憶卡的健康指標與幽靈池狀態
- **CodeLens 行內歸屬標記** — 打開任何受追蹤的檔案，編輯器頂部會自動顯示所屬任務卡與過期指數；針對幽靈檔案亦會明確標記「👻 未歸屬」按鈕
- **智慧歸屬推薦引擎 (Smart Owner)** — 幽靈檔案會透過最長目錄前綴匹配演算法 (Longest-Common-Prefix)，自動推薦可能適合納入的現有記憶卡匣
- **一鍵歸屬指令與右鍵選單** — 新增 `cartridge.attributeFile` 指令。可在目前開啟的檔案呼叫該指令，或點擊 CodeLens 提示，透過 QuickPick 介面一鍵將幽靈標記並分配至目標卡匣

## [1.0.1] — 2026-04-09

### 🔧 修復

- **打包與模組載入** — 修復 `dist/extension.js` 在啟動時無法找到 `ignore` 模組導致崩潰的問題，更新 `tsup.config.ts` 將 `ignore` 納入 `noExternal` 進行內嵌打包
- **幽靈清單雙向更新** — 完善 `watcher` 的 `.gitignore` 變更與刪除監聽邏輯。當偵測到 `.gitignore` 變化時觸發 `reload()` 和 `refilterUntrackedFiles()`，在刪除檔案時清除未追蹤索引，實現全專案非監管狀態的即時對齊
- **掃描命令修補** — 修正 `cartridge.scan` 行為，在發動掃描時完整呼叫 `detectMissedChanges` 與幽靈池過濾

### ✨ 增強

- **全域監控廢棄 scopePath** — 徹底清理 `findOwner()` 與 `scopePath` 等目錄屬性偵測廢話邏輯。未歸屬檔案全部歸納進入獨立幽靈池，不再嘗試隨意分發歸屬
- **幽靈獨立掃描** — 新增了 `cartridge.scanGhosts` 指令，獨立清空並重新對全專案發動未歸雷射掃描
- **知識歸位** — 更新 8 張系統與外掛記憶卡，將所有架構清理、指令變動與 `.gitignore` 機制重做後的經驗正式存入決策檔紀錄

## [1.0.0] — 2026-04-09

### 🎉 正式發布 (v1.0 全域感知升級)

- **全域監聽雷達** — 廢棄局部監控，全面改用專案目錄層級的全域監控。新增的檔案即使未註冊在任何記憶卡中，系統也能馬上感知
- **Gitignore 原生引擎** — 引入 Gitignore 排除過濾引擎，全專案監聽時自動避開 `node_modules` 與開發者忽略的目錄，達成全域視野與極致效能的平衡
- **未歸屬檔案池 (Untracked Files)** — 只要有新檔案誕生且不屬於任何記憶卡，將自動納入 `untrackedFiles` 狀態池
- **UI 👻 幽靈計數** — VS Code 狀態列新增即時提示 `👻 N 未歸屬`，滑鼠懸浮 (Tooltip) 會智慧建議檔案應該分發給哪張記憶卡
- **離線刪除修復** — 修復 `detectMissedChanges` 攔截異常導致的離線刪除漏抓問題，確保關閉 IDE 期間刪除檔案能正確觸發 `unlink` 事件
- **巢狀 ID 防撞** — 記憶卡識別碼自單純目錄名全面升級為點分隔路徑（`api.auth`），杜絕巢狀目錄的同名碰撞
- **AI 語意支援** — 索引新增 `description`，`memory_list` 介面回傳未歸屬清單與描述，大幅增強 AI 理解力
- **強制合約檢驗** — `memory_commit` MCP 工具新增強制 `metadata` 驗證，禁止寫入缺少 `author`、`version` 等核心合約的記憶卡

## [0.9.0] — 2026-04-02

### 🔥 破壞性變更

- **棄用模式正式移除** — `memory_update` 工具完全移除 `patch` 與 `append` 模式的程式碼，僅保留整張替換功能。`mode` 和 `dryRun` 參數已被移除，工具介面精簡為 `moduleName`、`content`、`parentModule`、`projectRoot`
- **索引檔路徑遷移** — 索引檔從 `cartridge_index.json`（專案根目錄）遷移至 `.cartridge/index.json`，舊路徑不再被讀取

### ✨ 新增

- **運行時狀態目錄** — 新增 `.cartridge/` 專用目錄統一存放系統運行時產生的狀態檔案（索引 + 注入器狀態），取代散落在根目錄的做法
- **工作區系統產物隱藏** — 外掛啟動時會自動讀取 VS Code 工作區設定，將 `.cartridge/` 寫入 `files.exclude` 與 `search.exclude`，免除手動設定，保持檔案總管與全域搜尋乾淨
- **注入器三方比對機制** — 基底卡匣注入器從簡單二態雜湊比對升級為四象限覆蓋決策，透過 `.cartridge/injector.json` 記錄上次部署的範本雜湊作為基準，精準區分「範本更新」與「使用者修改」，不再無條件覆蓋使用者的客製化內容
- **衝突策略設定** — 注入器支援三種衝突處理策略：`ask`（預設，詢問操作者）、`alwaysUpdate`（強制用範本覆蓋）、`alwaysKeepMine`（保留使用者修改）

### 🧹 清理

- **商業邏輯精簡** — 移除近 390 行 Markdown 區段解析與合併程式碼（`parseSections`、`mergeSections`、`parseSubSections` 等 6 個函式及 5 個型別定義），降低維護成本
- **測試精簡與擴展** — 移除 34 個與棄用模式相關的測試，新增 6 個注入器三方比對測試，全套測試從 154 個調整為 **120 個**（8 個測試檔案）
- **設定模組擴展** — `CartridgeConfig` 新增 `cartridgeDir` 欄位，新增 `getCartridgeDirAbsPath()` 輔助函式

## [0.8.1] — 2026-04-02

### 🔧 修復

- **內建範本同步** — 修正外掛內建的記憶操作指引範本未同步至 v0.8.0 的新版內容，導致外掛啟動時注入器將磁碟上的新版指引覆蓋回舊版的問題

### 📝 文件

- **記憶操作指引命令化** — 全文語氣從「教學式」改為「命令式」：新增歸卡義務硬性約束、新建檔案歸屬義務流程（§ 4.5）、過期修復流程同步新版工具、拆分流程補齊子卡歸卡步驟
- **完成閘門強化** — 新增歸卡驗證與新建檔案歸屬兩道檢查，確保 AI 無法跳過記憶同步

## [0.8.0] — 2026-04-02

### ✨ 新增

- **記憶卡後設資料同步工具** — 新增 `memory_commit` MCP 工具，專責處理記憶卡的後設資料同步（時間戳注入、過期歸零、索引同步、結構驗證）。AI 使用原生工具寫入記憶卡內容後呼叫此工具即可完成同步，從根本上消除 Markdown 合併邏輯導致的高出錯率
- **追蹤檔案自動重新解析** — `memory_commit` 會根據 SKILL.md 中的 `## Tracked Files` 區段重新解析追蹤檔案清單並同步更新索引，確保索引永遠反映記憶卡的最新狀態
- **檔案反向映射重建** — `memory_commit` 在同步索引時自動重建 `fileMap` 反向映射，清除舊映射並根據新解析的追蹤檔案建立新映射
- **結構驗證報告** — `memory_commit` 會檢查 frontmatter 是否包含必要欄位（`name`、`description`）以及 body 是否包含 `## Tracked Files` 區段，有缺失時在回傳的 JSON 報告中附帶 `warnings`
- 全套測試由 146 個案例升至 **154 個案例**（新增 8 個）

### ⚠️ 棄用

- **記憶卡區段級替換模式** — `memory_update` 的 `patch` 模式標記為已棄用，因 Markdown 區段匹配的格式敏感度與 AI 生成的不確定性之間存在根本矛盾，導致出錯率過高
- **記憶卡附加模式** — `memory_update` 的 `append` 模式標記為已棄用，因無結構性檢查容易產生重複區段
- **記憶操作指引更新** — 首選流程從 `memory_update` 改為 `write_to_file → memory_commit` 兩步驟

### 🔧 改善

- **Antigravity 框架 v5.3 同步** — 同步升級核心規則、操作技能與工作流程至最新框架版本

## [0.7.0] — 2026-03-31

### 🔧 修復

- **區段標題黏連修復** — 修正記憶卡 patch 模式更新時，若原始檔案中區段標題（`## ` / `### `）因缺少換行符而黏在前一行末尾，導致解析器無法識別、合併時新增重複區段而非就地替換的嚴重缺陷

### ✨ 新增

- **行內標題自動修復引擎** — 新增 `normalizeInlineHeadings()` 函式，在區段解析前自動偵測並修復行內黏連的 `##` / `###` 標題。具備程式碼區塊感知（追蹤 ``` 狀態），不影響程式碼區塊內容
- **修復紀錄回報** — `PatchReport` 新增 `autoFixes` 欄位，當偵測到格式問題並自動修正時，在 patch 報告中明確告知 AI 哪些異常已被修復
- 全套測試由 140 個案例升至 **146 個案例**（新增 6 個）

## [0.6.5] — 2026-03-31

### 🧹 清理

- **棄用日誌系統移除** — 移除注入器啟動時自動建立 `.agents/logs` 目錄的邏輯，刪除隨外掛打包的日誌範本檔案（`audit_trail.jsonL` 和 `episodic_log.md`）。日誌系統已由框架 v4.1 棄用
- **記憶操作技能 v4 同步** — 插件內建的記憶操作技能範本從 v3（`mem-` 前綴 + `.agents/skills/` 路徑）全面更新至 v4 架構（無前綴 + `.agents/memory/` 路徑），移除已棄用的跨模組教訓日誌引用

### 📝 文件

- **技術架構圖修正** — README 架構目錄樹移除子卡 `mem-` 前綴殘留，刪除已棄用的 `logs/` 目錄

### 🔧 修復

- **注入器測試型別修正** — 補齊測試設定中缺少的 `memoryDir` 屬性，消除 TypeScript 編譯錯誤

## [0.6.0] — 2026-03-31

### ✨ 新增

- **獨立記憶卡目錄** — 記憶卡從 `.agents/skills/mem-*` 遷移至獨立的 `.agents/memory/` 目錄，與操作技能完全分離。記憶卡名稱不再需要 `mem-` 前綴（例如 `_system`、`extension`），AI 呼叫 MCP 工具時可直接使用原始名稱
- **雙路徑掃描引擎** — 索引管理器同時掃描 `memory/`（新路徑）和 `skills/mem-*`（舊路徑），實現零停機漸進遷移。尚未遷移的專案仍可正常運作
- **五層路徑解析策略** — MCP 路徑解析器從三層升級為五層：索引查找 → memory/ 平面回退 → skills/ 平面回退 → memory/ 遞迴搜尋 → skills/ 遞迴搜尋

### 🔧 改善

- **設定模組擴展** — 新增 `memoryDir` 設定欄位（預設 `.agents/memory`）與 `getMemoryAbsPath()` 輔助函式，與既有的 `skillsDir` / `getSkillsAbsPath()` 平行運作
- **監聽引擎相容** — 記憶卡自身變動偵測同時覆蓋 `.agents/memory/` 和 `.agents/skills/mem-` 兩種路徑
- **注入器安全防護** — 基底卡匣注入器的覆寫保護擴展至 `memory/` 目錄

### ⚠️ 破壞性變更

- **記憶卡路徑變更** — 記憶卡的預設存放位置從 `.agents/skills/mem-*/SKILL.md` 改為 `.agents/memory/*/SKILL.md`。已部署的舊版外掛需重新安裝更新版才能識別新路徑下的記憶卡

## [0.5.4] — 2026-03-30

### 🧪 測試覆蓋

- **離線變動偵測功能** — 新增 10 個單元測試，覆蓋啟動時檔案校驗的全部邏輯分支：檔案時間比較、目錄型路徑跳過、去重機制、過期指數計算、異常處理
- **規則注入器核心模組** — 新增 9 個單元測試，覆蓋偵測與注入流程全部狀態：缺失注入、雜湊比對、過時覆寫、記憶卡安全護欄、目錄自動建立、報告格式化
- 全套測試由 121 個案例升至 **140 個案例**

### 🏠 維護

- **授權檔案** — 新增 MIT LICENSE，消除 `vsce package` 打包時的授權缺失警告
- **記憶卡追蹤範圍調整** — 將 `package.json` 從 MCP 工具記憶卡移至系統記憶卡追蹤，使 MCP 模組追蹤數從 8 降至 7（回到健康閾值內）

### 🔧 修復

- **規則注入器建置修復** — 修正建置工具未複製內建範本目錄的問題。注入器每次啟動時會比對外掛內建範本與專案中的實際規則檔案，過時則自動覆蓋，但因 tsup 不會打包非程式碼的靜態資源，導致此功能自首版起完全失效。現已在建置設定中加入自動複製步驟

## [0.5.3] — 2026-03-30

### 🔧 修復

- **啟動時檔案校驗** — 外掛啟動後自動比對每個追蹤檔案的修改時間（mtime）與記憶卡的 `lastUpdated`，若檔案比記憶卡更新則補記異動並計算過期指數。修復外掛重啟期間的檔案變動無法被偵測的問題

## [0.5.2] — 2026-03-30

### 🔧 修復

- **狀態列等級邏輯重構** — 從「各等級卡匣數量」改為「全卡匣過期總分制」，五層顏色即時反映系統整體健康度：🟢全部同步(0) / 🔵有變動(10+) / 🟡需注意(30+) / 🟠顯著過期(60+) / 🔴嚴重過期(100+)
- **過期報告格式重構** — 從 `showWarningMessage` 單行彈窗改為 `OutputChannel` 多行面板，每張卡匣一行、按嚴重度排序、附等級圖示與異動數量
- **MCP 工具清單巢狀子卡遺漏** — `memory_list` 改為優先從索引檔讀取全部卡匣，確保巢狀子卡（depth≥2）也被包含在回傳結果中

## [0.5.1] — 2026-03-30

### 🏗️ 記憶架構重組

- **樹狀結構實踐** — 將四個運行時模組記憶卡（注入器、監聽引擎、過期分析器、寫入器）搬入外掛入口記憶卡之下，形成父子層級，實踐 v0.5.0 的「目錄結構即層級」設計理念
- **外掛入口升級為父卡** — 新增目錄範圍宣告，關聯描述包含子模組清單
- **新增共用型別記憶卡** — 補齊設定工廠函式和共用型別定義的記憶覆蓋缺口，原始碼覆蓋率由 85% 提升至 100%

### 🔧 修復

- **MCP 工具介面記憶結構修復** — 合併重複的決策紀錄區段（D01~D21 整合為單一區段）、修正追蹤路徑與區段標題黏連的格式錯誤

## [0.5.0] — 2026-03-29

### ✨ 新增

- **巢狀目錄記憶卡系統** — 記憶卡支援最大 4 層深度的樹狀目錄結構，「目錄結構即層級」。系統自動從目錄位置推導每張卡的深度和父卡，取代 frontmatter 手動宣告
- **遞迴掃描引擎** — 索引管理器升級為遞迴掃描，自動發現巢狀子目錄中的記憶卡並建立完整索引
- **三層路徑解析策略** — 新增 `resolveSkillPath` 共用函式，依序嘗試索引查找、平面路徑回退、遞迴搜尋，確保任何專案結構都能正確定位記憶卡
- **巢狀建立支援** — `memory_update` 新增 `parentModule` 可選參數，AI 可直接透過 MCP 工具建立巢狀子卡，無需手動操作檔案系統
- **層級判斷決策樹** — 操作指引新增建立新記憶卡時的層級判斷邏輯，教 AI 判斷新卡該放根層還是父卡目錄下

### 🔧 改善

- **記憶卡清單深度欄位** — `memory_list` 回傳新增 `depth` 欄位，AI 可直接了解每張卡的樹狀位置
- **監聽引擎巢狀相容** — 監聽器正確識別巢狀路徑下的記憶卡變更
- 全套測試由 110 個案例升至 **121 個案例**（新增 11 個）

### 📝 文件

- **操作指引補強** — § 5 新增層級判斷決策樹、§ 5.5 新增目錄結構範例與子卡載入流程
- **工作流程更新** — 架構設計新增巢狀分析步驟、專案健檢新增巢狀歸屬判斷
- **記憶卡範本修正** — 移除已棄用的 `parent` frontmatter 欄位

## [0.4.0] — 2026-03-29

### ✨ 新增

- **記憶卡過期狀態診斷工具** — 新增 `memory_status` MCP 工具，回傳指定記憶卡的完整過期診斷資訊：過期指數、等級、異動檔案清單（含絕對路徑）及具體修復行動指引。索引檔不存在時自動回退至讀取記憶卡 frontmatter
- **記憶卡清單過期狀態增強** — `memory_list` 回傳格式從純文字升級為結構化 JSON 陣列，每張卡含過期指數、等級與待處理異動數量。AI 可在列表階段直接篩選需要注意的記憶卡
- **記憶操作指引：過期修復決策樹** — 新增「§3 過期修復」專屬 SOP（5 步驟），明確引導 AI 在修復過期記憶前先讀取原始碼再更新記憶，防止空洞歸零

### 🔧 改善

- **記憶更新後自動清除異動紀錄** — `memory_update` 成功寫入後，自動清除索引檔中對應模組的待處理異動清單與過期指數。索引不存在時靜默忽略，不影響更新結果
- 全套測試由 97 個案例升至 **110 個案例**（新增 13 個）

## [0.3.1] — 2026-03-29

### 🛡️ 安全強化

- **記憶更新工具閘門機制** — patch 模式新增三層防護閘門，防止 AI 自動化場景中的靜默資料遺失：
  - **操作前預覽** — `dryRun: true` 參數可在不寫入磁碟的情況下取得完整變更預覽報告
  - **結構化回傳** — 回傳 JSON 格式報告，包含替換/新增/保留/移除的區段名稱清單與行數差異
  - **大幅刪減保護** — 行數減少超過 30% 時自動附帶警告訊息

### 🔧 修復

- **子區段靜默刪除** — 修正 patch 模式在更新含有 `###` 子區段的 `##` 區段時，會靜默刪除未提及的子區段的嚴重缺陷。現在採用最小匹配原則：只替換提及的 `###` 子區段，自動保留未提及的
- **回傳訊息不足** — patch 模式回傳從簡略計數升級為結構化 JSON，包含具體被影響的區段名稱
- **工具描述範例值** — `projectRoot` 參數移除硬編碼的專案名稱範例

### ✨ 新增

- **子區段解析引擎 (`parseSubSections`)** — 支援 `###` 粒度的段落解析，含程式碼區塊守衛
- **兩層合併策略** — `mergeSections` 升級為支援 `##` + `###` 兩層級合併，子區段內合併保留未提及的子區段
- 全套測試由 87 個案例升至 **97 個案例**（新增 10 個）

### 🏠 維護

- **記憶操作指引更新** — 決策樹加入子區段支援與 dryRun 預覽說明，模式描述更新為兩層合併

## [0.3.0] — 2026-03-28

### ✨ 新增

- **記憶更新工具第三模式（區段級替換）** — `memory_update` 新增 `patch` 模式，以 `##` 段落為單位精確替換記憶技能的特定區段。AI 只需傳入要更新的目標區段，無需重傳整份檔案，大幅降低 token 開銷並消除誤刪風險
- **段落分割引擎 (`parseSections`)** — 支援 CRLF 正規化、程式碼區塊守衛（忽略 ```內的`##`）、`###` 子標題不切分
- **段落合併引擎 (`mergeSections`)** — 標題正規化比對（壓空格 + 小寫化），同名區段就地替換、新區段附加到末尾、未提及區段保持不動
- **操作統計回傳** — patch 模式回傳 `N replaced, M added` 統計，讓 AI 清楚知道發生了什麼
- **記憶操作指引更新** — 決策樹從雙模式升級為三模式，新增 patch 路徑說明
- 全套測試由 70 個案例升至 **87 個案例**（新增 17 個）

### 🔧 改善

- **Antigravity 框架更新** — 同步升級 6 個框架組件（工作流程 + 技能）

### 🏠 維護

- **範本同步** — 記憶操作指引範本同步更新 patch 模式說明

## [0.2.5] — 2026-03-28

### 🔧 修復

- **跨平台路徑掃描修復** — 修正記憶卡追蹤路徑解析器無法處理 Windows 行尾格式（CRLF）的問題，解決其他專案的記憶卡追蹤路徑全部顯示為空白的嚴重缺陷
- **假路徑過濾** — 修正追蹤清單中的分組標題（如 `### Config`）、HTML 標記被誤判為檔案路徑並汙染監聽索引的問題

### ✨ 新增

- **記憶更新工具雙模式** — `memory_update` 新增 `mode` 參數，支援「取代」（整張換掉）與「附加」（在後面加東西）兩種模式，AI 可明確選擇寫入策略，避免重複內容堆疊
- **監聽器動態更新** — 記憶卡新增追蹤路徑後，監聽器會即時開始監視，不再需要重啟 VS Code
- **路徑掃描測試**（3 個案例）：CRLF 行尾、分組標題過濾、HTML 標記過濾
- 全套測試由 67 個案例升至 **70 個案例**

### 🏠 維護

- **快取檔案排除** — `cartridge_index.json` 加入 `.gitignore`，執行時動態產生的快取檔不再進入版控

## [0.2.0] — 2026-03-28

### 🛡️ 安全強化

- **路徑穿越防禦** — 新增路徑安全驗證模組，所有 MCP 工具的 `projectRoot` 參數現在會經過雙層防禦（格式守衛 + 語意守衛），拒絕相對路徑與路徑穿越攻擊

### 🔧 改善

- **時間戳準確性** — 全系統時間戳生成統一改為瀏覽器原生 Intl API，取代手動時區偏移計算，確保台灣時區的正確性
- **記憶卡更新穩健性** — 記憶卡的 frontmatter 更新從正則替換改為結構化解析，完整支援單引號、雙引號、無引號格式，消除格式不一致導致更新失效的風險

### ✨ 新增

- **路徑安全測試**（8 個案例）：涵蓋 Windows/Unix 絕對路徑、相對路徑拒絕、穿越攻擊拒絕
- **時間戳格式測試**（3 個案例）：驗證 ISO 8601 格式與台灣時區後綴
- **frontmatter 相容性測試**（4 個案例）：覆蓋單引號、雙引號、無引號的邊界情境
- **MCP 工具路徑安全測試**（5 個案例）：三個工具的路徑穿越與時間戳驗證
- 全套測試由 44 個案例升至 **64 個案例**

### ⚠️ 破壞性變更

- **路徑驗證加嚴** — `projectRoot` 現在必須為絕對路徑且不得包含 `..` 穿越符號，傳入不合規路徑會收到驗證錯誤（之前只檢查非空）

## [0.1.4] — 2026-03-28

### ✨ 新增

- **跨專案目錄支援** — 三個 MCP 工具（列出清單、讀取、更新）新增**必填** `projectRoot` 參數，呼叫方必須明確指定目標專案根目錄。解決多專案共用 Gateway 時固定讀取單一專案記憶的設計瑕疵

### 🔧 修復

- **快取同步失效修復** — 修正監聽引擎的記憶卡變更偵測邏輯，MCP 寫入乾淨的記憶技能檔案（不含舊警告區塊）時也能正確觸發外掛記憶體快取同步，避免外掛報告過時的過期指數

### ⚠️ 破壞性變更

- **`projectRoot` 改為必填** — 所有記憶 MCP 工具呼叫必須傳入 `projectRoot` 路徑，未傳入將回傳驗證錯誤。廢棄啟動時固定路徑的 fallback 設計

## [0.1.3] — 2026-03-28

### ✨ 新增

- **自動化測試套件擴展** — 完整覆蓋剩餘兩個核心業務模組，全套測試由 18 個案例升至 **38 個案例**：
  - **過期分析器測試**（11 個案例）：覆蓋過期等級四分支（`getStalenessLevel`）、三種事件計分邏輯（change/unlink/add）及整合流程（無影響卡匣提前返回 / 分數未達閾值不植入警報 / 達閾值觸發警報植入）
  - **警報寫入器測試**（9 個案例）：覆蓋 `injectWarning`（idempotent 重複植入保護）、`removeWarning`（staleness=0 自動恢復 stable 狀態）、`checkAndCleanWarning`（條件式清除三個邊界判斷）；使用 `vi.mock('node:fs')` 隔離同步磁碟操作，`gray-matter` 真實執行

## [0.1.2] — 2026-03-28

### ✨ 新增

- **自動化測試套件** — 新增 vitest 測試基礎建設，完整覆蓋核心商業邏輯：
  - **索引管理器測試**（9 個案例）：涵蓋路徑淨化三步驟（去反引號、截斷說明文字、空行過濾）的全邊界情境，以及待處理異動去重機制與清空邏輯
  - **MCP 工具介面測試**（9 個案例）：全面驗證 `memory_list`、`memory_read`、`memory_update` 三個工具的正常流程、錯誤邊界（目錄不存在、文件不存在、寫入失敗），以及參數驗證失敗的處理邏輯；全部使用 mock 隔離磁碟操作

### 🔧 重構

- **MCP 工具商業邏輯解耦** — 新增獨立的 `mcp-handlers.ts` 模組，將三個 MCP 工具的核心邏輯從 SDK 框架解耦為純函式，大幅提升可測試性與程式碼可讀性；`mcp-server.ts` 保留 SDK 連接與路由職責，外部行為完全不變
- **索引路徑淨化函式匯出** — `parseTrackedFiles` 改為公開匯出，使測試可精準驗證路徑解析邏輯而無需透過完整掃描流程

## [0.1.1] — 2026-03-28

### 🔧 修復

- **MCP 工具工作區定位錯誤** — MCP 伺服器改用 `--workspace` 命令列參數取代 `process.cwd()`，確保 Gateway 啟動時能正確指向目標工作區而非閘道器自身目錄
- **記憶卡追蹤路徑解析錯誤** — 索引管理器解析追蹤清單時，新增自動去除 Markdown 反引號與說明文字的機制，確保監聽器能正確比對實際檔案路徑（修復記憶卡永遠不過期的根因）
- **錯誤捕獲型別安全** — MCP 工具的三處錯誤捕獲由 `any` 改為 `unknown` 搭配型別守衛，消除 ESLint 警告

### ✨ 新增

- **ESLint 靜態分析** — 新增 ESLint v9 Flat Config 設定（`eslint.config.js`），支援 TypeScript 型別感知規則，使 `npm run lint` 可產出完整掃描報告
- **記憶卡匣健檢補齊** — 新增 `mem-writer`（記憶卡寫入器）與 `mem-extension`（外掛入口與狀態列）兩個記憶技能，補齊先前缺失的模組覆蓋

## [0.1.0] — 2026-03-28

### 🎉 首次發布

- **記憶卡匣監控外掛** — 將 CLI 工具轉型為 VS Code 延伸模組，實現背景自動監控
- **MCP 工具介面** — 提供 `memory_list`、`memory_read`、`memory_update` 三個標準化 AI 工具
- **即時過期偵測** — 自動追蹤檔案變更並計算記憶卡過期指數
- **警報自動植入與清除** — 當記憶卡過期時自動植入攔截警報，AI 更新後自動清除
- **狀態列燈號** — 即時顯示記憶卡健康狀態（🟢 健康 / 🟠 顯著過期 / 🔴 嚴重過期）

### 🔧 修復

- **依賴打包修正** — 修復 chokidar 與 gray-matter 未被打包進安裝檔導致外掛靜默崩潰的問題
- **指令註冊順序** — 將指令註冊移至啟動函數最前面，確保即使初始化失敗指令仍可用
- **Antigravity IDE 相容** — 改用正確的 CLI 工具安裝外掛，新增 onStartupFinished 啟動事件
- **自我監聽迴圈防護** — 新增系統產物豁免清單，防止外掛監聽自己產出的索引檔案
