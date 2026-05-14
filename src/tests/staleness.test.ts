import { describe, expect, it } from "vitest";
import { stalenessToLevel } from "../staleness.js";

describe("stalenessToLevel — 過期等級轉換", () => {
  it("0 以下與 0 應回傳 healthy", () => {
    expect(stalenessToLevel(-1)).toBe("healthy");
    expect(stalenessToLevel(0)).toBe("healthy");
  });

  it("1 到 9 應回傳 mild", () => {
    expect(stalenessToLevel(1)).toBe("mild");
    expect(stalenessToLevel(9)).toBe("mild");
  });

  it("10 到 29 應回傳 significant", () => {
    expect(stalenessToLevel(10)).toBe("significant");
    expect(stalenessToLevel(29)).toBe("significant");
  });

  it("30 以上應回傳 critical", () => {
    expect(stalenessToLevel(30)).toBe("critical");
    expect(stalenessToLevel(100)).toBe("critical");
  });
});
