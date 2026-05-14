import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import { handleCommitPreflight } from "../commit-preflight.js";

vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
}));

vi.mock("child_process", () => ({
  execFile: vi.fn(),
}));

import * as fs from "fs/promises";
import * as childProcess from "child_process";

const PROJECT_ROOT = "/mock/other-project";

beforeEach(() => {
  vi.clearAllMocks();
});

function mockGitStatus(output: string) {
  (childProcess.execFile as unknown as Mock).mockImplementation(
    (_cmd, _args, _options, callback) => callback(null, output, ""),
  );
}

// ---------------------------------------------------------------------------
// handleCommitPreflight — 提交前治理檢查
// ---------------------------------------------------------------------------
describe("handleCommitPreflight", () => {
  it("健康記憶與乾淨 git 工作樹應回傳 ready", async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        cartridges: {
          "mcp-tools": {
            staleness: 0,
            ghostFiles: [],
            indirectStaleness: 0,
          },
        },
        untrackedFiles: [],
      }) as unknown as Awaited<ReturnType<typeof fs.readFile>>,
    );
    mockGitStatus("");

    const result = await handleCommitPreflight({ projectRoot: PROJECT_ROOT });
    const envelope = JSON.parse(result.content[0].text);
    const preflight = envelope.summary;

    expect(result.isError).toBeUndefined();
    expect(envelope.status).toBe("ready");
    expect(envelope.metadata.tool).toBe("commit_preflight");
    expect(envelope.metadata.readOnly).toBe(true);
    expect(preflight.status).toBe("ready");
    expect(preflight.summary.readiness.status).toBe("ready");
    expect(preflight.summary.readiness.blockingReasons).toEqual([]);
    expect(preflight.blockers).toEqual([]);
    expect(preflight.summary.git.dirty).toBe(false);
    expect(preflight.summary.dependencySemantics.warnings).toBe(0);
  });

  it("記憶卡健康問題與 git dirty state 應回傳 blocked", async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        cartridges: {
          _system: {
            staleness: 10,
            ghostFiles: [],
            indirectStaleness: 0,
          },
          "mcp-tools": {
            staleness: 0,
            ghostFiles: ["src/old.ts"],
            indirectStaleness: 5,
          },
        },
        untrackedFiles: [{ filePath: "src/new.ts" }],
      }) as unknown as Awaited<ReturnType<typeof fs.readFile>>,
    );
    mockGitStatus(" M src/mcp-server.ts\n?? src/new.ts\n");

    const result = await handleCommitPreflight({ projectRoot: PROJECT_ROOT });
    const envelope = JSON.parse(result.content[0].text);
    const preflight = envelope.summary;

    expect(envelope.status).toBe("blocked");
    expect(envelope.findings.some((f: { code: string }) => f.code === "git_dirty")).toBe(
      true,
    );
    expect(preflight.status).toBe("blocked");
    expect(preflight.summary.memory.stale).toBe(1);
    expect(preflight.summary.memory.ghostFiles).toBe(1);
    expect(preflight.summary.memory.untrackedFiles).toBe(1);
    expect(preflight.summary.memory.indirectStale).toBe(1);
    expect(preflight.summary.git.dirty).toBe(true);
    expect(preflight.summary.git.modified).toBe(1);
    expect(preflight.summary.git.untracked).toBe(1);
    expect(preflight.summary.readiness.status).toBe("blocked");
    expect(preflight.summary.readiness.blockingReasons).toContain(
      "workspace: dirtyFiles=2",
    );
    expect(preflight.summary.dependencySemantics.warnings).toBe(0);
    expect(
      preflight.blockers.some(
        (blocker: { type: string }) => blocker.type === "git_dirty",
      ),
    ).toBe(true);
  });

  it("未傳入 projectRoot 時應回傳 Validation Error", async () => {
    const result = await handleCommitPreflight({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation Error");
  });

  it("路徑穿越（..）應回傳 Validation Error", async () => {
    const result = await handleCommitPreflight({
      projectRoot: "/foo/../../etc",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation Error");
  });

  it("git status 失敗時應回傳錯誤", async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({ cartridges: {}, untrackedFiles: [] }) as unknown as Awaited<
        ReturnType<typeof fs.readFile>
      >,
    );
    (childProcess.execFile as unknown as Mock).mockImplementation(
      (_cmd, _args, _options, callback) =>
        callback(new Error("not a git repo"), "", "fatal"),
    );

    const result = await handleCommitPreflight({ projectRoot: PROJECT_ROOT });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("git status failed");
  });

  it("dirty 記憶卡的 dependencies 語義 warning 應彙整為非阻擋 finding", async () => {
    const indexData = {
      cartridges: {
        "mcp-tools.dispatcher": {
          skillPath: ".agents/memory/mcp-tools/dispatcher/SKILL.md",
          staleness: 0,
          ghostFiles: [],
          indirectStaleness: 0,
          parent: "mcp-tools",
          dependencies: ["mcp-tools"],
        },
      },
      fileMap: {},
      untrackedFiles: [],
    };
    const skillData = `---
name: mcp-tools.dispatcher
description: test
dependencies:
  - mcp-tools
---

## Tracked Files

- src/tool-dispatcher.ts

## Key Decisions

- D01: Dispatcher routes tools.

## Relations

- mcp-tools（父卡）
`;

    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      const fp = filePath as string;
      if (fp.includes("index.json")) {
        return JSON.stringify(indexData) as unknown as Awaited<
          ReturnType<typeof fs.readFile>
        >;
      }
      if (fp.includes("dispatcher") && fp.endsWith("SKILL.md")) {
        return skillData as unknown as Awaited<ReturnType<typeof fs.readFile>>;
      }
      throw new Error("unexpected path");
    });
    mockGitStatus(" M .agents/memory/mcp-tools/dispatcher/SKILL.md\n");

    const result = await handleCommitPreflight({ projectRoot: PROJECT_ROOT });
    const envelope = JSON.parse(result.content[0].text);
    const preflight = envelope.summary;

    expect(envelope.status).toBe("blocked");
    expect(preflight.summary.dependencySemantics.warnings).toBeGreaterThan(0);
    expect(preflight.summary.readiness.warningReasons.length).toBeGreaterThan(0);
    expect(preflight.summary.dependencySemantics.modules[0].module).toBe(
      "mcp-tools.dispatcher",
    );
    expect(
      envelope.findings.some(
        (finding: { code: string; severity: string }) =>
          finding.code === "dependency_semantics_warning" &&
          finding.severity === "warning",
      ),
    ).toBe(true);
  });
});
