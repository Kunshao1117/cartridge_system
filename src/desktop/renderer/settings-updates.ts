import type { DesktopBridge, DesktopOperationResult } from "../ipc-channels";
import type { DesktopSettings } from "../project-store";

/** Serializes renderer writes and reconciles failure replies with persisted state. */
export class SettingsUpdateQueue {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private readonly api: Pick<DesktopBridge, "updateSettings" | "getSettings">) {}
  update(patch: Partial<DesktopSettings>): Promise<DesktopOperationResult<DesktopSettings>> {
    const update = { ...patch };
    const current = this.tail.catch(() => undefined).then(async () => {
      let result: DesktopOperationResult<DesktopSettings>;
      try { result = await this.api.updateSettings(update); }
      catch (error) { result = { outcome: "error", message: `設定更新失敗：${error instanceof Error ? error.message : String(error)}` }; }
      try { return { ...result, data: await this.api.getSettings() }; }
      catch (error) { return { ...result, outcome: "error" as const, message: `${result.message} 無法確認目前設定：${error instanceof Error ? error.message : String(error)}` }; }
    });
    this.tail = current;
    return current;
  }
}
