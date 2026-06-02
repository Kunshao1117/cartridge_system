import { describe, expect, it } from "vitest";
import {
  classifyMemoryWarnings,
  getStalenessLevel,
  stalenessToLevel,
} from "../staleness.js";
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

describe("classifyMemoryWarnings — 記憶警示分層", () => {
  it("應把直接問題列為阻塞，間接與父子衍生列為複審", () => {
    const result = classifyMemoryWarnings({
      cartridges: {
        parent: {
          staleness: 0,
          ghostFiles: [],
          indirectStaleness: 0,
          parent: null,
        },
        child: {
          staleness: 0,
          ghostFiles: [],
          indirectStaleness: 6,
          parent: "parent",
        },
        stale: {
          staleness: 10,
          ghostFiles: [],
          indirectStaleness: 0,
          parent: null,
        },
      },
      untrackedFiles: [{ filePath: "src/new.ts" }],
    });

    expect(result.blocking.map((item) => item.code)).toEqual([
      "memory_stale",
      "memory_untracked_files",
    ]);
    expect(result.review.map((item) => item.code)).toEqual([
      "memory_indirect_stale",
      "memory_child_review",
    ]);
    expect(result.review.every((item) => item.blocking === false)).toBe(true);
  });
});
