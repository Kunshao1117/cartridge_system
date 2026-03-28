import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import * as path from 'path'
import {
  handleMemoryList,
  handleMemoryRead,
  handleMemoryUpdate,
} from './mcp-handlers.js'

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<any> => {
  const { name, arguments: args } = request.params

  if (name === 'memory_list') {
    return handleMemoryList(agentsDir)
  }

  if (name === 'memory_read') {
    return handleMemoryRead(agentsDir, args)
  }

  if (name === 'memory_update') {
    return handleMemoryUpdate(agentsDir, args)
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
