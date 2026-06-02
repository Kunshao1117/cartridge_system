import type { DesktopBridge } from "../ipc-channels";

declare global {
  interface Window {
    cartridgeDesktop: DesktopBridge;
  }
}

export const desktopApi = window.cartridgeDesktop;
