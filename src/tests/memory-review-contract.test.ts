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

describe("version-controlled source reconciliation boundary", () => {
  it("requires a pinned governance owner and independent pre-apply review", () => {
    const pins = [...contract.matchAll(/AI_Rules\/blob\/([a-f0-9]{40})\//g)].map((match) => match[1]);
    expect(pins.length).toBeGreaterThanOrEqual(4);
    expect(new Set(pins).size).toBe(1);
    expect(contract).toContain(`https://github.com/Kunshao1117/AI_Rules/blob/${pins[0]}/Shared/policies/references/repository-memory-reconciliation.md`);
    for (const evidence of ["repository-memory-reconciliation", "基線 commit", "既有卡 allowlist", "使用者授權", "精確 diff", "實體套用前的獨立審查", "原始 bytes", "逐檔 readback", "rollback", "explicit_source_scope", "isolated_source_target", "current_claim_evidence", "independent_patch_review", "recoverable_history", "bounded_source_effects", "truthful_validation", "symlink/alias", "後續編輯會阻擋自動還原"]) {
      expect(contract).toContain(evidence);
    }
  });
  it("keeps runtime capabilities, receipts and historical metadata separate", () => {
    expect(contract).toContain("不是 M5 cutover");
    expect(contract).toContain("本路徑不授權建卡、拆分、移動、刪除歷史、runtime projection、memory_commit、memory_reindex、index sync 或無效索引修復");
    expect(contract).toContain("trusted envelope/receipt");
    expect(contract).toContain("保留原有 last_verified、last_updated、cycle 與 stale 歷史值");
    expect(contract).toContain("pending_review");
    expect(contract).toContain("來源卡已修改、Memory commit 未執行、index/derived sync 未執行必須分開回報");
    expect(contract).toContain("不能宣稱 stale、pending 或 ghost 已清除");
    expect(CARTRIDGE_TOOLS.filter((tool) => !tool.readOnly).map((tool) => tool.name)).toEqual(["memory_commit", "memory_reindex"]);
  });
});
