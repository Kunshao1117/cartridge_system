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
  handleMemoryStatus,
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
            projectRoot: { type: 'string', description: '目標專案的根目錄絕對路徑' },
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
            projectRoot: { type: 'string', description: '目標專案的根目錄絕對路徑' },
          },
          required: ['moduleName', 'projectRoot'],
        },
      },
      {
        name: 'memory_update',
        description: '寫入並更新指定專案中特定 mem-* 模組的內容（會自動更新時間戳記與健康狀態）。支援三種模式：replace（整張替換）、append（附加到末尾）、patch（## / ### 區段級替換，支援 dryRun 預覽）。',
        inputSchema: {
          type: 'object',
          properties: {
            moduleName: { type: 'string', description: '記憶卡匣名稱' },
            content: { type: 'string', description: '記憶卡內容。replace=完整SKILL.md；append=差分段落；patch=要替換的目標##/###區段（不含frontmatter）' },
            mode: { type: 'string', enum: ['replace', 'append', 'patch'], description: '寫入模式。replace（預設）=整張替換；append=附加到末尾；patch=區段級替換（支援##和###兩層合併，同名替換、新區段附加、未提及保留）' },
            dryRun: { type: 'boolean', description: '僅限 patch 模式。設為 true 時不寫入磁碟，只回傳變更預覽報告（含將替換/新增/保留/刪除的區段清單和行數差異）' },
            parentModule: { type: 'string', description: '巢狀建立時指定父記憶卡名稱。新建模組會放在父卡目錄下的子目錄中。僅在新建記憶卡時有效。' },
            projectRoot: { type: 'string', description: '目標專案的根目錄絕對路徑' },
          },
          required: ['moduleName', 'content', 'projectRoot'],
        },
      },
      {
        name: 'memory_status',
        description: '查詢指定記憶卡匣的過期修復診斷資訊。回傳過期指數、等級、異動檔案清單（含絕對路徑）以及具體的修復行動指引。用於在更新過期記憶前，取得需要讀取的原始碼檔案清單。',
        inputSchema: {
          type: 'object',
          properties: {
            moduleName: { type: 'string', description: '記憶卡匣名稱，例如 mem-analyzer' },
            projectRoot: { type: 'string', description: '目標專案的根目錄絕對路徑' },
          },
          required: ['moduleName', 'projectRoot'],
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

  if (name === 'memory_status') {
    return handleMemoryStatus(args)
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
