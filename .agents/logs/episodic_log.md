# 全局教訓日誌

## D12→D13 — MCP 工具寫入安全：雙模式演進紀錄（2026-03-28T17:10:00+08:00）

**影響模組**：`mem-mcp-tools`（`mcp-handlers.ts`）

**問題演進**：
1. **D12 原始問題**：`memory_update` 工具將 AI 傳入的 `content` 直接以 `writeFile` 整卡覆蓋，導致現有 SKILL.md 被清空為空殼。
2. **D12 初次修復**：改為 Read-Before-Write（永遠附加），但帶來新問題——AI 傳完整內容時會重複堆疊。
3. **D13 最終方案**：新增 `mode` 參數（`replace`/`append`），由 AI 明確選擇寫入策略。`replace`（預設）整張替換；`append` 附加至末尾。

**設計原則**：持久化寫入工具的語意必須讓呼叫方（AI）可控。預設行為應安全且符合最常見用法（replace），附加模式為明確選入。

**測試原則**：`replace` 測試不需 readFile mock；`append` 測試需模擬 readFile 回傳現有內容。

## D13→D14 — MCP 工具寫入升級：區段級 patch 模式（2026-03-28T18:10:00+08:00）

**影響模組**：`mem-mcp-tools`（`mcp-handlers.ts`、`mcp-server.ts`）、`memory-ops`

**問題**：
1. `replace` 模式需要傳輸整份檔案（2000-3000 tokens），即使只更新一個區段也會浪費大量 token。
2. `append` 模式盲目附加，如果附加內容包含已存在的 `##` 標題會產生重複區段。

**解決方案**：新增第三種模式 `patch`（區段級替換）：
- 以 `##` 為分割粒度，自動偵測同名區段並就地替換
- 新區段附加到末尾，未提及區段保持不動
- 核心函式：`parseSections()`（段落分割，含 CRLF 正規化 + 程式碼區塊守衛）、`mergeSections()`（段落合併，含標題正規化比對）
- 回傳操作統計（`N replaced, M added`）

**通用性驗證**：跨 Cartridge System（8 技能）和 Bartender Map（8 技能）兩個專案驗證，全部 16 個記憶技能的 `##` 結構完全一致，patch 模式可直接通用。

**設計原則**：不升級 `append` 為智慧合併（與 patch 功能重疊），三模式各司其職。patch 幾乎覆蓋 90% 使用場景。
