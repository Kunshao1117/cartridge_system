import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readme = fs.readFileSync(path.join(process.cwd(), "README.md"), "utf8");

describe("README review and validation contract", () => {
  it("does not promise that editing a card clears stale, pending, or ghost state", () => {
    const introduction = readme.split("## ✨ 功能一覽")[0];
    expect(introduction).toContain("只編輯記憶卡不代表完成複審或清除 stale、pending、ghost");
    expect(introduction).not.toContain("自動清除警報，恢復健康狀態");
  });

  it("makes the memory_commit tool table disclose partial synchronization", () => {
    const row = readme.split("\n").find(line => line.startsWith("| `memory_commit` |"));
    expect(row).toBeDefined();
    for (const field of ["MEMORY.md", "synchronizationComplete", "findings", "TRACKING_SYNC_PARTIAL", "INDEX_SYNC_PARTIAL", "DERIVED_SYNC_PARTIAL", "保留 ghost/pending 與直接 stale"]) {
      expect(row).toContain(field);
    }
    expect(row).not.toContain("staleness 歸零");
    expect(row).not.toContain("幽靈清除");
  });

  it("requires reviewing synchronizationComplete and partial findings in the usage example", () => {
    const example = readme.split("// ✅ 推薦流程：")[1]?.split("```")[0];
    expect(example).toContain("先比較現行來源與卡片");
    expect(example).toContain("獲授權");
    expect(example).toContain("synchronizationComplete 與 findings");
    expect(example).toContain("不只看相容 status:success");
    expect(example).toContain("保留缺失來源的 ghost/pending 與直接 stale");
    expect(example).not.toContain("歸零 staleness");
  });

  it("documents source-bound release recovery and the read-only registry dependency", () => {
    expect(readme).toContain("手動初發尚無目標 tag");
    expect(readme).toContain("已核對的完整 SHA");
    expect(readme).toContain("VSIX/Desktop 發布新增 npm registry 可讀取的前提");
    expect(readme).toContain("validation unavailable");
    expect(readme).toContain("不使用 `--clobber`");
    expect(readme).toContain("原附件的來源會明確標為未驗證");
    expect(readme).toContain("不盲目重發");
  });

  it("links CI evidence instead of hard-coding passing test totals", () => {
    expect(readme).toContain("actions/workflows/security-regression.yml/badge.svg");
    expect(readme).toContain("已知平台能力限制會明確標記 skip 與理由，不計為已驗證通過");
    expect(readme).not.toMatch(/badge\/tests-\d|\d+ 個案例通過|\d+ passed|測試涵蓋 \d+ 個測試檔案/);
  });
});
