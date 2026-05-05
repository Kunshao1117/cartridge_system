/**
 * 記憶卡匣外掛系統 — 輕量級 import 路徑掃描器
 * 從原始碼擷取 import/require 路徑，解析為專案相對路徑
 */

import path from "node:path";
import fs from "node:fs";

/** 匹配三種 import 模式的正則 */
const IMPORT_PATTERNS: RegExp[] = [
  /from\s+['"]([^'"]+)['"]/g, // ES import ... from "path"
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // 動態 import("path")
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // CommonJS require("path")
];

/** TypeScript 副檔名解析優先順序 */
const TS_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

/**
 * 從檔案內容擷取所有相對 import 路徑
 */
export function extractImports(content: string): string[] {
  const imports: Set<string> = new Set();
  for (const pattern of IMPORT_PATTERNS) {
    // 每次使用前建立新的 RegExp 實例以重置 lastIndex
    const re = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) !== null) {
      const importPath = match[1];
      // 只處理相對路徑（./ 或 ../），跳過 node_modules 套件
      if (importPath.startsWith(".")) {
        imports.add(importPath);
      }
    }
  }
  return [...imports];
}

/**
 * 將相對 import 路徑解析為專案根目錄相對路徑
 * 處理 .js → .ts 的副檔名映射（TypeScript 常見模式）
 */
export function resolveImportPath(
  importPath: string,
  fromFile: string,
  projectRoot: string,
): string | null {
  const fromDir = path.dirname(path.resolve(projectRoot, fromFile));
  const rawResolved = path.resolve(fromDir, importPath);

  // 嘗試直接匹配
  if (fs.existsSync(rawResolved) && fs.statSync(rawResolved).isFile()) {
    return path.relative(projectRoot, rawResolved).replace(/\\/g, "/");
  }

  // 移除 .js/.jsx 後綴，嘗試 .ts/.tsx 等
  const withoutExt = rawResolved.replace(/\.(js|jsx)$/, "");
  for (const ext of TS_EXTENSIONS) {
    const candidate = withoutExt + ext;
    if (fs.existsSync(candidate)) {
      return path.relative(projectRoot, candidate).replace(/\\/g, "/");
    }
  }

  // 嘗試 index 檔案（目錄 import）
  for (const ext of TS_EXTENSIONS) {
    const indexCandidate = path.join(rawResolved, `index${ext}`);
    if (fs.existsSync(indexCandidate)) {
      return path.relative(projectRoot, indexCandidate).replace(/\\/g, "/");
    }
  }

  return null;
}

/**
 * 掃描一個檔案的所有相對 import 依賴，回傳專案相對路徑
 */
export function scanFileImports(
  filePath: string,
  projectRoot: string,
): string[] {
  const absPath = path.resolve(projectRoot, filePath);
  if (!fs.existsSync(absPath)) return [];

  const content = fs.readFileSync(absPath, "utf-8");
  const rawImports = extractImports(content);
  const resolved: string[] = [];

  for (const imp of rawImports) {
    const resolvedPath = resolveImportPath(imp, filePath, projectRoot);
    if (resolvedPath) {
      resolved.push(resolvedPath);
    }
  }

  return resolved;
}
