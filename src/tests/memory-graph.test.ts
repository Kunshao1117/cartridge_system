import { mkdtemp, mkdir, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleMemoryGraph } from "../memory-graph.js";

let projectRoot: string | null = null;

async function writeProjectFile(relativePath: string, content: string) {
  if (!projectRoot) throw new Error("projectRoot is not initialized");
  const filePath = path.join(projectRoot, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}

async function createMemoryCard(args: {
  moduleName: string;
  trackedFile: string;
  title: string;
  concepts?: string[];
  dependencies?: string[];
}) {
  const concepts = args.concepts ?? [];
  const dependencies = args.dependencies ?? [];
  await writeProjectFile(
    `.agents/memory/${args.moduleName}/SKILL.md`,
    [
      "---",
      `name: ${args.moduleName}`,
      `title: ${args.title}`,
      `summary: ${args.title} summary`,
      "description: test",
      "last_updated: '2026-05-19T00:00:00+08:00'",
      "staleness: 0",
      concepts.length > 0 ? "concepts:" : "concepts: []",
      ...concepts.map((concept) => `  - ${concept}`),
      dependencies.length > 0 ? "dependencies:" : "dependencies: []",
      ...dependencies.map((dependency) => `  - ${dependency}`),
      "metadata:",
      "  author: test",
      "  version: '1.0'",
      "  origin: test",
      "  memory_awareness: full",
      "  tool_scope: []",
      "---",
      "",
      "## Tracked Files",
      "",
      `- ${args.trackedFile}`,
      "",
      "## Key Decisions",
      "",
      `- D01: ${args.title} owns ${args.trackedFile}.`,
      "",
      "## Module Lessons",
      "",
      `- L01: ${args.title} lesson.`,
    ].join("\n"),
  );
}

async function createFixtureProject() {
  projectRoot = await mkdtemp(path.join(tmpdir(), "cartridge-memory-graph-"));
  await writeProjectFile("src/alpha.ts", 'import { beta } from "./beta";\nexport const alpha = beta;\n');
  await writeProjectFile("src/beta.ts", "export const beta = 1;\n");
  await writeProjectFile("src/gamma.ts", "export const gamma = 1;\n");
  await createMemoryCard({
    moduleName: "alpha",
    trackedFile: "src/alpha.ts",
    title: "Alpha",
    concepts: ["runtime"],
    dependencies: ["beta"],
  });
  await createMemoryCard({
    moduleName: "beta",
    trackedFile: "src/beta.ts",
    title: "Beta",
    concepts: ["runtime"],
  });
  await createMemoryCard({
    moduleName: "gamma",
    trackedFile: "src/gamma.ts",
    title: "Gamma",
    dependencies: ["alpha"],
  });
}

function parseResult(result: Awaited<ReturnType<typeof handleMemoryGraph>>) {
  return JSON.parse(result.content[0].text);
}

describe("handleMemoryGraph — AI 可讀記憶圖譜", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    if (projectRoot) {
      await rm(projectRoot, { recursive: true, force: true });
      projectRoot = null;
    }
  });

  it("all lens 應回傳 overview、cards 與 lines", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await createFixtureProject();

    const result = await handleMemoryGraph({ projectRoot, lens: "all" });
    const graph = parseResult(result);

    expect(result.isError).toBeUndefined();
    expect(graph.status).toBe("ready");
    expect(graph.metadata.tool).toBe("memory_graph");
    expect(graph.summary.overview.totalCards).toBe(3);
    expect(graph.summary.cards.map((card: { id: string }) => card.id)).toEqual(["alpha", "beta", "gamma"]);
    expect(graph.summary.lines.length).toBeGreaterThan(0);
    expect(graph.summary.aiReadingGuide.suggestedNextTools).toContain("memory_read");
  });

  it("memory lens 應只保留記憶視角線條", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await createFixtureProject();

    const result = await handleMemoryGraph({ projectRoot, lens: "memory" });
    const graph = parseResult(result);
    const lineTypes = graph.summary.lines.map((line: { type: string }) => line.type);

    expect(lineTypes.length).toBeGreaterThan(0);
    expect(lineTypes.every((type: string) => ["note", "slot"].includes(type))).toBe(true);
  });

  it("focusModule 應回傳指定卡匣與一跳關聯", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await createFixtureProject();

    const result = await handleMemoryGraph({ projectRoot, focusModule: "alpha" });
    const graph = parseResult(result);

    expect(graph.summary.overview.focusModule).toBe("alpha");
    expect(graph.summary.cards.map((card: { id: string }) => card.id)).toEqual(["alpha", "beta", "gamma"]);
  });

  it("maxCards 應依穩定順序截斷並回傳 warning", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await createFixtureProject();

    const result = await handleMemoryGraph({ projectRoot, maxCards: 2 });
    const graph = parseResult(result);

    expect(graph.status).toBe("warning");
    expect(graph.summary.overview.returnedCards).toBe(2);
    expect(graph.summary.cards.map((card: { id: string }) => card.id)).toEqual(["alpha", "beta"]);
    expect(graph.findings[0].code).toBe("memory_graph_truncated");
  });

  it("focusModule 不存在時應回傳 module_not_found", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await createFixtureProject();

    const result = await handleMemoryGraph({ projectRoot, focusModule: "missing" });
    const graph = parseResult(result);

    expect(result.isError).toBe(true);
    expect(graph.status).toBe("error");
    expect(graph.findings[0].code).toBe("module_not_found");
  });
});
