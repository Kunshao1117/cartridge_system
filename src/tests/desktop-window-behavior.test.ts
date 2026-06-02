import { describe, expect, it } from "vitest";
import { DEFAULT_DESKTOP_SETTINGS } from "../desktop/project-store";
import { shouldHideWindowOnClose } from "../desktop/window-behavior";

describe("desktop window behavior", () => {
  it("hides the window when close-to-tray is enabled", () => {
    expect(
      shouldHideWindowOnClose({
        settings: DEFAULT_DESKTOP_SETTINGS,
        isQuitting: false,
      }),
    ).toBe(true);
  });

  it("does not hide the window during an explicit quit", () => {
    expect(
      shouldHideWindowOnClose({
        settings: DEFAULT_DESKTOP_SETTINGS,
        isQuitting: true,
      }),
    ).toBe(false);
  });

  it("does not hide the window when close-to-tray is disabled", () => {
    expect(
      shouldHideWindowOnClose({
        settings: { ...DEFAULT_DESKTOP_SETTINGS, minimizeToTray: false },
        isQuitting: false,
      }),
    ).toBe(false);
  });
});
