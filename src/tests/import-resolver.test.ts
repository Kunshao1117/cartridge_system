/**
 * 記憶卡匣外掛系統 — import 掃描器單元測試
 */

import { describe, it, expect } from "vitest";
import { extractImports } from "../import-resolver.js";

describe("extractImports — import 路徑擷取", () => {
  it("ES import from 語法", () => {
    const content = `import { foo } from "./types.js";\nimport bar from "../config.js";`;
    expect(extractImports(content)).toEqual(["./types.js", "../config.js"]);
  });

  it("動態 import() 語法", () => {
    const content = `const mod = await import("./lazy.js");`;
    expect(extractImports(content)).toEqual(["./lazy.js"]);
  });

  it("CommonJS require 語法", () => {
    const content = `const fs = require("fs");\nconst util = require("./util.js");`;
    expect(extractImports(content)).toEqual(["./util.js"]);
  });

  it("node_modules 套件應被跳過", () => {
    const content = `import z from "zod";\nimport { Server } from "@modelcontextprotocol/sdk/server/index.js";`;
    expect(extractImports(content)).toEqual([]);
  });

  it("去重", () => {
    const content = `import { a } from "./types.js";\nimport { b } from "./types.js";`;
    expect(extractImports(content)).toEqual(["./types.js"]);
  });
});
