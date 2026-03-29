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

/** 過期等級閾值（預設值，與 Extension 的 CartridgeConfig 解耦） */
const STALENESS_THRESHOLDS = { significant: 10, critical: 30 }

/** 過期指數轉換為人類可讀等級（輕量版，不依賴 CartridgeConfig） */
export function stalenessToLevel(staleness: number): string {
  if (staleness <= 0) return 'healthy'
  if (staleness < STALENESS_THRESHOLDS.significant) return 'mild'
  if (staleness < STALENESS_THRESHOLDS.critical) return 'significant'
  return 'critical'
}

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

/** memory_status 工具參數驗證 Schema */
export const memoryStatusSchema = z.object({
  moduleName: z.string().min(1),
  projectRoot: projectRootField,
})

/** memory_update 工具參數驗證 Schema */
export const memoryUpdateSchema = z.object({
  moduleName: z.string().min(1),
  content: z.string().min(1),
  mode: z.enum(['replace', 'append', 'patch']).default('replace'),
  dryRun: z.boolean().default(false),
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

/** 解析後的 Markdown 子區段結構（### 層級） */
export interface SubSection {
  title: string
  normalizedTitle: string
  content: string
}

/** 解析後的 Markdown 區段結構（## 層級） */
export interface Section {
  title: string
  normalizedTitle: string
  content: string
  subSections: SubSection[]
}

/** parseSections 的回傳結構 */
export interface ParsedDocument {
  preamble: string
  sections: Section[]
}

/** mergeSections 的回傳結構 */
export interface MergeResult {
  sections: Section[]
  replaced: string[]
  added: string[]
  removed: string[]
  warnings: string[]
}

/**
 * 正規化區段標題，用於比對時忽略格式差異
 * 規則：壓縮空格 + 去尾空白 + 全小寫
 */
export function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * 將 ### 區段內容解析為子區段陣列
 * - 追蹤 ``` 狀態以忽略程式碼區塊內的 ###
 */
export function parseSubSections(content: string): { leading: string; subSections: SubSection[] } {
  const lines = content.split('\n')
  let inCodeBlock = false
  let charPos = 0
  const headingPositions: number[] = []

  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock
    }
    if (!inCodeBlock && line.startsWith('### ')) {
      headingPositions.push(charPos)
    }
    charPos += line.length + 1
  }

  if (headingPositions.length === 0) {
    return { leading: content, subSections: [] }
  }

  const leading = content.substring(0, headingPositions[0])
  const subSections: SubSection[] = []

  for (let i = 0; i < headingPositions.length; i++) {
    const start = headingPositions[i]
    const end = i < headingPositions.length - 1 ? headingPositions[i + 1] : content.length
    const subText = content.substring(start, end)
    const newlineIdx = subText.indexOf('\n')
    const title = newlineIdx === -1 ? subText : subText.substring(0, newlineIdx)
    const subContent = newlineIdx === -1 ? '' : subText.substring(newlineIdx + 1)
    subSections.push({ title, normalizedTitle: normalizeTitle(title), content: subContent })
  }

  return { leading, subSections }
}

/**
 * 將 Markdown body 解析為前言 + ## 區段陣列
 * - 追蹤 ``` 狀態以忽略程式碼區塊內的 ##
 * - CRLF 在分割前統一正規化為 LF
 * - 每個 ## 區段自動解析內部的 ### 子區段
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
    if (!inCodeBlock && line.startsWith('## ') && !line.startsWith('### ')) {
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
    const { subSections } = parseSubSections(content)
    sections.push({ title, normalizedTitle: normalizeTitle(title), content, subSections })
  }

  return { preamble, sections }
}

/**
 * 從 content + subSections 重組完整的區段文字內容
 */
function rebuildSectionContent(leading: string, subSections: SubSection[]): string {
  let result = leading
  for (const sub of subSections) {
    result += sub.title + '\n' + sub.content
  }
  return result
}

/**
 * 合併原檔區段與 patch 區段（支援兩層合併）
 * - 同名 ## 區段：
 *   - 若 patch 包含 ### 子區段 → 子區段級合併（只替換提及的 ###，保留未提及的 ###）
 *   - 若 patch 不含 ### 子區段 → 整段替換（向下相容原有行為）
 * - 新 ## 區段：附加到末尾
 */
export function mergeSections(
  originalSections: Section[],
  patchSections: Section[],
): MergeResult {
  const result = originalSections.map((s) => ({
    ...s,
    subSections: s.subSections.map((sub) => ({ ...sub })),
  }))
  const titleIndexMap = new Map<string, number>()
  for (let i = 0; i < result.length; i++) {
    titleIndexMap.set(result[i].normalizedTitle, i)
  }

  const replaced: string[] = []
  const added: string[] = []
  const removed: string[] = []
  const warnings: string[] = []

  for (const patch of patchSections) {
    const existingIdx = titleIndexMap.get(patch.normalizedTitle)
    if (existingIdx !== undefined) {
      const original = result[existingIdx]

      // 若 patch 含 ### 子區段且原始區段也含 ### → 子區段級合併
      if (patch.subSections.length > 0 && original.subSections.length > 0) {
        const mergedSubs = original.subSections.map((sub) => ({ ...sub }))
        const subTitleMap = new Map<string, number>()
        for (let j = 0; j < mergedSubs.length; j++) {
          subTitleMap.set(mergedSubs[j].normalizedTitle, j)
        }

        for (const patchSub of patch.subSections) {
          const subIdx = subTitleMap.get(patchSub.normalizedTitle)
          if (subIdx !== undefined) {
            mergedSubs[subIdx] = {
              title: mergedSubs[subIdx].title,
              normalizedTitle: mergedSubs[subIdx].normalizedTitle,
              content: patchSub.content,
            }
            replaced.push(`${original.title} > ${mergedSubs[subIdx].title}`)
          } else {
            mergedSubs.push(patchSub)
            added.push(`${original.title} > ${patchSub.title}`)
          }
        }

        // 取得 patch 的 leading（### 之前的文字）
        const { leading: patchLeading } = parseSubSections(patch.content)
        const { leading: originalLeading } = parseSubSections(original.content)
        const finalLeading = patchLeading.trim() ? patchLeading : originalLeading

        result[existingIdx] = {
          title: original.title,
          normalizedTitle: original.normalizedTitle,
          content: rebuildSectionContent(finalLeading, mergedSubs),
          subSections: mergedSubs,
        }
      } else {
        // 若 patch 不含 ### 或原始不含 ### → 整段替換（向下相容）
        // 偵測是否有原始 ### 子區段被移除
        if (original.subSections.length > 0 && patch.subSections.length === 0) {
          for (const sub of original.subSections) {
            removed.push(`${original.title} > ${sub.title}`)
          }
          warnings.push(
            `${original.title} 下的 ${original.subSections.length} 個子區段被整段替換移除（patch 未包含任何 ### 子區段）`
          )
        }
        result[existingIdx] = {
          title: original.title,
          normalizedTitle: original.normalizedTitle,
          content: patch.content,
          subSections: patch.subSections,
        }
        replaced.push(original.title)
      }
    } else {
      result.push(patch)
      added.push(patch.title)
    }
  }

  return { sections: result, replaced, added, removed, warnings }
}

/**
 * memory_list — 列出所有 mem-* 記憶卡匣目錄名稱（含過期狀態增強）
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

    // 嘗試從索引檔讀取過期狀態（增強回傳）
    const indexPath = path.join(parsed.data.projectRoot, 'cartridge_index.json')
    try {
      const indexRaw = await fs.readFile(indexPath, 'utf-8')
      const index = JSON.parse(indexRaw)
      const cartridges = index.cartridges ?? {}

      const enriched = modules.map((mod) => {
        const entry = cartridges[mod]
        if (entry) {
          return {
            module: mod,
            staleness: entry.staleness ?? 0,
            level: stalenessToLevel(entry.staleness ?? 0),
            pendingChangesCount: entry.pendingChanges?.length ?? 0,
          }
        }
        return { module: mod, staleness: 0, level: 'healthy', pendingChangesCount: 0 }
      })

      return {
        content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }],
      }
    } catch {
      // 索引不存在時回退到純文字模式（向後相容）
      return {
        content: [{ type: 'text', text: `Available memories:\n${modules.join('\n')}` }],
      }
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
 * memory_status — 查詢過期修復所需的診斷資訊
 * 回傳：過期指數、等級、異動檔案清單（含絕對路徑）、行動指引
 */
export async function handleMemoryStatus(
  args: unknown,
): Promise<McpToolResult> {
  const parsed = memoryStatusSchema.safeParse(args)
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

  const { moduleName, projectRoot } = parsed.data
  const indexPath = path.join(projectRoot, 'cartridge_index.json')

  // 嘗試從索引檔讀取完整資訊
  try {
    const indexRaw = await fs.readFile(indexPath, 'utf-8')
    const index = JSON.parse(indexRaw)
    const entry = index.cartridges?.[moduleName]

    if (!entry) {
      return { content: [{ type: 'text', text: `Error: Module "${moduleName}" not found in cartridge index.` }], isError: true }
    }

    const level = stalenessToLevel(entry.staleness ?? 0)
    const pendingChanges = (entry.pendingChanges ?? []).map(
      (change: { filePath: string; eventType: string; timestamp: string }) => ({
        ...change,
        absolutePath: path.resolve(projectRoot, change.filePath),
      })
    )

    // 組建行動指引
    let actionRequired = ''
    if (entry.staleness > 0 && pendingChanges.length > 0) {
      const fileList = pendingChanges
        .map((c: { absolutePath: string; eventType: string }) => `- ${c.absolutePath} (${c.eventType})`)
        .join('\n')
      actionRequired = `此記憶卡已過期。更新前請先使用 view_file 讀取以下異動檔案：\n${fileList}\n讀取後再呼叫 memory_update 根據最新原始碼更新記憶內容。`
    } else if (entry.staleness > 0) {
      actionRequired = `此記憶卡已過期（staleness: ${entry.staleness}），但無已記錄的異動檔案。請手動檢查追蹤檔案清單中的原始碼。`
    }

    const status = {
      module: moduleName,
      staleness: entry.staleness ?? 0,
      level,
      lastUpdated: entry.lastUpdated ?? '',
      trackedFiles: entry.trackedFiles ?? [],
      pendingChanges,
      actionRequired,
    }

    return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] }
  } catch {
    // 索引檔不存在 — 回退到讀取 SKILL.md frontmatter
    const agentsDir = path.join(projectRoot, '.agents', 'skills')
    try {
      const filePath = path.join(agentsDir, moduleName, 'SKILL.md')
      const raw = await fs.readFile(filePath, 'utf-8')
      const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/)
      let staleness = 0
      let lastUpdated = ''
      if (fmMatch) {
        const smatch = fmMatch[1].match(/staleness:\s*(\d+)/)
        const tmatch = fmMatch[1].match(/last_updated:\s*['"]?([^'"\n]+)/)
        if (smatch) staleness = parseInt(smatch[1], 10)
        if (tmatch) lastUpdated = tmatch[1].trim()
      }

      const status = {
        module: moduleName,
        staleness,
        level: stalenessToLevel(staleness),
        lastUpdated,
        trackedFiles: [],
        pendingChanges: [],
        actionRequired: staleness > 0
          ? `此記憶卡已過期（staleness: ${staleness}）。索引檔不存在，無法提供異動檔案清單。請手動檢查追蹤檔案清單中的原始碼。`
          : '',
        _note: '索引檔不存在，過期資訊來自 SKILL.md frontmatter。pendingChanges 和 trackedFiles 無法提供。',
      }

      return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true }
    }
  }
}

