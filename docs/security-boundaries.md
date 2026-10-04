# 第一批安全邊界與驗證範圍

本批只處理 frontmatter 求值與專案檔案邊界，不調整 stale、人工 dependency 傳播、主檔遷移或發布版本。

- 全部 production gray-matter 呼叫集中至 safe-frontmatter：只接受 YAML/YML/JSON 資料型 frontmatter，保留 safe YAML 日期、未知欄位及 BOM/CRLF 更新相容；不開放自訂 engine。stringify 直接使用資料型 YAML serializer，避免再次解析內文的第二個 frontmatter，並保留 __proto__ 等未知資料欄位。
- final read/write/open 使用共同 lexical + realpath guard；包含索引 activePath/skillPath/candidatePaths、resolver fallback、metadata、來源依賴掃描、writer、索引交易、context、Desktop openFile，以及 VS Code 開檔命令。VS Code TreeItem 把驗證延至實際命令執行，避免建立項目時的檢查被當成最後一次檢查。
- projectRoot 是信任邊界。工作區內任意設定的 memoryDir/skillsDir 仍有效；不能藉設定或索引跨出工作區。projectRoot 自身的合法 alias，以及仍指向專案內的 link 可以使用。
- guard 阻擋現有越界 symlink/junction、懸空 link、跨根／不同磁碟的 drive/UNC 路徑、drive-relative／device 特殊形式及新檔案父目錄越界；不是對抗其他程序持續惡意替換 ancestor 的 OS sandbox，不宣稱消除所有 TOCTOU race。

## 自動驗證

security-regression 工作流程只在指向 main 的 PR 執行，使用 contents: read、無持久 checkout credential、Ubuntu/Windows 標準 runner、Node 24。執行既有全套測試、lint、TypeScript、MCP+VS Code bundle 及 Desktop main/preload/renderer build。並以兩個獨立 Node 程序啟動實際 dist/mcp-server.js，透過 MCP SDK stdio client 檢查合法讀取、污染索引與惡意 frontmatter。沒有發布、tag、部署、安裝產品或上傳產物。

security-boundaries.test.ts 使用隔離人造資料，涵蓋危險 parser 標記無副作用、BOM/CRLF/日期與未知欄位、二次 frontmatter 內文、索引污染、外部 symlink/junction、可設定根目錄及內部 alias 正向案例。POSIX 懸空檔案 symlink 個案於 Windows 明確跳過；Windows directory junction 由 Windows runner 實測；UNC 實際網路分享 I/O 不在本批自動驗證範圍。

工作流程結果應以 PR 最後 commit 為準。MCP stdio 冒煙測試涵蓋實際 bundle 與 transport，但不等於所有工具端到端驗收。Desktop rescan 及 VS Code host-open callback 有針對性測試；Bundle build、callback 測試不代表已安裝 VSIX 或真實 Electron GUI 已完成端到端操作驗收。此 PR 不執行發布流程，也不替使用者安裝任一產品。

## 5.5.5 dependency follow-up (2026-10-04)

The preflight distinguished shipped runtime risk from npm's devDependency label: Electron is shipped in Desktop even though it is installed as a development dependency. The reviewed lock update stays on Electron 42 and targets nine existing dependency families plus their required closure. It updates Electron to 42.11.10, js-yaml to 3.15.2 / 4.3.2, tar to 7.5.22 and the identified production HTTP/URI/IP parser dependencies; it does not run a force audit fix or perform a general dependency overhaul.

At candidate `3e5b15a17f6608dd4261519679ec63dbaee94592`, [read-only preflight](https://github.com/Kunshao1117/cartridge_system/actions/runs/37180685029/job/111372463320) reports production audit **0**, and the full installation tree **29 findings: 25 high, 4 moderate, 0 critical**. Those remaining findings are in development/build tooling and are not represented as cleared or harmless. A zero production audit is not proof that all packaged surfaces or the build chain are vulnerability-free. Release review keeps these residual risks visible; no local installation or GUI acceptance is implied.

The npm publication verifier checks exact package version and gitHead, tarball SHA512/SHA1, manifest, and supported SLSA provenance subject/source metadata. It neither executes the downloaded package nor claims independent cryptographic signature or transparency-log verification. The prior public 5.5.4 package passed that verifier before using it for a new release.
