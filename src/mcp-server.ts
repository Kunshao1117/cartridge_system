#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { CARTRIDGE_TOOLS } from "./tool-registry.js";
import { dispatchToolCall } from "./tool-dispatcher.js";

export const MCP_SERVER_NAME = "cartridge-system";
export const MCP_SERVER_VERSION = "5.5.4";

export interface McpServerCliOptions {
  workspace?: string;
  help: boolean;
  version: boolean;
}

export interface McpServerOptions {
  defaultProjectRoot?: string;
}

export function formatMcpServerHelp(): string {
  return [
    "Cartridge System MCP Server",
    "",
    "Usage:",
    "  cartridge-system [--workspace <absolute-path>]",
    "  cartridge-mcp [--workspace <absolute-path>]",
    "",
    "Options:",
    "  --workspace <path>  Default project root for MCP tool calls.",
    "  -h, --help          Show this help message.",
    "  -V, --version       Show the package version.",
  ].join("\n");
}

export function parseMcpServerCliArgs(argv: string[]): McpServerCliOptions {
  const options: McpServerCliOptions = {
    help: false,
    version: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--workspace") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("--workspace requires an absolute path value.");
      }
      options.workspace = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--workspace=")) {
      const value = arg.slice("--workspace=".length);
      if (!value) {
        throw new Error("--workspace requires an absolute path value.");
      }
      options.workspace = value;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--version" || arg === "-V") {
      options.version = true;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

export function createMcpServer(options: McpServerOptions = {}): Server {
  const server = new Server(
    {
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
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
        description: `${tool.description}\n安全性：${tool.safetySummary}`,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  server.setRequestHandler(
    CallToolRequestSchema,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (request): Promise<any> => {
      const { name, arguments: args } = request.params;

      return dispatchToolCall({
        name,
        args,
        defaultProjectRoot: options.defaultProjectRoot,
      });
    },
  );

  return server;
}

export async function runMcpServer(argv = process.argv.slice(2)): Promise<number> {
  let cli: McpServerCliOptions;
  try {
    cli = parseMcpServerCliArgs(argv);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    console.error(formatMcpServerHelp());
    return 1;
  }

  if (cli.help) {
    console.log(formatMcpServerHelp());
    return 0;
  }

  if (cli.version) {
    console.log(MCP_SERVER_VERSION);
    return 0;
  }

  const server = createMcpServer({ defaultProjectRoot: cli.workspace });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Cartridge System MCP Server running on stdio");
  return 0;
}

if (require.main === module) {
  runMcpServer().then((code) => {
    if (code !== 0) {
      process.exit(code);
    }
  }).catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
