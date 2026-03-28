# 全局教訓日誌

## D12→D13 — MCP 工具寫入安全：雙模式演進紀錄（2026-03-28T17:10:00+08:00）

**影響模組**：`mem-mcp-tools`（`mcp-handlers.ts`）

**問題演進**：
1. **D12 原始問題**：`memory_update` 工具將 AI 傳入的 `content` 直接以 `writeFile` 整卡覆蓋，導致現有 SKILL.md 被清空為空殼。
2. **D12 初次修復**：改為 Read-Before-Write（永遠附加），但帶來新問題——AI 傳完整內容時會重複堆疊。
3. **D13 最終方案**：新增 `mode` 參數（`replace`/`append`），由 AI 明確選擇寫入策略。`replace`（預設）整張替換；`append` 附加至末尾。

**設計原則**：持久化寫入工具的語意必須讓呼叫方（AI）可控。預設行為應安全且符合最常見用法（replace），附加模式為明確選入。

**測試原則**：`replace` 測試不需 readFile mock；`append` 測試需模擬 readFile 回傳現有內容。

