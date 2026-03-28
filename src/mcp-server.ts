import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
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

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'memory_list',
        description: '列出指定專案中所有已被系統追蹤的記憶卡匣清單。',
        inputSchema: {
          type: 'object',
          properties: {
            projectRoot: { type: 'string', description: '目標專案的根目錄絕對路徑，例如 d:\\\\BartenderMap' },
          },
          required: ['projectRoot'],
        },
      },
      {
        name: 'memory_read',
        description: '讀取指定專案中特定 mem-* 模組的完整內容。',
        inputSchema: {
          type: 'object',
          properties: {
            moduleName: { type: 'string', description: '記憶卡匣名稱，例如 mem-_system' },
            projectRoot: { type: 'string', description: '目標專案的根目錄絕對路徑，例如 d:\\\\BartenderMap' },
          },
          required: ['moduleName', 'projectRoot'],
        },
      },
      {
        name: 'memory_update',
        description: '寫入並更新指定專案中特定 mem-* 模組的內容（會自動更新時間戳記與健康狀態）。支援 replace（整張替換）與 append（附加到末尾）兩種模式。',
        inputSchema: {
          type: 'object',
          properties: {
            moduleName: { type: 'string', description: '記憶卡匣名稱' },
            content: { type: 'string', description: '記憶卡內容。mode=replace 時傳完整 SKILL.md；mode=append 時傳要附加的差分段落' },
            mode: { type: 'string', enum: ['replace', 'append'], description: '寫入模式。replace（預設）= 整張替換；append = 附加到現有內容末尾' },
            projectRoot: { type: 'string', description: '目標專案的根目錄絕對路徑，例如 d:\\\\BartenderMap' },
          },
          required: ['moduleName', 'content', 'projectRoot'],
        },
      },
    ],
  }
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<any> => {
  const { name, arguments: args } = request.params

  if (name === 'memory_list') {
    return handleMemoryList(args)
  }

  if (name === 'memory_read') {
    return handleMemoryRead(args)
  }

  if (name === 'memory_update') {
    return handleMemoryUpdate(args)
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
