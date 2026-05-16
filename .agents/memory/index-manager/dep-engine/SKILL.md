---
name: dep-engine
description: |
  專案記憶：依賴推導引擎模組。 Use when: 處理模組間 import 掃描、依賴圖建構、間接過期傳播與循環偵測時載入。
last_updated: '2026-05-16T18:03:38+08:00'
status: stable
staleness: 0
dependencies:
  - core-types
metadata:
  author: antigravity
  version: '1.0'
  origin: project
  memory_awareness: full
  tool_scope:
    - 'filesystem:read'
---

# Dependency Engine — 依賴推導引擎記憶

## Tracked Files

- src/import-resolver.ts
- src/dependency-propagator.ts
- src/dependency-semantics.ts
- src/tests/import-resolver.test.ts
- src/tests/dependency-propagator.test.ts
- src/tests/dependency-semantics.test.ts

## Key Decisions

- D01: `import-resolver.ts` 負責解析單一檔案的靜態 import 宣告，支援 ES、動態 `import()` 及 CJS `require()` 三種語法
- D02: 副檔名映射策略 — 無副檔名的裸模組路徑優先嘗試 `.ts`、`.tsx`、`.js` 順序補全
- D03: `node_modules` 過濾 — 解析結果僅保留相對路徑（`./` 或 `../`），第三方套件一律排除
- D04: `dependency-propagator.ts` 以 `CartridgeIndexManager` 為資料源，遍歷追蹤檔案建構完整依賴圖（`Map<cartridgeId, Set<cartridgeId>>`）
- D05: 間接過期傳播採 BFS 演算法，深度由 `config.dependencyDepth`（預設 2）控制，衰減比例為 `1 / (depth^2)` 四捨五入取整
- D06: 循環依賴偵測採 DFS + visited Set，偵測到循環時不拋出錯誤而是記錄警告字串陣列回傳給呼叫端
- D07: 動態 `import()` 載入 — 為防止頂層循環依賴，`mcp-handlers.ts` 中的 `handleMemoryDeps` 採用 `await import()` 非同步載入本模組
- D08: depth=2 間接過期傳播需由回歸測試鎖定平方衰減；staleness 20 在第二層應傳播為 5。
- D09: `dependency-semantics.ts` 只提供 warning 型檢查，不取代 `D:\AI_Rules` 的欄位語義；它偵測 dependencies 缺少理由、父子導覽可疑、技能名稱混用與 Relations 鏡像可疑。
- D10: 本卡 frontmatter `dependencies` 僅保留 `core-types`，因依賴圖引擎直接消費的是 `CartridgeIndex` 型別契約；`index-manager` 是執行期資料來源與父卡導覽關係，放在 Relations，避免父子/資料來源關係與工程推導依賴形成記憶圖循環。

## Known Issues

- 無

## Module Lessons

- L01: (2026-05-06) BFS 傳播時需對 `indirectStaleness` 做 Math.round()，避免浮點數汙染 JSON 持久化格式
- L02: (2026-05-06) 循環偵測必須在建構依賴圖後立即執行，而非延遲至傳播階段，否則無窮迴圈會在 BFS 中先行觸發
- L03: (2026-05-14) 文件記載的 `1 / (depth^2)` 必須有 depth=2 具體數值測試，否則 `1 / depth` 這類弱化衰減會通過只檢查大於 0 的測試。
- L04: (2026-05-14) dependencies 語義防線應保持純函式與 warning-only，避免工具層越權定義規範語義。

## Relations

- index-manager（父卡與資料來源：提供 CartridgeEntry / trackedFiles / fileMap 的執行期索引資料）
- core-types（根層型別：CartridgeEntry, CartridgeConfig 定義所在）
- mcp-tools（根層模組：memory_deps 工具呼叫本引擎）
- mcp-tools.handlers（消費：memory_commit 整合 dependencies 語義警告）

## Applicable Skills

- test-patterns
