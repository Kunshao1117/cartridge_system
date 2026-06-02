import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/desktop/main.ts", "src/desktop/preload.ts"],
  format: ["cjs"],
  platform: "node",
  external: ["electron"],
  noExternal: ["gray-matter", "ignore"],
  outDir: "dist/desktop",
  clean: false,
  dts: false,
  sourcemap: true,
});
