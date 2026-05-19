import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/extension.ts", "src/mcp-server.ts"],
    format: ["cjs"],
    external: ["vscode"],
    noExternal: ["gray-matter", "ignore"],
    dts: false,
    sourcemap: true,
    clean: true,
  },
  {
    entry: { "cabinet-webview": "src/cabinet-webview.ts" },
    format: ["iife"],
    platform: "browser",
    noExternal: ["cytoscape"],
    dts: false,
    sourcemap: false,
    clean: false,
  },
]);
