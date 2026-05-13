import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  handleMemoryList,
  handleMemoryRead,
  handleMemoryStatus,
  handleMemoryCommit,
  handleMemoryDeps,
} from "./mcp-handlers.js";
import { handleWorkspaceBrief } from "./workspace-brief.js";
import { handleCommitPreflight } from "./commit-preflight.js";

const server = new Server(
  {
    name: "cartridge-system",
    version: "4.1.1",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "memory_list",
        description: "列出指定專案中所有已被系統追蹤的記憶卡匣清單。",
        inputSchema: {
          type: "object",
          properties: {
            projectRoot: {
              type: "string",
              description: "目標專案的根目錄絕對路徑",
            },
          },
          required: ["projectRoot"],
        },
      },
      {
        name: "memory_read",
        description: "讀取指定專案中特定 mem-* 模組的完整內容。",
        inputSchema: {
          type: "object",
          properties: {
            moduleName: {
              type: "string",
              description: "記憶卡匣名稱，例如 mem-_system",
            },
            projectRoot: {
              type: "string",
              description: "目標專案的根目錄絕對路徑",
            },
          },
          required: ["moduleName", "projectRoot"],
        },
      },
      {
        name: "memory_status",
        description:
          "查詢指定記憶卡匣的過期修復診斷資訊。回傳過期指數、等級、異動檔案清單（含絕對路徑）以及具體的修復行動指引。用於在更新過期記憶前，取得需要讀取的原始碼檔案清單。",
        inputSchema: {
          type: "object",
          properties: {
            moduleName: {
              type: "string",
              description: "記憶卡匣名稱，例如 mem-analyzer",
            },
            projectRoot: {
              type: "string",
              description: "目標專案的根目錄絕對路徑",
            },
          },
          required: ["moduleName", "projectRoot"],
        },
      },
      {
        name: "memory_commit",
        description:
          "在 AI 用原生工具（write_to_file / replace_file_content）寫入 SKILL.md 後呼叫。自動完成：(1) 時間戳注入（台灣時區 +08:00）(2) staleness 歸零 (3) 索引同步（清除 pendingChanges、重新解析 trackedFiles）(4) 結構驗證（檢查必要欄位與區段）。此工具不處理任何內容寫入。",
        inputSchema: {
          type: "object",
          properties: {
            moduleName: {
              type: "string",
              description: "記憶卡匣名稱，例如 _system",
            },
            projectRoot: {
              type: "string",
              description: "目標專案的根目錄絕對路徑",
            },
          },
          required: ["moduleName", "projectRoot"],
        },
      },
      {
        name: "memory_deps",
        description:
          "查詢指定記憶卡匣的依賴拓樹。回傳上游依賴（此卡依賴誰）、下游被依賴者（誰依賴此卡）、間接過期指數。用於判斷跨模組過期傳播影響。",
        inputSchema: {
          type: "object",
          properties: {
            moduleName: {
              type: "string",
              description: "記憶卡匣名稱",
            },
            projectRoot: {
              type: "string",
              description: "目標專案的根目錄絕對路徑",
            },
          },
          required: ["moduleName", "projectRoot"],
        },
      },
      {
        name: "workspace_brief",
        description:
          "彙整專案治理狀態：專案身份、記憶卡健康、stale/ghost/untracked 狀態與建議下一步。作為 AI 開工前的高階入口。",
        inputSchema: {
          type: "object",
          properties: {
            projectRoot: {
              type: "string",
              description: "目標專案的根目錄絕對路徑",
            },
          },
          required: ["projectRoot"],
        },
      },
      {
        name: "commit_preflight",
        description:
          "提交前治理檢查：彙整 git dirty state、記憶卡健康狀態、阻塞原因與建議提交前動作。",
        inputSchema: {
          type: "object",
          properties: {
            projectRoot: {
              type: "string",
              description: "目標專案的根目錄絕對路徑",
            },
          },
          required: ["projectRoot"],
        },
      },
    ],
  };
});

server.setRequestHandler(
  CallToolRequestSchema,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (request): Promise<any> => {
    const { name, arguments: args } = request.params;

    if (name === "memory_list") {
      return handleMemoryList(args);
    }

    if (name === "memory_read") {
      return handleMemoryRead(args);
    }

    if (name === "memory_status") {
      return handleMemoryStatus(args);
    }

    if (name === "memory_commit") {
      return handleMemoryCommit(args);
    }

    if (name === "memory_deps") {
      return handleMemoryDeps(args);
    }

    if (name === "workspace_brief") {
      return handleWorkspaceBrief(args);
    }

    if (name === "commit_preflight") {
      return handleCommitPreflight(args);
    }

    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Cartridge System MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
