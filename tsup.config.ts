import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/extension.ts", "src/mcp-server.ts"],
  format: ["cjs"],
  external: ["vscode"],
  noExternal: ["chokidar", "gray-matter", "ignore"],
  dts: false,
  sourcemap: true,
  clean: true,
  async onSuccess() {
    const { cpSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    cpSync(resolve("src", "templates"), resolve("dist", "templates"), {
      recursive: true,
    });
    console.log("✅ 範本目錄已複製至 dist/templates/");
  },
});
