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
  mode: z.enum(['replace', 'append', 'patch']).default('replace'),
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

/** 解析後的 Markdown 區段結構 */
export interface Section {
  title: string
  normalizedTitle: string
  content: string
}

/** parseSections 的回傳結構 */
export interface ParsedDocument {
  preamble: string
  sections: Section[]
}

/** mergeSections 的回傳結構 */
export interface MergeResult {
  sections: Section[]
  replaced: number
  added: number
}

/**
 * 正規化區段標題，用於比對時忽略格式差異
 * 規則：壓縮空格 + 去尾空白 + 全小寫
 */
export function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * 將 Markdown body 解析為前言 + ## 區段陣列
 * - 追蹤 ``` 狀態以忽略程式碼區塊內的 ##
 * - CRLF 在分割前統一正規化為 LF
 */
export function parseSections(body: string): ParsedDocument {
  const normalized = body.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  let inCodeBlock = false
  let charPos = 0
  const headingPositions: number[] = []

  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock
    }
    if (!inCodeBlock && line.startsWith('## ')) {
      headingPositions.push(charPos)
    }
    charPos += line.length + 1
  }

  if (headingPositions.length === 0) {
    return { preamble: normalized, sections: [] }
  }

  const preamble = normalized.substring(0, headingPositions[0])
  const sections: Section[] = []

  for (let i = 0; i < headingPositions.length; i++) {
    const start = headingPositions[i]
    const end = i < headingPositions.length - 1 ? headingPositions[i + 1] : normalized.length
    const sectionText = normalized.substring(start, end)
    const newlineIdx = sectionText.indexOf('\n')
    const title = newlineIdx === -1 ? sectionText : sectionText.substring(0, newlineIdx)
    const content = newlineIdx === -1 ? '' : sectionText.substring(newlineIdx + 1)
    sections.push({ title, normalizedTitle: normalizeTitle(title), content })
  }

  return { preamble, sections }
}

/**
 * 合併原檔區段與 patch 區段
 * - 同名區段：就地替換（保持原檔位置與標題格式）
 * - 新區段：附加到末尾
 */
export function mergeSections(
  originalSections: Section[],
  patchSections: Section[],
): MergeResult {
  const result = originalSections.map((s) => ({ ...s }))
  const titleIndexMap = new Map<string, number>()
  for (let i = 0; i < result.length; i++) {
    titleIndexMap.set(result[i].normalizedTitle, i)
  }

  let replaced = 0
  let added = 0

  for (const patch of patchSections) {
    const existingIdx = titleIndexMap.get(patch.normalizedTitle)
    if (existingIdx !== undefined) {
      result[existingIdx] = {
        title: result[existingIdx].title,
        normalizedTitle: result[existingIdx].normalizedTitle,
        content: patch.content,
      }
      replaced++
    } else {
      result.push(patch)
      added++
    }
  }

  return { sections: result, replaced, added }
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

    // [D13/D14] 依 mode 切換寫入策略
    let base: string
    let responseText = `Successfully updated ${parsed.data.moduleName} (mode: ${parsed.data.mode})`

    if (parsed.data.mode === 'patch') {
      // [D14] 區段級替換：讀取 → 解析 → 合併 → 寫回
      let existingContent: string
      try {
        existingContent = await fs.readFile(filePath, 'utf-8')
      } catch {
        return {
          content: [{ type: 'text', text: 'Patch Error: 目標檔案不存在，patch 模式需要基底檔案。請先用 replace 模式建立。' }],
          isError: true,
        }
      }

      const existingDoc = matter(existingContent)
      const existingParsed = parseSections(existingDoc.content)
      const patchParsed = parseSections(parsed.data.content)

      if (patchParsed.sections.length === 0) {
        return {
          content: [{ type: 'text', text: 'Patch Error: 內容未包含任何 ## 區段。請用 ## 標題包裝更新內容。' }],
          isError: true,
        }
      }

      const { sections: merged, replaced, added } = mergeSections(existingParsed.sections, patchParsed.sections)

      let newBody = existingParsed.preamble
      for (const section of merged) {
        newBody += section.title + '\n' + section.content
      }

      base = matter.stringify(newBody, existingDoc.data)
      responseText = `Successfully patched ${parsed.data.moduleName}: ${replaced} replaced, ${added} added (mode: patch)`
    } else if (parsed.data.mode === 'append') {
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
      content: [{ type: 'text', text: responseText }],
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true }
  }
}