/** patch 模式結構化回傳結果 */
export interface PatchReport {
  status: 'success' | 'dry_run'
  module: string
  replaced: string[]
  added: string[]
  removed: string[]
  preserved: string[]
  linesBefore: number
  linesAfter: number
  warnings: string[]
}

/** 大幅刪減保護閾值（行數減少百分比） */
const SHRINKAGE_THRESHOLD = 0.3

/**
 * memory_update — 更新指定記憶卡匣的 SKILL.md，自動更新時間戳記與 staleness
 *
 * [D13] 雙模式寫入：
 *   - replace（預設）：用 content 整張替換 SKILL.md，適用於 AI 讀取完整內容修改後寫回
 *   - append：先讀現有 SKILL.md，再將 content 附加至末尾，適用於 AI 只新增少量段落
 * [D15] patch 模式閘門機制：
 *   - 支援 ### 子區段級合併（最小匹配原則）
 *   - dryRun 操作前預覽
 *   - 結構化 JSON 回傳
 *   - 大幅刪減保護
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

    // [D13/D14/D15] 依 mode 切換寫入策略
    let base: string
    let responseText = `Successfully updated ${parsed.data.moduleName} (mode: ${parsed.data.mode})`

    if (parsed.data.mode === 'patch') {
      // [D14/D15] 區段級替換：讀取 → 解析 → 合併 → 閘門 → 寫回
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

      const mergeResult = mergeSections(existingParsed.sections, patchParsed.sections)

      let newBody = existingParsed.preamble
      for (const section of mergeResult.sections) {
        newBody += section.title + '\n' + section.content
      }

      // 計算行數差異
      const linesBefore = existingDoc.content.split('\n').length
      const linesAfter = newBody.split('\n').length

      // 識別保留的區段（未被 patch 提及的 ## 區段）
      const patchTitles = new Set(patchParsed.sections.map((s) => s.normalizedTitle))
      const preserved = existingParsed.sections
        .filter((s) => !patchTitles.has(s.normalizedTitle))
        .map((s) => s.title)

      // 組建結構化報告
      const report: PatchReport = {
        status: parsed.data.dryRun ? 'dry_run' : 'success',
        module: parsed.data.moduleName,
        replaced: mergeResult.replaced,
        added: mergeResult.added,
        removed: mergeResult.removed,
        preserved,
        linesBefore,
        linesAfter,
        warnings: [...mergeResult.warnings],
      }

      // 大幅刪減保護閘門
      if (linesBefore > 0 && (linesBefore - linesAfter) / linesBefore > SHRINKAGE_THRESHOLD) {
        report.warnings.push(
          `⚠️ 大幅刪減警告：行數從 ${linesBefore} 減少到 ${linesAfter}（減少 ${Math.round((1 - linesAfter / linesBefore) * 100)}%，超過 ${SHRINKAGE_THRESHOLD * 100}% 閾值）`
        )
      }

      // dryRun 模式：不寫入磁碟，只回傳預覽報告
      if (parsed.data.dryRun) {
        return {
          content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
        }
      }

      base = matter.stringify(newBody, existingDoc.data)
      responseText = JSON.stringify(report, null, 2)
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

    // 清除索引檔中對應模組的 pendingChanges（graceful，失敗不影響更新結果）
    try {
      const indexPath = path.join(parsed.data.projectRoot, 'cartridge_index.json')
      const indexRaw = await fs.readFile(indexPath, 'utf-8')
      const index = JSON.parse(indexRaw)
      if (index.cartridges?.[parsed.data.moduleName]) {
        index.cartridges[parsed.data.moduleName].pendingChanges = []
        index.cartridges[parsed.data.moduleName].staleness = 0
        await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8')
      }
    } catch {
      // 索引檔不存在或讀寫失敗 — 靜默忽略，不影響更新結果
    }

    return {
      content: [{ type: 'text', text: responseText }],
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true }
  }
}
