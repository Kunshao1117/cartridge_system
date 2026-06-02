import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { DesktopProjectSnapshot } from "../monitoring/project-snapshot";
import { buildProjectActionItems } from "../desktop/renderer/status";

const rendererPath = path.join(__dirname, "..", "desktop", "renderer");

async function readAppSource(): Promise<string> {
  return readFile(path.join(rendererPath, "App.tsx"), "utf8");
}

async function readRendererSource(): Promise<string> {
  const files = await readdir(rendererPath);
  const sourceFiles = files.filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"));
  const sources = await Promise.all(
    sourceFiles.map((file) => readFile(path.join(rendererPath, file), "utf8")),
  );
  return sources.join("\n");
}

describe("desktop renderer layout", () => {
  it("keeps a single settings entry point in the application shell", async () => {
    const source = await readAppSource();

    expect(source.match(/setSettingsOpen\(\(open\) => !open\)/g)).toHaveLength(1);
  });

  it("uses native pane scrolling without wheel interception", async () => {
    const source = await readRendererSource();

    expect(source).not.toContain("onWheel=");
    expect(source).not.toContain("handleScrollPaneWheel");
    expect(source).not.toContain("scroll-behavior");
  });

  it("renders settings as an overlay and keeps cartridge list independently scrollable", async () => {
    const source = await readRendererSource();

    expect(source).toContain("className={detail.cartridgeListViewport}");
    expect(source).toContain("className={detail.cartridgeMetricSummary}");
    expect(source).toContain("className={detail.cartridgeNameCell}");
    expect(source).toContain("className={styles.settingsPanel}");
    expect(source).not.toContain('role="table"');
    expect(source).not.toContain("<table");
    expect(source).not.toContain("52px 30px 30px 30px");
    expect(source).not.toContain("cartridgeMetricStrip");
  });

  it("keeps the overview column compact and avoids duplicate summary cards", async () => {
    const source = await readRendererSource();
    const appSource = await readAppSource();

    expect(source).not.toContain("StatusSummary");
    expect(source).not.toContain("className={styles.summaryBar}");
    expect(source).toContain("點選一個問題類型");
    expect(appSource).toContain("buildProjectActionItems(selected)");
    expect(appSource).not.toContain("buildActionItems(projects)");
  });

  it("builds action counts from the selected project instead of global totals", () => {
    const project = makeProject({
      blocking: 1,
      untrackedFiles: 2,
      ghostFiles: 3,
      review: 4,
    });

    const actionItems = buildProjectActionItems(project);

    expect(actionItems.map((item) => item.count)).toEqual([1, 2, 3, 4]);
  });

  it("connects issue entry rows to a right-side guidance drawer", async () => {
    const source = await readRendererSource();

    expect(source).toContain("onSelectIssue={selectIssue}");
    expect(source).toContain("onSelectCartridge={selectCartridge}");
    expect(source).toContain("<IssueDrawer");
    expect(source).toContain("問題處理導引");
  });
});

function makeProject(
  counts: Pick<
    DesktopProjectSnapshot["counts"],
    "blocking" | "untrackedFiles" | "ghostFiles" | "review"
  >,
): DesktopProjectSnapshot {
  return {
    id: "selected",
    name: "Selected",
    root: "D:\\Selected",
    status: "blocked",
    enabled: true,
    lastScanned: "2026-06-03T00:00:00+08:00",
    error: null,
    counts: {
      cartridges: 1,
      info: 0,
      stale: counts.blocking,
      pendingChanges: counts.blocking,
      ...counts,
    },
    cartridges: [],
    untrackedFiles: [],
  };
}
