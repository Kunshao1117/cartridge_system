# _system Legacy Archive Volume 002

Migrated: 2026-06-04T07:15:00+08:00
Archive policy: schema v2 lazy upgrade preserved the original legacy SKILL.md content verbatim for trace-back.

## Original Legacy Content


- 無

## Module Lessons

- L01: \_system 紀錄專案的基礎依賴變更與發布紀錄。
- L02: v0.7.0 (2026-03-31) — 發布區段標題黏連修復與行內自動修復引擎。
- L03: v0.8.1 (2026-04-02) — MCP Server 新增 memory_commit 兩步驟操作流機制，同步升級版本號。
- L04: v0.9.0 (2026-04-02) — 三合一架構重構：移除 patch/append 棄用模式、索引檔搬遷至 `.cartridge/`、注入器三方比對覆蓋機制。
- L05: 最新的系統已全面進入雙子星架構，確保前端 IDE UI 與後端 MCP 邏輯絕對隔離。全專案具備離線與未歸屬邊緣檔案偵測能力。
- L06: v2.0.0 (2026-04-12) — 次世代架構升級：棄用 chokidar 改用 VS Code 原生 FileSystemWatcher + debounceMap；Cache-First I/O 機制（isDirty + flushIfDirty + 5 分鐘安全心跳）；背景化幽靈掃描；新增 TreeView 側邊欄 + CodeLens 行內標記 + 智慧歸屬推薦引擎。
- L07: v3.0.0 (2026-05-04) — 職責純化：移除框架基礎注入機制，外掛聚焦記憶卡匣管理核心功能。
- L08: v4.0.0 (2026-05-06) — 次世代依賴引擎上線：自動化依賴推導 + 間接過期傳播 + 幽靈檔案偵測。單元測試從 94 躍升至 106 個案例。
- L09: v4.0.1 (2026-05-06) — 修復狀態列 Tooltip 幽靈資訊顯示缺口。
- L10: v4.1.0 (2026-05-08) — 健康合約升級：memory_commit 新增標題精確匹配驗證（HEADING_TYPO）與路徑基準驗證（PATH_ABSOLUTE / PATH_TRAVERSAL），測試 106→112。
- L11: v4.1.1 (2026-05-14) — package.json 已確認維持 extension metadata、MCP server 入口、commands 與依賴設定；系統記憶同步至目前版本狀態。
- L12: (2026-05-14) GitNexus CLI 環境修復 — npm Roaming 全域 shim 曾指向殘缺的 `node_modules/gitnexus/dist/cli/index.js`，導致 `npx gitnexus` 失敗；已將 npm shim 改為優先委派 pnpm 全域 GitNexus，缺失時 fallback 到 `pnpm dlx --allow-build=... gitnexus`。
- L13: v5.0.0 (2026-05-17) — package.json 與 MCP server metadata 同步升級至 5.0.0；本版主軸為只讀上下文治理 OS，不新增生產依賴。
- L14: v5.0.0 (2026-05-17) — package.json contributes 新增 `viewsContainers.activitybar` 的 `cartridgeGovernance`，並新增三個治理 commands；`cartridgeExplorer` 不再掛在 Explorer。
- L15: v5.1.0 (2026-05-17) — package.json 與 MCP server metadata 同步升級至 5.1.0；本版主軸為 AI 開工清單、規則檔檢查白話化、側邊欄提醒可讀性與 MCP 工具安全說明。
- L16: (2026-05-18) — `.github/workflows/release.yml` 新增 VSIX 自動發版；正式發布以 `package.json` 版本與 `v*` tag 一致為門檻，Release notes 優先取 `CHANGELOG.md` 對應版本段落。
- L17: (2026-05-18) — 本機若 `ComSpec` 為空，npm 10 在 Windows 上執行 `npm run *` 會於 `@npmcli/promise-spawn` 拋 `ERR_INVALID_ARG_TYPE`；User 層 `ComSpec=C:\Windows\System32\cmd.exe` 是跨 repo 的持久修復。
- L18: (2026-05-18) — 安全修補不一定需要調整 `package.json` direct ranges；先用 lockfile 相容更新清除 npm audit，再評估是否另做 major upgrade。
- L19: (2026-05-18) — 同 repo 兼任 VS Code extension 與 npm MCP runtime 時，npm `files` 白名單要保留 `assets/**`，因 package manifest 仍引用 extension icon / Activity Bar 圖示。
- L20: (2026-05-18) — `npm publish --dry-run` 會正規化 package manifest；本 repo 以 `git+https://...` repository URL 與不含 `./` 的 bin path 作為發布前測試契約。
- L21: (2026-05-19) — Webview 前端不能依賴 VSIX 內的 `node_modules`；視覺化依賴要透過 tsup 打進 `dist/*.js`，才能符合 `package.json.files` 白名單。
- L22: (2026-05-19) — VSCE 3.x 偵測到 `.vscodeignore` 與 `package.json.files` 同時存在會直接中止；本 repo 改由 `package.json.files` 作為單一白名單來源。
- L23: (2026-05-19) — 版本號升級需同步 package-lock 根層版本、README 安裝命令、CHANGELOG 版本段落與本機 VSIX 檔名。
- L24: (2026-05-19) — v5.3.2 打包前需確認 `cabinet-graph-viewport.ts` 已歸卡，否則 `commit_preflight` 會以未歸屬 source file 阻塞提交。
- L25: (2026-05-19) — VSIX/package 修補版可升 package 版本但不必同步改 `MCP_SERVER_VERSION`，除非本次發行目標包含 npm runtime 版本宣告。
- L26: (2026-05-29) — 發布到 npm 時，`package.json` 版本、`package-lock.json` 根層版本、README 安裝範例、工具名冊版本測試與 MCP server `--version` 輸出必須同步，避免 npm 使用者看到舊 runtime 版本。
- L27: (2026-05-29) — npm Trusted Publishing 的 owner、repository、workflow filename 與 environment name 皆需和 npm package access 設定完全一致；本 repo 採 `Kunshao1117/cartridge_system`、`npm-publish.yml`、environment `npm publish`。
- L28: (2026-05-29) — npm registry 的同名同版本不可覆蓋；若要補推已手動發布過的 tag，npm workflow 必須先偵測既有版本並成功跳過 publish，否則 Actions 會在 npm 發布步驟失敗。
- L29: (2026-05-29) — MCP runtime 與 VSIX 插件是不同發布面；未來 npm 發布使用 `npm-vX.Y.Z`，插件發布使用 `vX.Y.Z`，避免測 npm Trusted Publishing 時重建 VSIX release。
- L30: (2026-06-02) — 直接狀態與衍生傳播提醒必須分層治理；若只改警示語義，不能碰底層依賴圖建構與 BFS 傳播，降低啟動、監聽與記憶查詢風險。
- L31: (2026-06-02) — 當直接依賴存在安全修復 major（例如 `vitest` 4.x）時，先只升必要 direct package，再用 `npm update` 抬升相容的傳遞套件；若 audit 歸零且 package/VSCE/MCP direct range 未改，即不需要同步版本號或發布文件。
- L32: (2026-06-03) — Desktop Console 第一版發布不升 package 版本，沿用 5.4.1 核心版本但以 `desktop-v5.4.1` 獨立 release；桌面 tag 不應觸發 VSIX 或 npm workflow。
- L33: (2026-06-04) — schema v2 壓縮治理與桌面操作/滾輪維修一起收斂為 5.4.2；因 npm runtime 也要發布，`package.json`、lockfile、README、MCP server `--version` 與版本測試必須同步。
- L33: (2026-06-03) — electron-builder 在 CI/release 環境可能自動嘗試 publish；若 release workflow 已用 GitHub CLI 控制 Release，打包步驟要加 `--publish never`，否則會在未配置 `GH_TOKEN` 的 build step 失敗。

## Applicable Skills

- tech-stack-protocol
