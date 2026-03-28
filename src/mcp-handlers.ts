/**
 * 記憶卡匣外掛系統 — MCP 工具商業邏輯層
 * 將各工具的純商業邏輯從 MCP SDK 解耦，便於單元測試
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import * as z from 'zod'
import matter from 'gray-matter'
import { validateProjectRoot } from './path-guard.js'
import { getTaiwanISO } from './timestamp.js'

/** MCP 工具回傳結構（純資料結構，與 MCP SDK 相容但不依賴其型別） */
export interface McpToolResult {
  content: Array<{ type: string; text: string }>
  isError?: boolean
}

/** projectRoot 共用驗證規則 */
const projectRootField = z.string().min(1).refine(
  (p) => path.isAbsolute(p) && !p.includes('..'),
  { message: '必須為絕對路徑且不含路徑穿越符號' }
)

/** memory_list 工具參數驗證 Schema */
export const memoryListSchema = z.object({
  projectRoot: projectRootField,
})

/** memory_read 工具參數驗證 Schema */
export const memoryReadSchema = z.object({
  moduleName: z.string().min(1),
  projectRoot: projectRootField,
})

/** memory_update 工具參數驗證 Schema */
export const memoryUpdateSchema = z.object({
  moduleName: z.string().min(1),
  content: z.string().min(1),
  mode: z.enum(['replace', 'append']).default('replace'),
  projectRoot: projectRootField,
})

/**
 * 使用 gray-matter 結構化更新 frontmatter 欄位
 * 取代易碎的正則替換，完整支援單引號、雙引號、無引號格式
 */
export function updateFrontmatterFields(
  rawContent: string,
  updates: Record<string, unknown>,
): string {
  const { data: frontmatter, content } = matter(rawContent)

  // 合併更新欄位
  for (const [key, value] of Object.entries(updates)) {
    frontmatter[key] = value
  }

  return matter.stringify(content, frontmatter)
}

/**
 * memory_list — 列出所有 mem-* 記憶卡匣目錄名稱
 */
export async function handleMemoryList(args: unknown): Promise<McpToolResult> {
  const parsed = memoryListSchema.safeParse(args)
  if (!parsed.success) {
    return { content: [{ type: 'text', text: 'Validation Error: projectRoot is required (must be absolute path without ..)' }], isError: true }
  }

  // 路徑安全二次驗證
  try {
    validateProjectRoot(parsed.data.projectRoot)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { content: [{ type: 'text', text: `Path Validation Error: ${msg}` }], isError: true }
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
    return { content: [{ type: 'text', text: 'Validation Error: moduleName and projectRoot are required (projectRoot must be absolute path without ..)' }], isError: true }
  }

  // 路徑安全二次驗證
  try {
    validateProjectRoot(parsed.data.projectRoot)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { content: [{ type: 'text', text: `Path Validation Error: ${msg}` }], isError: true }
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
 * memory_update — 更新指定記憶卡匣的 SKILL.md，自動更新時間戳記與 staleness
 *
 * [D13] 雙模式寫入：
 *   - replace（預設）：用 content 整張替換 SKILL.md，適用於 AI 讀取完整內容修改後寫回
 *   - append：先讀現有 SKILL.md，再將 content 附加至末尾，適用於 AI 只新增少量段落
 */
export async function handleMemoryUpdate(
  args: unknown,
): Promise<McpToolResult> {
  const parsed = memoryUpdateSchema.safeParse(args)
  if (!parsed.success) {
    return { content: [{ type: 'text', text: 'Validation Error: moduleName, content and projectRoot are required (projectRoot must be absolute path without ..)' }], isError: true }
  }

  // 路徑安全二次驗證
  try {
    validateProjectRoot(parsed.data.projectRoot)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { content: [{ type: 'text', text: `Path Validation Error: ${msg}` }], isError: true }
  }

  const agentsDir = path.join(parsed.data.projectRoot, '.agents', 'skills')
  try {
    const isoLocal = getTaiwanISO()
    const filePath = path.join(agentsDir, parsed.data.moduleName, 'SKILL.md')

    // [D13] 依 mode 切換寫入策略
    let base: string
    if (parsed.data.mode === 'append') {
      // 附加模式：先讀取現有 SKILL.md，再附加 content 至末尾
      let existingContent = ''
      try {
        existingContent = await fs.readFile(filePath, 'utf-8')
      } catch {
        // ENOENT：首次建立，允許空白起點
      }
      base = existingContent.trimEnd() + '\n' + parsed.data.content.trimStart()
    } else {
      // 取代模式（預設）：直接用 content 替換整張 SKILL.md
      base = parsed.data.content
    }

    const finalContent = updateFrontmatterFields(base, {
      last_updated: isoLocal,
      staleness: 0,
    })

    await fs.writeFile(filePath, finalContent, 'utf-8')
    return {
      content: [{ type: 'text', text: `Successfully updated ${parsed.data.moduleName} (mode: ${parsed.data.mode})` }],
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true }
  }
}
