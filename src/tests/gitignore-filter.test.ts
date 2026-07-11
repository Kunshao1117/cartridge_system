import { execFile as execFileCallback } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GitignoreFilter } from "../gitignore-filter.js";

const execFile = promisify(execFileCallback);
const tempRoots: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    tempRoots.map((root) => fs.rm(root, { recursive: true, force: true })),
  );
  tempRoots.length = 0;
});

describe("GitignoreFilter Git standard exclusions", () => {
  it("honors root, nested, info and global excludes with negation", async () => {
    const root = await createGitRepo();
    const globalExclude = path.join(root, "global-excludes");
    await write(root, ".gitignore", "root.tmp\nnested/*.tmp\n!nested/keep.tmp\n");
    await write(root, "root.tmp", "ignored");
    await write(root, "nested/drop.tmp", "ignored");
    await write(root, "nested/keep.tmp", "kept");
    await write(root, "info.tmp", "ignored");
    await write(root, "global.tmp", "ignored");
    await write(root, "src/visible.ts", "export {};\n");
    await fs.writeFile(path.join(root, ".git", "info", "exclude"), "info.tmp\n");
    await fs.writeFile(globalExclude, "global.tmp\n");
    await git(root, "config", "core.excludesFile", globalExclude);

    const result = await new GitignoreFilter(root).discoverProjectFiles();

    expect(result.mode).toBe("git-standard");
    expect(result.diagnostics).toEqual([]);
    expect(result.files).toContain("nested/keep.tmp");
    expect(result.files).toContain("src/visible.ts");
    expect(result.files).not.toContain("root.tmp");
    expect(result.files).not.toContain("nested/drop.tmp");
    expect(result.files).not.toContain("info.tmp");
    expect(result.files).not.toContain("global.tmp");
  });

  it("keeps force-added tracked files even when an ignore pattern matches", async () => {
    const root = await createGitRepo();
    await write(root, ".gitignore", "tracked.log\n");
    await write(root, "tracked.log", "tracked");
    await git(root, "add", "-f", "--", "tracked.log");

    const filter = new GitignoreFilter(root);
    const discovery = await filter.discoverProjectFiles();
    const decision = await filter.checkIgnored("tracked.log");

    expect(discovery.files).toContain("tracked.log");
    expect(decision).toEqual({
      ignored: false,
      mode: "git-standard",
      diagnostics: [],
    });
  });

  it("treats check-ignore exit 1 as a normal not-ignored decision", async () => {
    const root = await createGitRepo();
    await write(root, "plain.txt", "plain");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await new GitignoreFilter(root).checkIgnored("plain.txt");

    expect(result.mode).toBe("git-standard");
    expect(result.ignored).toBe(false);
    expect(result.diagnostics).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("filters missing index entries and preserves spaces and Unicode names", async () => {
    const root = await createGitRepo();
    await write(root, "deleted.txt", "delete me");
    await write(root, "space name.txt", "space");
    await write(root, "繁體中文.txt", "unicode");
    await write(root, "..env", "dot-dot prefix");
    await write(root, "..config/settings.json", "{}");
    await git(root, "add", "--", "deleted.txt");
    await fs.rm(path.join(root, "deleted.txt"));

    const result = await new GitignoreFilter(root).discoverProjectFiles();

    expect(result.files).toContain("space name.txt");
    expect(result.files).toContain("繁體中文.txt");
    expect(result.files).toContain("..env");
    expect(result.files).toContain("..config/settings.json");
    expect(result.files).not.toContain("deleted.txt");
  });

  it("treats pathspec metacharacters as literal file names", async () => {
    const root = await createGitRepo();
    await write(root, ".gitignore", "a.tmp\n");
    await write(root, "a.tmp", "ignored");
    await write(root, "[ab].tmp", "literal");
    await write(root, "-dash.txt", "leading dash");
    const filter = new GitignoreFilter(root);

    const ignored = await filter.checkIgnored("a.tmp");
    const literal = await filter.checkIgnored("[ab].tmp");
    const colon = await filter.checkIgnored(":(literal)colon.txt");
    const leadingDash = await filter.checkIgnored("-dash.txt");

    expect(ignored.ignored).toBe(true);
    expect(literal.ignored).toBe(false);
    expect(colon).toEqual({
      ignored: false,
      mode: "git-standard",
      diagnostics: [],
    });
    expect(leadingDash).toEqual({
      ignored: false,
      mode: "git-standard",
      diagnostics: [],
    });
  });

  it("scrubs inherited Git pathspec environment overrides", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-env-"));
    tempRoots.push(root);
    await write(root, "visible.txt", "visible");
    const script = path.join(root, "env-git.cjs");
    await fs.writeFile(
      script,
      [
        "const keys = ['GIT_LITERAL_PATHSPECS', 'GIT_NOGLOB_PATHSPECS', 'GIT_GLOB_PATHSPECS', 'GIT_ICASE_PATHSPECS'];",
        "if (keys.some((key) => process.env[key] !== undefined)) process.exit(2);",
        "process.stdout.write('visible.txt\\0');",
      ].join("\n"),
    );
    const keys = [
      "GIT_LITERAL_PATHSPECS",
      "GIT_NOGLOB_PATHSPECS",
      "GIT_GLOB_PATHSPECS",
      "GIT_ICASE_PATHSPECS",
    ] as const;
    const previous = new Map(keys.map((key) => [key, process.env[key]]));
    try {
      for (const key of keys) process.env[key] = "1";
      const result = await new GitignoreFilter(root, {
        gitExecutable: process.execPath,
        gitArgsPrefix: [script],
      }).discoverProjectFiles();

      expect(result.mode).toBe("git-standard");
      expect(result.files).toEqual(["visible.txt"]);
      expect(result.diagnostics).toEqual([]);
    } finally {
      for (const key of keys) {
        const value = previous.get(key);
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it.skipIf(process.platform === "win32")(
    "parses NUL-delimited Git output without truncating newline file names",
    async () => {
      const root = await createGitRepo();
      await write(root, "line\nbreak.txt", "newline");

      const result = await new GitignoreFilter(root).discoverProjectFiles();

      expect(result.files).toContain("line\nbreak.txt");
    },
  );

  it("warns once across instances per project and operation", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-nongit-"));
    tempRoots.push(root);
    await write(root, ".gitignore", "ignored.txt\n");
    await write(root, "ignored.txt", "ignored");
    await write(root, "visible.txt", "visible");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const options = {
      gitExecutable: path.join(root, "missing-git-executable"),
    };
    const firstFilter = new GitignoreFilter(root, options);
    const secondFilter = new GitignoreFilter(root, options);

    const first = await firstFilter.discoverProjectFiles();
    const second = await secondFilter.discoverProjectFiles();

    expect(first.mode).toBe("root-gitignore-fallback");
    expect(first.diagnostics[0]?.code).toBe("git_unavailable");
    expect(first.files).toContain("visible.txt");
    expect(first.files).not.toContain("ignored.txt");
    expect(second.mode).toBe("root-gitignore-fallback");
    expect(warn).toHaveBeenCalledTimes(1);

    await secondFilter.checkIgnored("ignored.txt");
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("classifies non-repository Git failures", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-nongit-"));
    tempRoots.push(root);
    await write(root, "visible.txt", "visible");

    const result = await new GitignoreFilter(root).discoverProjectFiles();

    expect(result.mode).toBe("root-gitignore-fallback");
    expect(result.diagnostics[0]?.code).toBe("git_not_repository");
    expect(result.files).toContain("visible.txt");
  });

  it("falls back after a Git timeout", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-timeout-"));
    tempRoots.push(root);
    const script = path.join(root, "slow-git.cjs");
    await fs.writeFile(script, "setTimeout(() => {}, 60_000);\n");
    const filter = new GitignoreFilter(root, {
      gitExecutable: process.execPath,
      gitArgsPrefix: [script],
      timeoutMs: 10,
    });

    const result = await filter.discoverProjectFiles();

    expect(result.mode).toBe("root-gitignore-fallback");
    expect(result.diagnostics[0]?.code).toBe("git_command_failed");
  });

  it("falls back when Git exits above one", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-exit-"));
    tempRoots.push(root);
    const script = path.join(root, "failed-git.cjs");
    await fs.writeFile(script, "console.error('forced failure'); process.exit(2);\n");
    const filter = new GitignoreFilter(root, {
      gitExecutable: process.execPath,
      gitArgsPrefix: [script],
    });

    const result = await filter.discoverProjectFiles();

    expect(result.mode).toBe("root-gitignore-fallback");
    expect(result.diagnostics[0]?.code).toBe("git_command_failed");
  });

  it("uses root ignore fallback for check-ignore failures", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-check-"));
    tempRoots.push(root);
    await write(root, ".gitignore", "ignored.txt\n");
    const filter = new GitignoreFilter(root, {
      gitExecutable: path.join(root, "missing-git-executable"),
    });

    const result = await filter.checkIgnored("ignored.txt");

    expect(result.ignored).toBe(true);
    expect(result.mode).toBe("root-gitignore-fallback");
    expect(result.diagnostics[0]?.operation).toBe("check-ignore");
  });
});

async function createGitRepo(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-git-"));
  tempRoots.push(root);
  await git(root, "init", "--quiet");
  return root;
}

async function write(root: string, relativePath: string, content: string) {
  const target = path.join(root, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
}

async function git(root: string, ...args: string[]) {
  await execFile("git", ["-C", root, ...args], { windowsHide: true });
}
