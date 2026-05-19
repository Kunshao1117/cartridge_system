import { describe, expect, it } from "vitest";
import { buildCabinetWorkbenchModel } from "../cabinet-workbench-model.js";
import {
  parseCabinetMemoryMetadata,
  type CabinetMemoryMetadata,
} from "../cabinet-memory-metadata.js";
import type { CartridgeIndex } from "../types.js";

function fixtureIndex(): CartridgeIndex {
  return {
    version: 1,
    lastScanned: "2026-05-19T00:00:00+08:00",
    cartridges: {
      core: {
        skillPath: ".agents/memory/core/SKILL.md",
        description: "核心卡匣",
        trackedFiles: ["src/core.ts"],
        staleness: 20,
        lastUpdated: "2026-05-18T00:00:00+08:00",
        pendingChanges: [{ filePath: "src/core.ts", eventType: "change", timestamp: "now" }],
        depth: 1,
        parent: null,
        ghostFiles: [],
        dependencies: [],
        indirectStaleness: 0,
      },
      "core.child": {
        skillPath: ".agents/memory/core/child/SKILL.md",
        description: "子卡匣",
        trackedFiles: ["src/child.ts"],
        staleness: 0,
        lastUpdated: "2026-05-18T00:00:00+08:00",
        pendingChanges: [],
        depth: 2,
        parent: "core",
        ghostFiles: ["src/missing.ts"],
        dependencies: ["core"],
        indirectStaleness: 12,
      },
    },
    fileMap: {},
    untrackedFiles: [{ filePath: "src/new.ts", suggestedOwner: "core", detectedAt: "now", lastEvent: "add" }],
  };
}

describe("cabinet workbench model", () => {
  it("應把 index 轉成卡匣、卡槽、訊號線與熱度線", () => {
    const metadata: Record<string, CabinetMemoryMetadata> = {
      core: {
        title: "核心卡匣",
        summary: "主卡槽",
        tags: ["kernel"],
        concepts: ["watch"],
        aliases: [],
        relationNotes: [],
        decisions: ["D01: keep cartridge metaphor"],
        lessons: [],
      },
    };

    const model = buildCabinetWorkbenchModel(fixtureIndex(), metadata);

    expect(model.summary.totalCards).toBe(2);
    expect(model.summary.staleCards).toBe(1);
    expect(model.summary.ghostFiles).toBe(1);
    expect(model.summary.untrackedFiles).toBe(1);
    expect(model.cards.find((card) => card.id === "core")?.title).toBe("核心卡匣");
    expect(model.cards.find((card) => card.id === "core")?.children).toEqual(["core.child"]);
    expect(model.cards.find((card) => card.id === "core")?.pendingChanges).toEqual(["src/core.ts"]);
    expect(model.cards.find((card) => card.id === "core.child")?.ghostFiles).toEqual(["src/missing.ts"]);
    expect(model.summary.lenses.maintenance.primaryLabel).toBe("發熱卡");
    expect(model.summary.lenses.memory.primaryLabel).toBe("決策");
    expect(model.summary.lenses.structure.primaryLabel).toBe("追蹤檔");
    expect(model.lines.map((line) => line.type)).toEqual(["slot", "signal", "heat"]);
    expect(model.lines.find((line) => line.type === "heat")).toMatchObject({
      source: "core",
      target: "core.child",
    });
  });

  it("應由卡匣 metadata 產生記憶艙可用的 note 連線與記憶分數", () => {
    const metadata: Record<string, CabinetMemoryMetadata> = {
      core: {
        title: "核心卡匣",
        summary: "主卡槽",
        tags: ["kernel"],
        concepts: ["watch"],
        aliases: [],
        relationNotes: [],
        decisions: ["D01: keep cartridge metaphor"],
        lessons: [],
      },
      "core.child": {
        title: "子卡匣",
        summary: "子卡槽",
        tags: [],
        concepts: ["watch"],
        aliases: [],
        relationNotes: [],
        decisions: [],
        lessons: ["L01: shared concept"],
      },
    };

    const model = buildCabinetWorkbenchModel(fixtureIndex(), metadata);

    expect(model.summary.noteLines).toBe(1);
    expect(model.summary.lenses.memory.lineCount).toBe(1);
    expect(model.lines.find((line) => line.type === "note")).toMatchObject({
      source: "core",
      target: "core.child",
      label: "watch",
    });
    expect(model.cards.find((card) => card.id === "core")?.memoryScore).toBeGreaterThan(0);
  });

  it("應解析 V2 欄位並保留舊格式章節", () => {
    const metadata = parseCabinetMemoryMetadata(`---
title: 卡匣工作台
summary: 精緻機櫃視圖
tags:
  - cabinet
concepts:
  - heat-line
aliases:
  - cabinet-view
---

## Key Decisions

- D01: 保持卡匣語言。

## Relations

- extension（parent card）

## Module Lessons

- L01: 圖譜能力是底層工具。
`);

    expect(metadata.title).toBe("卡匣工作台");
    expect(metadata.summary).toBe("精緻機櫃視圖");
    expect(metadata.tags).toEqual(["cabinet"]);
    expect(metadata.concepts).toEqual(["heat-line"]);
    expect(metadata.aliases).toEqual(["cabinet-view"]);
    expect(metadata.relationNotes).toEqual(["extension（parent card）"]);
    expect(metadata.decisions[0]).toContain("卡匣語言");
    expect(metadata.lessons[0]).toContain("底層工具");
  });
});
