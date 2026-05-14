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
import { CARTRIDGE_TOOLS } from "./tool-registry.js";

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
    tools: CARTRIDGE_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
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
