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
  handleMemoryCommit,
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
        description: '⚠️ 建議使用 write_to_file → memory_commit 的新流程。本工具為舊版介面，保留向後相容。用完整內容整張替換指定模組的 SKILL.md（會自動更新時間戳記與健康狀態）。',
        inputSchema: {
          type: 'object',
          properties: {
            moduleName: { type: 'string', description: '記憶卡匣名稱' },
            content: { type: 'string', description: '完整的 SKILL.md 內容（含 frontmatter）' },
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
      {
        name: 'memory_commit',
        description: '在 AI 用原生工具（write_to_file / replace_file_content）寫入 SKILL.md 後呼叫。自動完成：(1) 時間戳注入（台灣時區 +08:00）(2) staleness 歸零 (3) 索引同步（清除 pendingChanges、重新解析 trackedFiles）(4) 結構驗證（檢查必要欄位與區段）。此工具不處理任何內容寫入。',
        inputSchema: {
          type: 'object',
          properties: {
            moduleName: { type: 'string', description: '記憶卡匣名稱，例如 _system' },
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

  if (name === 'memory_commit') {
    return handleMemoryCommit(args)
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
