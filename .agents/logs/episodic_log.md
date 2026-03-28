# 全局教訓日誌

## D12 — MCP 工具寫入安全：Read-Before-Write 強制原則（2026-03-28T16:40:00+08:00）

**影響模組**：`mem-mcp-tools`（`mcp-handlers.ts`）

**問題**：`memory_update` 工具將 AI 傳入的 `content` 直接以 `writeFile` 整卡覆蓋，導致現有 SKILL.md 被清空為空殼。根因是工具設計預設呼叫方傳入「完整檔案內容」，但 AI 實際傳入的是「差分段落」，兩者語意錯位。

**修復原則**：任何對持久化文件的更新操作，均必須遵守 **Read-Before-Write** 模式：
1. 先讀取現有內容（允許 ENOENT，以空字串為首次建立起點）
2. 將新 `content` 附加至現有內容末尾
3. 統一更新 frontmatter（`updateFrontmatterFields`）
4. 最後寫回磁碟

**設計參考**：`writer.ts` 的 `injectWarning()` 是此模式的既有範本，應作為所有寫入操作的標準樣板。

**測試補丁原則**：引入 Read-Before-Write 後，所有涉及 `handleMemoryUpdate` 的舊測試均需補上 `vi.mocked(fs.readFile)` mock，才能正確模擬雙步驟 I/O 流程。
