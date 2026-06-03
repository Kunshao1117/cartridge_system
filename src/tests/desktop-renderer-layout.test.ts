import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { DesktopProjectSnapshot } from "../monitoring/project-snapshot";
import { buildProjectActionItems } from "../desktop/renderer/status";

const rendererPath = path.join(__dirname, "..", "desktop", "renderer");
const desktopPath = path.join(__dirname, "..", "desktop");

async function readAppSource(): Promise<string> {
  return readFile(path.join(rendererPath, "App.tsx"), "utf8");
}

async function readDesktopSource(file: string): Promise<string> {
  return readFile(path.join(desktopPath, file), "utf8");
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

    expect(source.match(/onToggleSettings=\{toggleSettings\}/g)).toHaveLength(1);
    expect(source).toContain("function toggleSettings()");
  });

  it("uses native pane scrolling without wheel interception", async () => {
    const source = await readRendererSource();

    expect(source).not.toContain("onWheel=");
    expect(source).not.toContain("handleScrollPaneWheel");
    expect(source).not.toContain("scroll-behavior");
    expect(source).not.toContain('overscrollBehavior: "contain"');
    expect(source).toContain('overscrollBehavior: "auto"');
  });

  it("keeps all expected scroll roots on native overflow containers", async () => {
    const source = await readRendererSource();

    expect(source).toContain("className={styles.projectList}");
    expect(source).toContain("className={styles.centerScroll}");
    expect(source).toContain("className={styles.detailScroll}");
    expect(source).toContain("className={detail.cartridgeListViewport}");
    expect(source).toContain("className={detail.untrackedList}");
    expect(source).toContain("className={detail.drawerContent}");
    expect(source).toContain("className={styles.settingsGrid}");
    expect(source.match(/overflowY: "auto"/g)?.length ?? 0).toBeGreaterThanOrEqual(
      5,
    );
    expect(
      source.match(/scrollbarGutter: "stable"/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(4);
  });

  it("renders settings as an overlay and keeps cartridge list independently scrollable", async () => {
    const source = await readRendererSource();

    expect(source).toContain("className={detail.cartridgeListViewport}");
    expect(source).toContain("className={cx(detail.tablePanel, detail.untrackedPanel)}");
    expect(source).toContain("className={detail.cartridgeMetricSummary}");
    expect(source).toContain("className={detail.cartridgeNameCell}");
    expect(source).toContain("className={styles.settingsPanel}");
    expect(source).toContain('maxHeight: "260px"');
    expect(source).not.toContain('role="table"');
    expect(source).not.toContain("<table");
    expect(source).not.toContain("52px 30px 30px 30px");
    expect(source).not.toContain("cartridgeMetricStrip");
  });

  it("keeps untracked files reachable instead of truncating the list", async () => {
    const source = await readRendererSource();

    expect(source).toContain("props.project.untrackedFiles.map");
    expect(source).not.toContain("props.project.untrackedFiles.slice");
  });

  it("renders a bottom operation status bar with accessible live feedback", async () => {
    const appSource = await readAppSource();
    const source = await readRendererSource();

    expect(appSource).toContain("<OperationStatusBar");
    expect(appSource).toContain("runProjectOperation");
    expect(appSource).toContain("runDesktopOperation");
    expect(source).toContain('role="status"');
    expect(source).toContain("aria-live={assertive ? \"assertive\" : \"polite\"}");
  });

  it("routes toolbar, drawer, settings, and selection actions through visible feedback", async () => {
    const appSource = await readAppSource();
    const source = await readRendererSource();

    expect(appSource).toContain("正在加入監控專案");
    expect(appSource).toContain("正在重新掃描全部專案");
    expect(appSource).toContain("正在更新設定");
    expect(appSource).toContain("正在複製提示");
    expect(appSource).toContain("已選取專案");
    expect(appSource).toContain("已切換處理類型");
    expect(appSource).toContain("已選取記憶卡匣");
    expect(appSource).toContain("已選取未歸屬檔案");
    expect(appSource).toContain("已開啟設定");
    expect(appSource).toContain("已關閉設定");
    expect(appSource).toContain("已關閉處理導引");
    expect(source).toContain("正在掃描專案");
    expect(source).toContain("正在開啟專案資料夾");
    expect(source).toContain("正在暫停監控");
    expect(source).toContain("正在恢復監控");
    expect(source).toContain("正在移除監控專案");
    expect(source).toContain("正在開啟記憶卡");
    expect(source).toContain("正在開啟未歸屬檔案");
    expect(source).toContain("已取消移除監控專案");
  });

  it("requires confirmation before removing a monitored project", async () => {
    const source = await readRendererSource();

    expect(source).toContain("<RemoveProjectDialog");
    expect(source).toContain("<Dialog");
    expect(source).toContain("移除監控專案？");
    expect(source).toContain("專案檔案不會被刪除");
  });

  it("keeps desktop operation IPC calls on a typed result envelope", async () => {
    const ipcSource = await readDesktopSource("ipc-channels.ts");
    const mainSource = await readDesktopSource("main.ts");

    expect(ipcSource).toContain("DesktopOperationResult");
    expect(ipcSource).toContain('"success"');
    expect(ipcSource).toContain('"cancelled"');
    expect(ipcSource).toContain('"blocked"');
    expect(ipcSource).toContain('"error"');
    expect(mainSource).toContain("shell.openPath");
    expect(mainSource).toContain("if (error) return operation");
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
      advisory: 0,
      stale: counts.blocking,
      pendingChanges: counts.blocking,
      ...counts,
    },
    cartridges: [],
    untrackedFiles: [],
  };
}
