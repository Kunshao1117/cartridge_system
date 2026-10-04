import { beforeEach, expect, it, vi } from "vitest";
import { deferred } from "./surface-regression-fixtures.js";
import type { CartridgeIndexManager } from "../index-manager.js";
import type { CabinetWorkbenchModel } from "../cabinet-workbench-model.js";
interface MockPanel {
  reveal: () => void;
  dispose: () => void;
  onDidDispose: (callback: () => void) => void;
  webview: {
    cspSource: string;
    asWebviewUri: () => { toString: () => string };
    postMessage: (message: unknown) => Promise<boolean>;
    onDidReceiveMessage: (callback: (message: unknown) => void) => void;
  };
  message: (message: unknown) => void;
}
const mocks = vi.hoisted(() => ({ build: vi.fn(), panels: [] as MockPanel[], warn: vi.fn() }));
vi.mock("../cabinet-workbench-model.js", () => ({ buildCabinetWorkbenchModelForProject: mocks.build }));
vi.mock("../cabinet-workbench-html.js", () => ({ buildCabinetWorkbenchHtml: () => "html" }));
vi.mock("vscode", () => ({
  Uri: { joinPath: () => ({ toString: () => "uri" }) }, ViewColumn: { One: 1 }, commands: { executeCommand: vi.fn() },
  window: { showWarningMessage: mocks.warn, createWebviewPanel: () => {
    let onDispose = () => {}; let onMessage = (_message: unknown) => {};
    const panel = { reveal: vi.fn(), dispose: () => onDispose(), onDidDispose: (cb: () => void) => { onDispose = cb; },
      webview: { cspSource: "csp", asWebviewUri: () => ({ toString: () => "script" }), postMessage: vi.fn().mockResolvedValue(true),
        onDidReceiveMessage: (cb: (message: unknown) => void) => { onMessage = cb; } },
      message: (message: unknown) => onMessage(message) };
    mocks.panels.push(panel); return panel;
  } },
}));
import { CabinetWorkbenchPanel } from "../cabinet-workbench-panel.js";
function controller() { return new CabinetWorkbenchPanel({ extensionUri: {} as never, projectRoot: "/demo", indexManager: { getVisibleIndex: () => ({}) } as unknown as CartridgeIndexManager }); }
beforeEach(() => { mocks.build.mockReset(); mocks.warn.mockReset(); mocks.panels.length = 0; });
it("discards metadata resolved after panel disposal", async () => {
  const load = deferred<CabinetWorkbenchModel>(); mocks.build.mockReturnValueOnce(load.promise);
  const c = controller(); c.open(); const refresh = c.refresh(); const panel = mocks.panels[0]; c.dispose();
  load.resolve({ generatedAt: "old" } as CabinetWorkbenchModel); await refresh;
  expect(panel.webview.postMessage).not.toHaveBeenCalled(); expect(mocks.warn).not.toHaveBeenCalled();
});
it("does not send a disposed generation into a reopened panel", async () => {
  const old = deferred<CabinetWorkbenchModel>(); const current = deferred<CabinetWorkbenchModel>();
  mocks.build.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  const c = controller(); c.open(); const previous = c.refresh(); c.dispose(); c.open(); const latest = c.refresh();
  current.resolve({ generatedAt: "new" } as CabinetWorkbenchModel); await latest;
  old.resolve({ generatedAt: "old" } as CabinetWorkbenchModel); await previous;
  expect(mocks.panels[1].webview.postMessage).toHaveBeenCalledTimes(1);
  expect(mocks.panels[1].webview.postMessage).toHaveBeenCalledWith({ type: "model", model: { generatedAt: "new" } });
});
it("retains latest refresh on reverse completion and handles a live failure", async () => {
  const old = deferred<CabinetWorkbenchModel>(); const current = deferred<CabinetWorkbenchModel>();
  mocks.build.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise).mockRejectedValueOnce(new Error("metadata unreadable"));
  const c = controller(); c.open(); const previous = c.refresh(); const latest = c.refresh();
  current.resolve({ generatedAt: "new" } as CabinetWorkbenchModel); await latest; old.resolve({ generatedAt: "old" } as CabinetWorkbenchModel); await previous;
  expect(mocks.panels[0].webview.postMessage).toHaveBeenCalledTimes(1);
  await c.refresh(); expect(mocks.warn).toHaveBeenCalledWith(expect.stringContaining("metadata unreadable"));
});
