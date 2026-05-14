import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { CARTRIDGE_TOOLS } from "./tool-registry.js";
import { dispatchToolCall } from "./tool-dispatcher.js";

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

    return dispatchToolCall({ name, args });
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
