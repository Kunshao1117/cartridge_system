import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { auditContextInventory } from "../context-audit.js";
import { scanContextRegistry } from "../context-registry.js";
import { handleContextAudit, handleContextDiff } from "../context-tools.js";

let tempDirs: string[] = [];

async function makeProject() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cartridge-context-"));
  tempDirs.push(root);
  await fs.mkdir(path.join(root, ".agents", "memory", "mcp-tools"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ name: "demo" }),
  );
  return root;
}

afterEach(async () => {
  for (const dir of tempDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe("context governance — v5 上下文治理", () => {
  it("context registry 應掃描多代理指令與記憶卡 contract", async () => {
    const root = await makeProject();
    await fs.writeFile(
      path.join(root, "AGENTS.md"),
      "All responses MUST be in Traditional Chinese. Wait for GO before commit.",
    );
    await fs.writeFile(
      path.join(root, "CLAUDE.md"),
      "Use Traditional Chinese for this project.",
    );
    await fs.writeFile(
      path.join(root, ".agents", "memory", "mcp-tools", "SKILL.md"),
      [
        "---",
        "name: mcp-tools",
        "staleness: 0",
        "dependencies:",
        "  - core-types",
        "---",
        "# MCP Tools",
        "## Tracked Files",
        "- src/mcp-server.ts",
      ].join("\n"),
    );

    const inventory = await scanContextRegistry(root);
    const ids = inventory.assets.map((asset) => asset.id);

    expect(ids).toContain("codex.agents");
    expect(ids).toContain("claude.project");
    expect(ids).toContain("agents.memory.mcp-tools");
    expect(inventory.totals.byOwner.codex).toBe(1);
    expect(inventory.totals.byType.memory).toBe(1);
    expect(
      inventory.assets.find((asset) => asset.id === "agents.memory.mcp-tools")
        ?.trackedFiles,
    ).toEqual(["src/mcp-server.ts"]);
  });

  it("context audit 應將提交授權衝突列為 blocking", async () => {
    const root = await makeProject();
    await fs.writeFile(path.join(root, "AGENTS.md"), "Commit only after GO.");
    await fs.writeFile(path.join(root, "CLAUDE.md"), "Please auto-commit changes.");

    const result = await handleContextAudit({ projectRoot: root });
    const envelope = JSON.parse(result.content[0].text);

    expect(envelope.status).toBe("blocked");
    expect(envelope.findings[0].code).toBe("context_commit_policy_conflict");
    expect(envelope.findings[0].message).toContain("提交規則互相衝突");
    expect(envelope.findings[0].file).toBe("AGENTS.md");
    expect(envelope.summary.findings[0].recommendedTool).toBe("context_diff");
    expect(envelope.recommendedActions[0]).toEqual(
      expect.objectContaining({
        nextTool: "context_diff",
        blocking: true,
      }),
    );
  });

  it("context diff 應比較兩個 context asset 的治理訊號", async () => {
    const root = await makeProject();
    await fs.writeFile(path.join(root, "AGENTS.md"), "Traditional Chinese. GO.");
    await fs.writeFile(path.join(root, "CLAUDE.md"), "Traditional Chinese.");

    const result = await handleContextDiff({
      projectRoot: root,
      leftId: "codex.agents",
      rightId: "claude.project",
    });
    const envelope = JSON.parse(result.content[0].text);

    expect(result.isError).toBeUndefined();
    expect(envelope.summary.sharedSignals).toContain("language:zh-TW");
    expect(envelope.summary.leftOnlySignals).toContain(
      "commit:requires-explicit-approval",
    );
  });

  it("auditContextInventory 應只把語言差異列為 warning", async () => {
    const root = await makeProject();
    await fs.writeFile(path.join(root, "AGENTS.md"), "繁體中文");
    await fs.writeFile(path.join(root, "CLAUDE.md"), "English only");
    const inventory = await scanContextRegistry(root);

    const findings = auditContextInventory(inventory);

    expect(findings.some((item) => item.code === "context_language_conflict"))
      .toBe(true);
    expect(
      findings.find((item) => item.code === "context_language_conflict")
        ?.explanation,
    ).toContain("回覆風格不一致");
    expect(findings.some((item) => item.severity === "error")).toBe(false);
  });
});
