import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/extension.ts', 'src/mcp-server.ts'],
  format: ['cjs'],
  external: ['vscode'],
  noExternal: ['chokidar', 'gray-matter'],
  dts: false,
  sourcemap: true,
  clean: true,
})
