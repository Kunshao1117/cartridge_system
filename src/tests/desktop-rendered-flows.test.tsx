import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { ProjectDetail } from "../desktop/renderer/project-detail.js";
import { IssueDrawer } from "../desktop/renderer/issue-drawer.js";
import { buildDesktopProjectSnapshot } from "../monitoring/project-snapshot.js";
import { DEFAULT_DESKTOP_SETTINGS } from "../desktop/project-store.js";
import { surfaceEntry, surfaceIndex } from "./surface-regression-fixtures.js";
vi.mock("../desktop/renderer/desktop-api.js", () => ({ desktopApi: {} }));
const noop = () => {};
function renderDetail(project: Parameters<typeof ProjectDetail>[0]["project"], settingsOpen: boolean) {
  return renderToStaticMarkup(createElement(FluentProvider, { theme: webLightTheme }, createElement(ProjectDetail, {
    project, settingsOpen, settings: DEFAULT_DESKTOP_SETTINGS, issueSelection: null,
    onSettingsOpenChange: noop, onSettingsChange: noop, onProjectOperation: noop, onOperation: noop,
    onLocalFeedback: noop, onCopyText: noop, onSelectCartridge: noop, onSelectUntracked: noop, onCloseIssue: noop,
  })));
}
describe("rendered Desktop business states", () => {
  it("renders global settings before adding a project and after removing the last project", () => {
    const project = buildDesktopProjectSnapshot({ projectRoot: "/demo", enabled: true, index: surfaceIndex() });
    expect(renderDetail(undefined, true)).toContain("顯示桌面通知");
    expect(renderDetail(project, true)).toContain("顯示桌面通知");
    expect(renderDetail(undefined, true)).toContain("按 X 縮到系統匣");
    expect(renderDetail(undefined, false)).not.toContain("顯示桌面通知");
  });
  it("renders scan errors, previous scan time and sync diagnostics even without notifications", () => {
    const project = buildDesktopProjectSnapshot({ projectRoot: "/demo", enabled: true, index: surfaceIndex(), error: "EACCES index", syncWarning: "dependency unavailable" });
    const html = renderDetail(project, false);
    expect(html).toContain("EACCES index"); expect(html).toContain("dependency unavailable");
    expect(html).toContain("2026-01-01"); expect(html).toContain("上次成功");
  });
  it("does not nest interactive buttons in cartridge and untracked rows", () => {
    const index = surfaceIndex(); index.untrackedFiles = [{ filePath: "new.ts", suggestedOwner: null, detectedAt: "now", lastEvent: "add" }];
    const html = renderDetail(buildDesktopProjectSnapshot({ projectRoot: "/demo", enabled: true, index }), false);
    const tags = html.match(/<\/?button\b[^>]*>/g) ?? []; let depth = 0;
    for (const tag of tags) { depth += tag.startsWith("</") ? -1 : 1; expect(depth).toBeLessThanOrEqual(1); }
    expect(depth).toBe(0);
  });
  it("renders ghost restore guidance and never tells the user to unconditionally delete tracking", () => {
    const project = buildDesktopProjectSnapshot({ projectRoot: "/demo", enabled: true, index: surfaceIndex({ core: surfaceEntry({ ghostFiles: ["temporarily-unavailable.ts"] }) }) });
    const html = renderToStaticMarkup(createElement(FluentProvider, { theme: webLightTheme }, createElement(IssueDrawer, {
      project, selection: { kind: "ghost", cartridgeId: "core", filePath: null }, onClose: noop, onOperation: noop, onCopyText: noop,
    })));
    expect(html).toContain("恢復"); expect(html).toContain("經授權");
    expect(html).not.toContain("檔案已不存在，請從記憶卡 Tracked Files 移除");
  });
});
