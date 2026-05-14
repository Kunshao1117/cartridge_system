import { mkdtemp, mkdir, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleMemoryDeps } from "../mcp-handlers.js";

let projectRoot: string | null = null;

async function writeProjectFile(relativePath: string, content: string) {
  if (!projectRoot) throw new Error("projectRoot is not initialized");
  const filePath = path.join(projectRoot, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}

async function createMemoryCard(
  moduleName: string,
  body: string,
  dependencies: string[] = [],
) {
  const dependencyYaml =
    dependencies.length > 0
      ? `dependencies:\n${dependencies.map((dep) => `  - ${dep}`).join("\n")}\n`
      : "dependencies: []\n";
  await writeProjectFile(
    `.agents/memory/${moduleName}/SKILL.md`,
    `---\nname: ${moduleName}\ndescription: test\nlast_updated: '2026-05-14T00:00:00+08:00'\nstaleness: 0\n${dependencyYaml}metadata:\n  author: test\n  version: '1.0'\n  origin: test\n  memory_awareness: full\n  tool_scope: []\n---\n\n${body}`,
  );
}

describe("handleMemoryDeps — 分層依賴輸出", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    if (projectRoot) {
      await rm(projectRoot, { recursive: true, force: true });
      projectRoot = null;
    }
  });

  it("應回傳工程依賴、frontmatter 依賴與 legacy 欄位", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    projectRoot = await mkdtemp(path.join(tmpdir(), "cartridge-deps-"));
    await writeProjectFile(
      "src/a.ts",
      `import { b } from "./b";\nexport const a = b;\n`,
    );
    await writeProjectFile("src/b.ts", "export const b = 1;\n");
    await createMemoryCard(
      "module-a",
      "## Tracked Files\n\n- src/a.ts\n\n## Key Decisions\n\n- D01: module-a imports module-b.\n",
      ["manual-upstream"],
    );
    await createMemoryCard(
      "module-b",
      "## Tracked Files\n\n- src/b.ts\n\n## Key Decisions\n\n- D01: module-b owns b.\n",
    );
    await createMemoryCard(
      "manual-upstream",
      "## Tracked Files\n\n- docs/manual.md\n\n## Key Decisions\n\n- D01: manual upstream.\n",
    );
    await writeProjectFile("docs/manual.md", "manual");

    const result = await handleMemoryDeps({
      moduleName: "module-a",
      projectRoot,
    });
    const deps = JSON.parse(result.content[0].text);

    expect(result.isError).toBeUndefined();
    expect(deps.status).toBe("ready");
    expect(deps.metadata.tool).toBe("memory_deps");
    expect(deps.summary.module).toBe("module-a");
    expect(deps.summary.graph.engineering.dependencyCount).toBe(1);
    expect(deps.summary.graph.frontmatter.dependencyCount).toBe(1);
    expect(deps.summary.graph.engineering.dependencies).toEqual(["module-b"]);
    expect(deps.summary.graph.frontmatter.dependencies).toEqual([
      "manual-upstream",
    ]);
    expect(deps.summary.staleness.indirect).toBe(0);
    expect(deps.legacy.dependencies).toEqual(["module-b"]);
    expect(deps.legacy.indirectStaleness).toBe(0);
  });
});
