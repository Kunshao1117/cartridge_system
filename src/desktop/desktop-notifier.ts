import { Notification } from "electron";
import type { DesktopProjectSnapshot } from "../monitoring/project-snapshot.js";

export class DesktopNotifier {
  private previous = new Map<string, DesktopProjectSnapshot["status"]>();

  getPreviousStatus(projectId: string): DesktopProjectSnapshot["status"] | undefined {
    return this.previous.get(projectId);
  }

  notifyChanges(
    snapshots: DesktopProjectSnapshot[],
    options: { enabled?: boolean } = {},
  ): void {
    const enabled = options.enabled !== false;
    if (!enabled) {
      for (const snapshot of snapshots) this.previous.set(snapshot.id, snapshot.status);
      return;
    }

    if (!Notification.isSupported()) return;

    for (const snapshot of snapshots) {
      const previousStatus = this.previous.get(snapshot.id);
      this.previous.set(snapshot.id, snapshot.status);
      if (previousStatus === snapshot.status) continue;

      if (snapshot.status === "blocked" || snapshot.status === "error") {
        new Notification({
          title: `Cartridge：${snapshot.name}`,
          body: this.getNotificationBody(snapshot),
          silent: false,
        }).show();
      }
    }
  }

  private getNotificationBody(snapshot: DesktopProjectSnapshot): string {
    if (snapshot.status === "error") {
      return snapshot.error ?? "專案監控發生錯誤";
    }
    return [
      `${snapshot.counts.blocking} 個阻塞項目`,
      `${snapshot.counts.ghostFiles} 個幽靈檔案`,
      `${snapshot.counts.untrackedFiles} 個未歸屬檔案`,
    ].join("，");
  }
}
