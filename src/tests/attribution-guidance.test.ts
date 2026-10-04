import { expect, it, vi } from "vitest";
import { createAttributionGuidance } from "../attribution-guidance.js";
import { surfaceIndex } from "./surface-regression-fixtures.js";
it("chooses an owner and returns actionable, explicitly unapplied guidance without mutation", async () => {
  const index = surfaceIndex(); const before = JSON.stringify(index);
  const choose = vi.fn().mockResolvedValue("core");
  const result = await createAttributionGuidance({ projectRoot: "/demo", filePath: "/demo/src/new.ts", index, choose });
  expect(result?.message).toContain("尚未修改"); expect(result?.message).not.toContain("已將");
  expect(result?.prompt).toContain("src/new.ts"); expect(result?.prompt).toContain("core");
  expect(result?.prompt).toContain("Tracked Files"); expect(result?.prompt).toContain("授權");
  expect(JSON.stringify(index)).toBe(before);
});
it("cancel and outside-root requests never claim success", async () => {
  const choose = vi.fn().mockResolvedValue(undefined);
  expect(await createAttributionGuidance({ projectRoot: "/demo", filePath: "/demo/src/new.ts", index: surfaceIndex(), choose })).toBeNull();
  await expect(createAttributionGuidance({ projectRoot: "/demo", filePath: "/outside.txt", index: surfaceIndex(), choose })).rejects.toThrow("專案");
  expect(choose).toHaveBeenCalledTimes(1);
});
