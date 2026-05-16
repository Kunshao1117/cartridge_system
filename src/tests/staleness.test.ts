import { describe, expect, it } from "vitest";
import { getStalenessLevel, stalenessToLevel } from "../staleness.js";
import { createConfig } from "../config.js";

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

  it("getStalenessLevel 應維持 config 閾值語義", () => {
    const config = createConfig("d:/cartridge_system");

    expect(getStalenessLevel(0, config)).toBe("healthy");
    expect(getStalenessLevel(9, config)).toBe("mild");
    expect(getStalenessLevel(10, config)).toBe("significant");
    expect(getStalenessLevel(30, config)).toBe("critical");
  });
});
