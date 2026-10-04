import { expect, it, vi } from "vitest";
import { SettingsUpdateQueue } from "../desktop/renderer/settings-updates.js";
import { DEFAULT_DESKTOP_SETTINGS } from "../desktop/project-store.js";
import { deferred } from "./surface-regression-fixtures.js";
it.each(["same", "different"])("keeps committed settings when a later %s-field change fails", async mode => {
  const first = deferred<void>(); const started = deferred<void>(); const state = { ...DEFAULT_DESKTOP_SETTINGS };
  const write = vi.fn().mockImplementationOnce(async () => { started.resolve(); await first.promise; state.minimizeToTray = false; return { outcome: "success", message: "saved", data: { ...state } }; }).mockRejectedValueOnce(new Error("disk unavailable"));
  const queue = new SettingsUpdateQueue({ updateSettings: write, getSettings: async () => ({ ...state }) });
  const a = queue.update({ minimizeToTray: false });
  const b = queue.update(mode === "same" ? { minimizeToTray: true } : { notificationsEnabled: false });
  await started.promise; expect(write).toHaveBeenCalledTimes(1);
  first.resolve(); await a;
  expect(await b).toMatchObject({ outcome: "error", data: { minimizeToTray: false, notificationsEnabled: true } });
  expect(write).toHaveBeenCalledTimes(2);
});
