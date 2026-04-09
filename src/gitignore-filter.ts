/**
 * 記憶卡匣外掛系統 — Gitignore 排除引擎
 * 讀取專案 .gitignore 規則，提供統一的路徑排除查詢介面
 */

import fs from "node:fs";
import path from "node:path";
import ignore from "ignore";

export class GitignoreFilter {
  private ig: ReturnType<typeof ignore>;
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.ig = ignore();

    // 讀取專案根目錄的 .gitignore
    const gitignorePath = path.join(projectRoot, ".gitignore");
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, "utf-8");
      this.ig.add(content);
    }

    // 強制排除 .git 目錄（無論 .gitignore 是否存在）
    this.ig.add(".git");
  }

  /**
   * 重新載入 .gitignore 規則（檔案變更時呼叫）
   */
  reload(): void {
    this.ig = ignore();
    const gitignorePath = path.join(this.projectRoot, ".gitignore");
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, "utf-8");
      this.ig.add(content);
    }
    this.ig.add(".git");
  }

  /**
   * 查詢單一路徑是否應被忽略
   * @param relativePath - 相對於專案根目錄的路徑
   */
  isIgnored(relativePath: string): boolean {
    const normalized = relativePath.replace(/\\/g, "/");
    // 空路徑或根路徑不忽略
    if (!normalized || normalized === ".") return false;
    return this.ig.ignores(normalized);
  }

  /**
   * 批次過濾路徑清單，回傳不被忽略的路徑
   */
  filterPaths(relativePaths: string[]): string[] {
    return relativePaths.filter((p) => !this.isIgnored(p));
  }

  /**
   * 遞迴掃描目錄，回傳所有不被忽略的檔案相對路徑
   * 用於 detectMissedChanges 第二階段的全目錄掃描
   */
  scanDirectory(dir: string): string[] {
    const results: string[] = [];
    this._scanRecursive(dir, results);
    return results;
  }

  private _scanRecursive(dir: string, results: string[]): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absPath = path.join(dir, entry.name);
      const relPath = path
        .relative(this.projectRoot, absPath)
        .replace(/\\/g, "/");

      if (this.isIgnored(relPath)) continue;

      if (entry.isDirectory()) {
        this._scanRecursive(absPath, results);
      } else {
        results.push(relPath);
      }
    }
  }
}
