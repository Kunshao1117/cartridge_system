import type { DesktopSettings } from "./project-store.js";

export function shouldHideWindowOnClose(args: {
  settings: DesktopSettings;
  isQuitting: boolean;
}): boolean {
  return args.settings.minimizeToTray && !args.isQuitting;
}
