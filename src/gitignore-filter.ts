/**
 * 記憶卡匣外掛系統 — Git 排除服務
 * Git repository 以 Git CLI 為標準語義來源；失敗時回退根目錄 .gitignore。
 */

import { execFile as execFileCallback } from "node:child_process";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import ignore from "ignore";
import { listProjectFiles } from "./project-file-list.js";

const execFile = promisify(execFileCallback);
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BUFFER = 16 * 1024 * 1024;
const warnedGitExclusionOperations = new Set<string>();

export type GitExclusionMode =
  | "git-standard"
  | "root-gitignore-fallback";

export interface GitExclusionDiagnostic {
  code:
    | "git_not_repository"
    | "git_unavailable"
    | "git_command_failed";
  operation: "discover-files" | "check-ignore";
  mode: "root-gitignore-fallback";
  message: string;
}

export interface ProjectFileDiscoveryResult {
  files: string[];
  mode: GitExclusionMode;
  diagnostics: GitExclusionDiagnostic[];
}

export interface GitIgnoreDecision {
  ignored: boolean;
  mode: GitExclusionMode;
  diagnostics: GitExclusionDiagnostic[];
}

export interface GitignoreFilterOptions {
  gitExecutable?: string;
  gitArgsPrefix?: string[];
  timeoutMs?: number;
  maxBuffer?: number;
}

interface GitCommandError extends Error {
  code?: string | number;
  stderr?: string | Buffer;
}

export class GitignoreFilter {
  private ig: ReturnType<typeof ignore>;
  private readonly projectRoot: string;
  private readonly gitExecutable: string;
  private readonly gitArgsPrefix: string[];
  private readonly timeoutMs: number;
  private readonly maxBuffer: number;

  constructor(projectRoot: string, options: GitignoreFilterOptions = {}) {
    this.projectRoot = path.resolve(projectRoot);
    this.gitExecutable = options.gitExecutable ?? "git";
    this.gitArgsPrefix = options.gitArgsPrefix ?? [];
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxBuffer = options.maxBuffer ?? DEFAULT_MAX_BUFFER;
    this.ig = ignore();
    this.reload();
  }

  /** 重新載入 fallback 使用的根目錄 .gitignore 規則。 */
  reload(): void {
    this.ig = ignore();
    const gitignorePath = path.join(this.projectRoot, ".gitignore");
    if (fs.existsSync(gitignorePath)) {
      this.ig.add(fs.readFileSync(gitignorePath, "utf-8"));
    }
    this.ig.add(".git");
  }

  /** 根 .gitignore fallback 的同步判定介面。 */
  isIgnored(relativePath: string): boolean {
    const normalized = normalizeRelativePath(relativePath);
    if (!normalized || normalized === ".") return false;
    return this.ig.ignores(normalized);
  }

  /** 根 .gitignore fallback 的同步批次過濾介面。 */
  filterPaths(relativePaths: string[]): string[] {
    return relativePaths.filter((item) => !this.isIgnored(item));
  }

  /** 使用 Git 標準排除來源建立 canonical project file set。 */
  async discoverProjectFiles(): Promise<ProjectFileDiscoveryResult> {
    try {
      const { stdout } = await execFile(
        this.gitExecutable,
        [
          ...this.gitArgsPrefix,
          "-C",
          this.projectRoot,
          "ls-files",
          "--cached",
          "--others",
          "--exclude-standard",
          "-z",
          "--",
          ".",
        ],
        this.commandOptions(),
      );
      const files = await this.validateGitPaths(String(stdout).split("\0"));
      return { files, mode: "git-standard", diagnostics: [] };
    } catch (error) {
      const diagnostic = this.createDiagnostic("discover-files", error);
      this.warnOnce(diagnostic);
      this.reload();
      const fallbackFiles = this.filterPaths(
        await listProjectFiles(this.projectRoot),
      );
      return {
        files: fallbackFiles,
        mode: "root-gitignore-fallback",
        diagnostics: [diagnostic],
      };
    }
  }

