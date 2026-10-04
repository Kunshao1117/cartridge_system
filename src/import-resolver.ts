import { assertPathInsideProject, tryProjectPath } from "./file-containment.js";
/**
 * 記憶卡匣外掛系統 — 輕量級 import 路徑掃描器
 * 從原始碼擷取 import/require 路徑，解析為專案相對路徑
 */

import path from "node:path";
import fs from "node:fs";

/** TypeScript 副檔名解析優先順序 */
const TS_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

/**
 * 從檔案內容擷取所有相對 import 路徑
 */
export function extractImports(content: string): string[] {
  const tokens = importTokens(content);
  const imports = new Set<string>();
  const add = (token: ImportToken | undefined) => {
    if (token?.literal && /^(?:\.\.?\/)/.test(token.value)) imports.add(token.value);
  };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.literal || tokens[i - 1]?.value === ".") continue;
    if (token.value === "from" || token.value === "import") add(tokens[i + 1]);
    if ((token.value === "import" || token.value === "require") && tokens[i + 1]?.value === "(") {
      add(tokens[i + 2]);
    }
  }
  return [...imports];
}

type ImportToken = { value: string; literal?: boolean };
/** A small lexical scanner: comments, strings and template text cannot invent
 * import keywords. This intentionally extracts only static string specifiers. */
function importTokens(content: string): ImportToken[] {
  const tokens: ImportToken[] = [];
  let cursor = 0;
  function scanCode(interpolation = false): void {
    let braces = 0;
    while (cursor < content.length) {
      const char = content[cursor];
      if (interpolation && char === "}" && braces === 0) { cursor++; return; }
      if (/\s/.test(char)) { cursor++; continue; }
      if (content.startsWith("//", cursor)) {
        const end = content.indexOf("\n", cursor + 2); cursor = end < 0 ? content.length : end; continue;
      }
      if (content.startsWith("/*", cursor)) {
        const end = content.indexOf("*/", cursor + 2); cursor = end < 0 ? content.length : end + 2; continue;
      }
      if (char === "`") {
        cursor++;
        tokens.push({ value: "", literal: true });
        while (cursor < content.length) {
          if (content[cursor] === "\\") { cursor += 2; continue; }
          if (content[cursor] === "`") { cursor++; break; }
          if (content.startsWith("${", cursor)) { cursor += 2; scanCode(true); }
          else cursor++;
        }
        continue;
      }
      if (char === "'" || char === '"') {
        const quote = char; let value = ""; cursor++;
        while (cursor < content.length && content[cursor] !== quote) {
          if (content[cursor] === "\\") {
            cursor++; if (cursor < content.length) value += content[cursor++];
          } else value += content[cursor++];
        }
        cursor++;
        tokens.push({ value, literal: true });
        continue;
      }
      if (char === "{") braces++;
      if (char === "}") braces--;
      const identifier = content.slice(cursor).match(/^[A-Za-z_$][\w$]*/)?.[0];
      if (identifier) { tokens.push({ value: identifier }); cursor += identifier.length; }
      else { tokens.push({ value: char }); cursor++; }
    }
  }
  scanCode();
  return tokens;
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
  const safeFrom = tryProjectPath(projectRoot, fromFile);
  if (!safeFrom) return null;
  const fromDir = path.dirname(safeFrom);
  const rawResolved = path.resolve(fromDir, importPath);

  if (!tryProjectPath(projectRoot, rawResolved)) return null;

  // 嘗試直接匹配
  if (fs.existsSync(rawResolved) && fs.statSync(rawResolved).isFile()) {
    return path.relative(projectRoot, rawResolved).replace(/\\/g, "/");
  }

  // 移除 .js/.jsx 後綴，嘗試 .ts/.tsx 等
  const withoutExt = rawResolved.replace(/\.(js|jsx)$/, "");
  for (const ext of TS_EXTENSIONS) {
    const candidate = withoutExt + ext;
    if (tryProjectPath(projectRoot, candidate) && fs.existsSync(candidate)) {
      return path.relative(projectRoot, candidate).replace(/\\/g, "/");
    }
  }

  // 嘗試 index 檔案（目錄 import）
  for (const ext of TS_EXTENSIONS) {
    const indexCandidate = path.join(rawResolved, `index${ext}`);
    if (tryProjectPath(projectRoot, indexCandidate) && fs.existsSync(indexCandidate)) {
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
  const absPath = tryProjectPath(projectRoot, filePath);
  if (!absPath || !fs.existsSync(absPath)) return [];

  const content = fs.readFileSync(assertPathInsideProject(projectRoot, absPath), "utf-8");
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
