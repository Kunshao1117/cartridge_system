import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CARTRIDGE_TOOLS } from "../tool-registry.js";

const contract = fs.readFileSync(path.join(process.cwd(), "docs/memory-review-contract.md"), "utf8");
describe("AI_Rules workflow boundary contract (documentation, not a disposition engine)", () => {
  it("T16-18 documents all seven dispositions and bounded no-write/tracking scope", () => {
    for (const value of ["memory-not-required", "memory-attributed-no-write", "memory-required", "memory-card-missing", "memory-blocked-by-scope", "memory-conflict-or-compaction-blocked", "memory-unverified"]) expect(contract).toContain(value);
    expect(contract).toContain("memory-required + tracking-only");
    expect(contract).toContain("不改卡、不呼叫 memory_commit 或 memory_reindex");
    expect(contract).toContain("不宣稱 stale 已清");
    expect(contract).toContain("沒有新增七態持久化機器");
    expect(CARTRIDGE_TOOLS.filter((tool) => !tool.readOnly).map((tool) => tool.name)).toEqual(["memory_commit", "memory_reindex"]);
  });
  it("T22 requires affected source/card version review without invalidating unrelated evidence", () => {
    expect(contract).toContain("source slice/revision");
    expect(contract).toContain("card revision/scope");
    expect(contract).toContain("重審受影響 claims");
    expect(contract).toContain("只改無關檔案，不機械清除全部比較證據");
  });
  it("T24 preserves 18 real tools and review-first authorized commit guidance", () => {
    expect(CARTRIDGE_TOOLS).toHaveLength(18);
    expect(CARTRIDGE_TOOLS.some((tool) => tool.name === "memory_update")).toBe(false);
    for (const tool of CARTRIDGE_TOOLS) expect(contract).toContain(tool.name);
    const commit = CARTRIDGE_TOOLS.find((tool) => tool.name === "memory_commit")!;
    expect(commit.description).toContain("部分成功不是全部收斂");
    expect(commit.requiresExplicitApproval).toBe(true);
  });
});