  /** 使用 Git check-ignore 判定單一路徑；tracked files 不會被排除。 */
  async checkIgnored(relativePath: string): Promise<GitIgnoreDecision> {
    const normalized = normalizeRelativePath(relativePath);
    if (!normalized || normalized === ".") {
      return { ignored: false, mode: "git-standard", diagnostics: [] };
    }

    try {
      await execFile(
        this.gitExecutable,
        [
          ...this.gitArgsPrefix,
          "-C",
          this.projectRoot,
          "check-ignore",
          "--quiet",
          "--",
          `./${normalized}`,
        ],
        this.commandOptions(),
      );
      return { ignored: true, mode: "git-standard", diagnostics: [] };
    } catch (error) {
      if (getExitCode(error) === 1) {
        return { ignored: false, mode: "git-standard", diagnostics: [] };
      }
      const diagnostic = this.createDiagnostic("check-ignore", error);
      this.warnOnce(diagnostic);
      this.reload();
      return {
        ignored: this.isIgnored(normalized),
        mode: "root-gitignore-fallback",
        diagnostics: [diagnostic],
      };
    }
  }

  private commandOptions() {
    const env = { ...process.env };
    delete env.GIT_LITERAL_PATHSPECS;
    delete env.GIT_NOGLOB_PATHSPECS;
    delete env.GIT_GLOB_PATHSPECS;
    delete env.GIT_ICASE_PATHSPECS;
    return {
      windowsHide: true,
      timeout: this.timeoutMs,
      maxBuffer: this.maxBuffer,
      encoding: "utf8" as const,
      env,
    };
  }

  private async validateGitPaths(paths: string[]): Promise<string[]> {
    const valid = new Set<string>();
    for (const candidate of paths) {
      const normalized = normalizeRelativePath(candidate);
      if (!normalized || path.isAbsolute(normalized)) continue;
      const absolute = path.resolve(this.projectRoot, normalized);
      if (isOutsideRoot(this.projectRoot, absolute)) continue;
      try {
        const stat = await fsPromises.lstat(absolute);
        if (!stat.isDirectory()) valid.add(normalized);
      } catch {
        // Git index 中已刪除但尚未提交的 tracked path 不應成為候選。
      }
    }
    return [...valid].sort();
  }

  private createDiagnostic(
    operation: GitExclusionDiagnostic["operation"],
    error: unknown,
  ): GitExclusionDiagnostic {
    const gitError = error as GitCommandError;
    const stderr = String(gitError?.stderr ?? "").trim();
    const code =
      gitError?.code === "ENOENT"
        ? "git_unavailable"
        : /not a git repository/i.test(stderr)
          ? "git_not_repository"
          : "git_command_failed";
    const reason = stderr || gitError?.message || "unknown Git error";
    return {
      code,
      operation,
      mode: "root-gitignore-fallback",
      message:
        `Git ${operation} unavailable for ${this.projectRoot}; ` +
        `using root .gitignore fallback (${reason}).`,
    };
  }

  private warnOnce(diagnostic: GitExclusionDiagnostic): void {
    const key = getGitExclusionWarningKey(
      this.projectRoot,
      diagnostic.operation,
    );
    if (warnedGitExclusionOperations.has(key)) return;
    warnedGitExclusionOperations.add(key);
    console.warn(`[Cartridge Git Exclusion] ${diagnostic.message}`);
  }
}

export function getGitExclusionWarningKey(
  projectRoot: string,
  operation: GitExclusionDiagnostic["operation"],
): string {
  const resolved = path.resolve(projectRoot);
  const normalized = process.platform === "win32" ? resolved.toLowerCase() : resolved;
  return `${normalized}:${operation}`;
}

function normalizeRelativePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function getExitCode(error: unknown): string | number | undefined {
  return (error as GitCommandError | undefined)?.code;
}

function isOutsideRoot(projectRoot: string, absolutePath: string): boolean {
  const relativeToRoot = path.relative(projectRoot, absolutePath);
  return (
    path.isAbsolute(relativeToRoot) ||
    relativeToRoot === ".." ||
    relativeToRoot.startsWith(`..${path.sep}`)
  );
}
