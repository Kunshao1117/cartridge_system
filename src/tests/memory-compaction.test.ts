import { describe, expect, it } from "vitest";
import {
  buildArchiveVolumeMetrics,
  buildCompactionMetrics,
  countCycleEvents,
} from "../memory-compaction.js";

function modernCard(events: number, extraBody = "") {
  const eventLines = Array.from(
    { length: events },
    (_, index) => `- ${String(index + 1).padStart(2, "0")}: Update current implementation fact.`,
  ).join("\n");
  return `---
name: test-card
description: test
last_updated: '2026-06-04T00:00:00+08:00'
staleness: 0
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_id: 2026-06-04-001
cycle_event_count: ${events}
size_limit_bytes: 16384
archive_policy: volume
compaction_status: ready
metadata:
  author: test
  version: '1.0'
  origin: test
  memory_awareness: full
  tool_scope: []
---

## Current Truth

- The current behavior is documented in English.

## Active Constraints

- Keep cycle events under the configured limit.

## Cycle Events

${eventLines}

## Archive Index

- None.

## 中文摘要

- 測試摘要。

## Tracked Files

- src/test.ts
${extraBody}
`;
}

describe("memory compaction metrics", () => {
  it("二十九筆週期事件不需要彙整", () => {
    const metrics = buildCompactionMetrics(modernCard(29));

    expect(metrics.isLegacy).toBe(false);
    expect(metrics.cycleEventCount).toBe(29);
    expect(metrics.needsCompaction).toBe(false);
    expect(metrics.compactionStatus).toBe("ready");
    expect(metrics.recommendedAction).toBe("none");
  });

  it("三十筆週期事件會進入必須彙整狀態", () => {
    const metrics = buildCompactionMetrics(modernCard(30));

    expect(metrics.cycleEventCount).toBe(30);
    expect(metrics.needsCompaction).toBe(true);
    expect(metrics.compactionStatus).toBe("due");
    expect(metrics.compliance).toBe("due");
    expect(metrics.reasons).toContain("cycleEventLimitReached");
    expect(metrics.reasons).toContain("cycleEventLimit");
  });

  it("三十一筆週期事件是不合規狀態", () => {
    const metrics = buildCompactionMetrics(modernCard(31));

    expect(metrics.cycleEventCount).toBe(31);
    expect(metrics.needsCompaction).toBe(true);
    expect(metrics.compactionStatus).toBe("blocked");
    expect(metrics.compliance).toBe("invalid");
    expect(metrics.reasons).toContain("cycleEventLimitExceeded");
  });

  it("可從 Cycle Events 區段計算事件數", () => {
    expect(countCycleEvents(modernCard(3).replace("cycle_event_count: 3", ""))).toBe(
      3,
    );
  });

  it("舊卡可讀但建議懶升級", () => {
    const metrics = buildCompactionMetrics(`---
name: old-card
description: test
last_updated: '2026-06-04T00:00:00+08:00'
staleness: 0
---

## Key Decisions

- D01: old content.
`);

    expect(metrics.isLegacy).toBe(true);
    expect(metrics.compactionStatus).toBe("legacy");
    expect(metrics.needsCompaction).toBe(false);
    expect(metrics.recommendedAction).toBe("lazy_upgrade");
  });

  it("主卡使用 archive_policy volume 仍套用 16KB 與 120 行限制", () => {
    const longBody = Array.from(
      { length: 130 },
      (_, index) => `- Line ${index + 1}: current truth remains intentionally verbose.`,
    ).join("\n");
    const metrics = buildCompactionMetrics(
      modernCard(1, `\n## Notes\n\n${longBody}\n`),
      undefined,
      { cardPath: ".agents/memory/main-card/SKILL.md" },
    );

    expect(metrics.cardKind).toBe("main");
    expect(metrics.sizeLimitBytes).toBe(16 * 1024);
    expect(metrics.lineLimit).toBe(120);
    expect(metrics.needsCompaction).toBe(true);
    expect(metrics.reasons).toContain("mainCardLineLimit");
  });

  it("根層索引卡超過 8KB 會要求移出細節", () => {
    const metrics = buildCompactionMetrics(
      `${modernCard(0)}\n${"Navigation detail.\n".repeat(700)}`,
      undefined,
      { cardPath: ".agents/memory/_map/SKILL.md" },
    );

    expect(metrics.cardKind).toBe("root_index");
    expect(metrics.sizeLimitBytes).toBe(8 * 1024);
    expect(metrics.lineLimit).toBeNull();
    expect(metrics.needsCompaction).toBe(true);
    expect(metrics.reasons).toContain("rootIndexOversize");
  });

  it("歸檔卷超過 32KB 或 200 行會提示開下一卷", () => {
    const archive = buildArchiveVolumeMetrics(
      `# Archive\n\n${"Historical detail.\n".repeat(210)}`,
      ".agents/memory/demo/archive-001.md",
    );

    expect(archive.sizeLimitBytes).toBe(32 * 1024);
    expect(archive.lineLimit).toBe(200);
    expect(archive.needsCompaction).toBe(true);
    expect(archive.recommendedAction).toBe("open_next_archive");
    expect(archive.reasons).toContain("archiveVolumeLineLimit");
  });

  it("英文主體卡若含大量中文正文會回報語言比例警告", () => {
    const chineseBody = Array.from(
      { length: 12 },
      () =>
        "- 這是一段很長的中文正文，代表主體內容沒有使用英文進行維護，應該被工具提示需要調整。",
    ).join("\n");
    const metrics = buildCompactionMetrics(
      modernCard(1, `\n## Notes\n\n${chineseBody}\n`),
    );

    expect(metrics.reasons).toContain("highChineseRatio");
    expect(metrics.recommendedAction).toBe("compact");
  });

  it("中文摘要與 description 不應造成中文比例誤報", () => {
    const metrics = buildCompactionMetrics(`---
name: language-safe
description: 這裡可以包含中文描述與觸發關鍵字
last_updated: '2026-06-04T00:00:00+08:00'
staleness: 0
memory_schema_version: 2
content_language: en
human_language: zh-TW
cycle_event_count: 1
archive_policy: volume
compaction_status: ready
metadata:
  author: test
---

## Current Truth

- The implementation remains documented in short English facts.

## Active Constraints

- Keep Chinese content in the summary.

## Cycle Events

- 01: Updated the card.

## Archive Index

- None.

## 中文摘要

- 這是一段很長的中文摘要，包含大量中文說明，但不應列入英文主體比例計算。
- 這是一段很長的中文摘要，包含大量中文說明，但不應列入英文主體比例計算。
- 這是一段很長的中文摘要，包含大量中文說明，但不應列入英文主體比例計算。

## Tracked Files

- src/language-safe.ts
`);

    expect(metrics.reasons).not.toContain("highChineseRatio");
  });
});
