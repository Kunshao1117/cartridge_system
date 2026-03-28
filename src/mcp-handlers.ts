/**
 * 記憶卡匣外掛系統 — MCP 工具商業邏輯層
 * 將各工具的純商業邏輯從 MCP SDK 解耦，便於單元測試
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import * as z from 'zod'

/** MCP 工具回傳結構（純資料結構，與 MCP SDK 相容但不依賴其型別） */
export interface McpToolResult {
  content: Array<{ type: string; text: string }>
  isError?: boolean
}

/** memory_list 工具參數驗證 Schema */
export const memoryListSchema = z.object({
  projectRoot: z.string().min(1),
})

/** memory_read 工具參數驗證 Schema */
export const memoryReadSchema = z.object({
  moduleName: z.string().min(1),
  projectRoot: z.string().min(1),
})

/** memory_update 工具參數驗證 Schema */
export const memoryUpdateSchema = z.object({
  moduleName: z.string().min(1),
  content: z.string().min(1),
  projectRoot: z.string().min(1),
})

/**
 * memory_list — 列出所有 mem-* 記憶卡匣目錄名稱
 */
export async function handleMemoryList(args: unknown): Promise<McpToolResult> {
  const parsed = memoryListSchema.safeParse(args)
  if (!parsed.success) {
    return { content: [{ type: 'text', text: 'Validation Error: projectRoot is required' }], isError: true }
  }
  const agentsDir = path.join(parsed.data.projectRoot, '.agents', 'skills')
  try {
    const files = await fs.readdir(agentsDir, { withFileTypes: true })
    const modules = files
      .filter((d) => d.isDirectory() && d.name.startsWith('mem-'))
      .map((d) => d.name)
    return {
      content: [{ type: 'text', text: `Available memories:\n${modules.join('\n')}` }],
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true }
  }
}

/**
 * memory_read — 讀取指定記憶卡匣的 SKILL.md 內容
 */
export async function handleMemoryRead(
  args: unknown,
): Promise<McpToolResult> {
  const parsed = memoryReadSchema.safeParse(args)
  if (!parsed.success) {
    return { content: [{ type: 'text', text: 'Validation Error: moduleName and projectRoot are required' }], isError: true }
  }
  const agentsDir = path.join(parsed.data.projectRoot, '.agents', 'skills')
  try {
    const filePath = path.join(agentsDir, parsed.data.moduleName, 'SKILL.md')
    const content = await fs.readFile(filePath, 'utf-8')
    return { content: [{ type: 'text', text: content }] }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true }
  }
}

/**
 * memory_update — 寫入指定記憶卡匣的 SKILL.md，自動更新時間戳記與 staleness
 */
export async function handleMemoryUpdate(
  args: unknown,
): Promise<McpToolResult> {
  const parsed = memoryUpdateSchema.safeParse(args)
  if (!parsed.success) {
    return { content: [{ type: 'text', text: 'Validation Error: moduleName, content and projectRoot are required' }], isError: true }
  }
  const agentsDir = path.join(parsed.data.projectRoot, '.agents', 'skills')
  try {
    const tzOffset = 8 * 60 * 60 * 1000 // UTC+8
    const localTime = new Date(Date.now() + tzOffset)
    const isoLocal = localTime.toISOString().replace('Z', '+08:00')

    const finalContent = parsed.data.content
      .replace(/last_updated:\s*".*"/, `last_updated: "${isoLocal}"`)
      .replace(/staleness:\s*\d+/, `staleness: 0`)

    const filePath = path.join(agentsDir, parsed.data.moduleName, 'SKILL.md')
    await fs.writeFile(filePath, finalContent, 'utf-8')
    return {
      content: [{ type: 'text', text: `Successfully updated ${parsed.data.moduleName}` }],
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true }
  }
}
