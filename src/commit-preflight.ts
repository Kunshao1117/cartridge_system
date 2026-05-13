import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import * as z from "zod";
import { validateProjectRoot } from "./path-guard.js";
import { type McpToolResult } from "./mcp-handlers.js";
import {
  buildCommitPreflight,
  parseGitStatusPorcelain,
  type PreflightIndex,
} from "./commit-preflight-summary.js";

const projectRootField = z
  .string()
  .min(1)
  .refine((p) => path.isAbsolute(p) && !p.includes(".."), {
    message: "必須為絕對路徑且不含路徑穿越符號",
  });

export const commitPreflightSchema = z.object({
  projectRoot: projectRootField,
});

async function readCartridgeIndex(projectRoot: string): Promise<PreflightIndex> {
  const raw = await fs.readFile(
    path.join(projectRoot, ".cartridge", "index.json"),
    "utf-8",
  );
  return JSON.parse(raw) as PreflightIndex;
}

async function readGitStatus(projectRoot: string) {
  const stdout = await new Promise<string>((resolve, reject) => {
    execFile(
      "git",
      ["status", "--porcelain=v1"],
      { cwd: projectRoot, windowsHide: true },
      (error, stdoutValue, stderrValue) => {
        if (error) {
          reject(
            new Error(
              `git status failed: ${stderrValue || error.message || "unknown error"}`,
            ),
          );
          return;
        }
        resolve(stdoutValue);
      },
    );
  });
  return parseGitStatusPorcelain(stdout);
}

export async function handleCommitPreflight(
  args: unknown,
): Promise<McpToolResult> {
  const parsed = commitPreflightSchema.safeParse(args);
  if (!parsed.success) {
    return {
      content: [
        {
          type: "text",
          text: "Validation Error: projectRoot is required (must be absolute path without ..)",
        },
      ],
      isError: true,
    };
  }

  try {
    const projectRoot = validateProjectRoot(parsed.data.projectRoot);
    const [index, gitStatus] = await Promise.all([
      readCartridgeIndex(projectRoot),
      readGitStatus(projectRoot),
    ]);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(buildCommitPreflight(index, gitStatus), null, 2),
        },
      ],
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      content: [{ type: "text", text: `Error: ${msg}` }],
      isError: true,
    };
  }
}
