import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopProjectStore } from "../desktop/project-store.js";
import { buildDesktopProjectSnapshot, createProjectId } from "../monitoring/project-snapshot.js";
import { canonicalProjectRoot } from "../monitoring/project-identity.js";
import { projectTrayLabel, scanOperationResult } from "../desktop/project-status.js";
import { cartridgesForIssue, getCartridgeStatus, pickIssueForCartridge, buildProjectActionItems } from "../desktop/renderer/status.js";
import { LatestRequest } from "../desktop/renderer/latest-request.js";
import { surfaceEntry, surfaceIndex, deferred } from "./surface-regression-fixtures.js";

const roots: string[] = [];
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true }))); });
async function storeRoot() { const root = await fs.mkdtemp(path.join(os.tmpdir(), "surface-store-")); roots.push(root); return root; }
function snapshot(patch: Parameters<typeof buildDesktopProjectSnapshot>[0] = { projectRoot: "/demo", enabled: true, index: surfaceIndex() }) {
  return buildDesktopProjectSnapshot(patch);
}

describe("Desktop persistence business flows", () => {
  it("retains concurrent settings and project changes across store objects", async () => {
    const root = await storeRoot();
    const a = new DesktopProjectStore(root), b = new DesktopProjectStore(root);
    await Promise.all([
      a.writeSettings({ minimizeToTray: false }), b.writeSettings({ notificationsEnabled: false }),
      a.write([{ root: path.join(root, "project"), enabled: true }]),
    ]);
    expect(await b.readState()).toEqual({
      settings: { minimizeToTray: false, notificationsEnabled: false, showIntro: true },
      projects: [{ root: path.join(root, "project"), enabled: true }],
    });
    expect(await fs.readdir(root)).toEqual(["desktop-projects.json"]);
  });
  it("reads the latest state only after a blocked predecessor has replaced the file", async () => {
    const root = await storeRoot(); const a = new DesktopProjectStore(root), b = new DesktopProjectStore(root);
    const blocked = deferred<void>(), started = deferred<void>();
    const writeFile = fs.writeFile.bind(fs);
    vi.spyOn(fs, "writeFile").mockImplementationOnce(async (...args) => {
      started.resolve(); await blocked.promise; return writeFile(...args);
    });
    const first = a.writeSettings({ minimizeToTray: false }); await started.promise;
    const read = vi.spyOn(b, "readState");
    const second = b.writeSettings({ notificationsEnabled: false });
    expect(read).not.toHaveBeenCalled(); blocked.resolve(); await Promise.all([first, second]);
    expect(await b.readSettings()).toMatchObject({ minimizeToTray: false, notificationsEnabled: false });
  });
  it("keeps the last valid file when replacement fails and allows a later retry", async () => {
    const root = await storeRoot(); const store = new DesktopProjectStore(root);
    await store.writeSettings({ showIntro: false });
    vi.spyOn(fs, "rename").mockRejectedValueOnce(new Error("disk unavailable"));
    await expect(store.writeSettings({ minimizeToTray: false })).rejects.toThrow("disk unavailable");
    expect((await store.readSettings()).showIntro).toBe(false);
    expect((await store.readSettings()).minimizeToTray).toBe(true);
    await store.writeSettings({ notificationsEnabled: false });
    expect((await store.readSettings()).notificationsEnabled).toBe(false);
  });
  it.runIf(process.platform !== "win32")("keeps distinct case-sensitive roots through restart and selection IDs", async () => {
    const root = await storeRoot(); const a = path.join(root, "Alpha"), b = path.join(root, "alpha");
    await new DesktopProjectStore(root).write([{ root: a, enabled: true }, { root: b, enabled: false }]);
    expect(await new DesktopProjectStore(root).read()).toHaveLength(2);
    expect(createProjectId(a)).not.toBe(createProjectId(b));
  });
  it("uses the same Windows identity for case variants while preserving POSIX case", () => {
    expect(canonicalProjectRoot("C:\\Alpha", "win32")).toBe(canonicalProjectRoot("c:\\alpha", "win32"));
    expect(canonicalProjectRoot("/Alpha", "linux")).not.toBe(canonicalProjectRoot("/alpha", "linux"));
  });
});

describe("Desktop status and drilldown", () => {
  it.each([
    [[], "尚未加入專案"], [["ready"], "全部健康"], [["error"], "錯誤 1"],
    [["paused"], "全部暫停"], [["ready", "paused"], "暫停 1"],
    [["blocked", "warning"], "阻塞 1"], [["error", "blocked"], "錯誤 1"], [["warning"], "警告 1"],
  ])("projects all status combinations truthfully: %j", (statuses, expected) => {
    expect(projectTrayLabel((statuses as string[]).map(status => ({ ...snapshot(), status })) as ReturnType<typeof snapshot>[])).toBe(expected);
  });
  it("returns an error and stale-state warning after a failed scan; partial sync is not success", () => {
    const failed = snapshot({ projectRoot: "/demo", enabled: true, index: surfaceIndex(), error: "EACCES memory index" });
    expect(scanOperationResult([failed], "/demo")).toMatchObject({ outcome: "error", message: expect.stringContaining("EACCES") });
    expect(buildProjectActionItems(failed).some(item => item.tone === "success")).toBe(false);
    const partial = snapshot({ projectRoot: "/demo", enabled: true, index: surfaceIndex(), syncWarning: "dependency unavailable" });
    expect(scanOperationResult([partial])).toMatchObject({ outcome: "blocked", message: expect.stringContaining("dependency unavailable") });
    expect(scanOperationResult([snapshot()]).outcome).toBe("success");
  });
  it("routes dependency-only row clicks to a visible review target", () => {
    const project = snapshot({ projectRoot: "/demo", enabled: true, index: surfaceIndex({ core: surfaceEntry({ dependencySyncWarning: "upstream unavailable" }) }) });
    const card = project.cartridges[0];
    const issue = pickIssueForCartridge(card, "blocking");
    expect(issue).toBe("review");
    expect(cartridgesForIssue(project, issue)).toContain(card);
    expect(getCartridgeStatus(card).label).toBe("複審");
  });
  it("projects parent review into the parent row and drilldown, independent of child blockers", () => {
    const project = snapshot({ projectRoot: "/demo", enabled: true, index: surfaceIndex({ core: surfaceEntry(), child: surfaceEntry({ parent: "core", staleness: 1 }) }) });
    const parent = project.cartridges.find(card => card.id === "core")!;
    expect(getCartridgeStatus(parent).label).toBe("複審");
    expect(cartridgesForIssue(project, "review")).toContain(parent);
    expect(parent.warnings?.some(w => w.code === "memory_child_review")).toBe(true);
  });
});

describe("Desktop response ownership", () => {
  it("rejects stale initial loads, reverse operation replies and disposed completions", async () => {
    const gate = new LatestRequest(); const old = deferred<string>(); const fresh = deferred<string>();
    let state = "initial";
    const a = gate.begin(); const pendingA = old.promise.then(value => { if (gate.isCurrent(a)) state = value; });
    const b = gate.begin(); const pendingB = fresh.promise.then(value => { if (gate.isCurrent(b)) state = value; });
    fresh.resolve("new snapshot"); await pendingB;
    old.resolve("stale list response"); await pendingA;
    expect(state).toBe("new snapshot");
    gate.invalidate(); expect(gate.isCurrent(b)).toBe(false);
  });
});
