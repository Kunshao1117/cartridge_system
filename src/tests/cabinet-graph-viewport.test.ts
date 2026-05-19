import { describe, expect, it } from "vitest";
import {
  buildGraphSignature,
  clampReadableZoom,
  clampUserZoom,
  createGraphViewports,
  formatZoomPercent,
  getGraphLayoutReason,
  getGraphViewport,
  rememberGraphViewport,
  type GraphCardSnapshot,
  type GraphLineSnapshot,
} from "../cabinet-graph-viewport.js";

function card(id: string, title = id): GraphCardSnapshot {
  return {
    id,
    label: id,
    title,
    status: "healthy",
    trackedFilesCount: 1,
    maintenanceScore: 0,
    memoryScore: 1,
    structureScore: 1,
  };
}

function line(label = "slot"): GraphLineSnapshot {
  return {
    id: `a-b-${label}`,
    type: "slot",
    source: "a",
    target: "b",
    label,
    weight: 1,
  };
}

describe("cabinet graph viewport", () => {
  it("應讓每個艙位獨立保存與還原視角", () => {
    const viewports = createGraphViewports();

    rememberGraphViewport(viewports, "maintenance", { zoom: 1.1, pan: { x: 12, y: 24 } });
    rememberGraphViewport(viewports, "memory", { zoom: 0.8, pan: { x: -4, y: 9 } });

    expect(getGraphViewport(viewports, "maintenance")).toEqual({ zoom: 1.1, pan: { x: 12, y: 24 } });
    expect(getGraphViewport(viewports, "memory")).toEqual({ zoom: 0.8, pan: { x: -4, y: 9 } });
    expect(getGraphViewport(viewports, "structure")).toBeUndefined();
  });

  it("應只在初次、艙位切換或內容變化時要求重新 layout", () => {
    const signature = buildGraphSignature([card("a")], []);

    expect(getGraphLayoutReason(undefined, "maintenance", signature)).toBe("initial");
    expect(getGraphLayoutReason({ lens: "memory", signature }, "maintenance", signature)).toBe("lens");
    expect(getGraphLayoutReason({ lens: "maintenance", signature }, "maintenance", `${signature}:changed`)).toBe(
      "content",
    );
    expect(getGraphLayoutReason({ lens: "maintenance", signature }, "maintenance", signature)).toBeNull();
  });

  it("應把卡匣標題與連線語意納入內容簽章", () => {
    const first = buildGraphSignature([card("a", "卡匣 A"), card("b")], [line("slot")]);
    const titleChanged = buildGraphSignature([card("a", "卡匣 A2"), card("b")], [line("slot")]);
    const lineChanged = buildGraphSignature([card("a", "卡匣 A"), card("b")], [line("parent")]);

    expect(titleChanged).not.toBe(first);
    expect(lineChanged).not.toBe(first);
  });

  it("應限制自動 fit 後的縮放範圍，避免圖譜過小或過大", () => {
    expect(clampReadableZoom(0.2, 24)).toBe(0.72);
    expect(clampReadableZoom(0.2, 6)).toBe(0.9);
    expect(clampReadableZoom(2, 6)).toBe(1.22);
    expect(clampReadableZoom(1, 6)).toBe(1);
  });

  it("應限制使用者縮放並格式化百分比", () => {
    expect(clampUserZoom(0.1)).toBe(0.35);
    expect(clampUserZoom(3)).toBe(2.4);
    expect(clampUserZoom(1.15)).toBe(1.15);
    expect(formatZoomPercent(1)).toBe("100%");
    expect(formatZoomPercent(1.156)).toBe("116%");
  });
});
