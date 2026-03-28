import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as z from 'zod'

const server = new Server(
  {
    name: 'cartridge-system',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// 解析 --workspace 參數，退回 process.cwd() 作為預設值
const workspaceIndex = process.argv.indexOf('--workspace')
const workspacePath = workspaceIndex !== -1 ? process.argv[workspaceIndex + 1] : process.cwd()
const agentsDir = path.join(workspacePath, '.agents', 'skills')

const memoryReadSchema = z.object({
  moduleName: z.string().min(1),
})

const memoryUpdateSchema = z.object({
  moduleName: z.string().min(1),
  content: z.string().min(1),
})

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'memory_list',
        description: '列出專案中所有已被系統追蹤的記憶卡匣清單。',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'memory_read',
        description: '讀取特定 mem-* 模組的完整內容。',
        inputSchema: {
          type: 'object',
          properties: {
            moduleName: { type: 'string', description: '記憶卡匣名稱，例如 mem-_system' },
          },
          required: ['moduleName'],
        },
      },
      {
        name: 'memory_update',
        description: '寫入並更新特定 mem-* 模組的內容（會自動更新時間戳記與健康狀態）。',
        inputSchema: {
          type: 'object',
          properties: {
            moduleName: { type: 'string' },
            content: { type: 'string', description: '完整的 Markdown 內容' },
          },
          required: ['moduleName', 'content'],
        },
      },
    ],
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  if (name === 'memory_list') {
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

  if (name === 'memory_read') {
    const parsed = memoryReadSchema.safeParse(args)
    if (!parsed.success) {
      return { content: [{ type: 'text', text: 'Validation Error' }], isError: true }
    }
    try {
      const filePath = path.join(agentsDir, parsed.data.moduleName, 'SKILL.md')
      const content = await fs.readFile(filePath, 'utf-8')
      return { content: [{ type: 'text', text: content }] }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true }
    }
  }

  if (name === 'memory_update') {
    const parsed = memoryUpdateSchema.safeParse(args)
    if (!parsed.success) {
      return { content: [{ type: 'text', text: 'Validation Error' }], isError: true }
    }
    try {
      const tzOffset = 8 * 60 * 60 * 1000 // UTC+8
      const localTime = new Date(Date.now() + tzOffset)
      const isoLocal = localTime.toISOString().replace('Z', '+08:00')

      const finalContent = parsed.data.content
        .replace(/last_updated:\s*".*"/, `last_updated: "${isoLocal}"`)
        .replace(/staleness:\s*\d+/, `staleness: 0`)

      const filePath = path.join(agentsDir, parsed.data.moduleName, 'SKILL.md')
      await fs.writeFile(filePath, finalContent, 'utf-8')
      return { content: [{ type: 'text', text: `Successfully updated ${parsed.data.moduleName}` }] }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true }
    }
  }

  return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Cartridge System MCP Server running on stdio')
}

main().catch((error) => {
  console.error("Server error:", error)
  process.exit(1)
})
