import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/extension.ts', 'src/mcp-server.ts'],
  format: ['cjs'],
  external: ['vscode'],
  dts: false,
  sourcemap: true,
  clean: true,
})
