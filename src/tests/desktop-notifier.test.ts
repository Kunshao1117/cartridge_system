import { describe, expect, it } from "vitest";
import { DesktopNotifier } from "../desktop/desktop-notifier";
import type { DesktopProjectSnapshot } from "../monitoring/project-snapshot";

function createSnapshot(status: DesktopProjectSnapshot["status"]): DesktopProjectSnapshot {
  return {
    id: "demo",
    name: "demo",
    root: "D:\\demo",
    status,
    enabled: true,
    lastScanned: "2026-06-03T00:00:00.000Z",
    error: null,
    counts: {
      cartridges: 0,
      blocking: status === "blocked" ? 1 : 0,
      review: 0,
      info: 0,
      stale: 0,
      ghostFiles: 0,
      untrackedFiles: 0,
      pendingChanges: 0,
    },
    cartridges: [],
    untrackedFiles: [],
  };
}

describe("DesktopNotifier", () => {
  it("updates status memory without showing notifications when disabled", () => {
    const notifier = new DesktopNotifier();

    notifier.notifyChanges([createSnapshot("blocked")], { enabled: false });

    expect(notifier.getPreviousStatus("demo")).toBe("blocked");
  });
});
