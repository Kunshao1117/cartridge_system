import { describe, expect, it } from "vitest";
import {
  createVisibleCartridgeIndex,
  filterVisibleUntrackedFiles,
  isManagedMemoryArtifactPath,
} from "../visible-index.js";
import type { CartridgeIndex } from "../types.js";

describe("visible index helpers", () => {
  it("classifies managed memory artifacts outside index-manager", () => {
    expect(isManagedMemoryArtifactPath(".agents/memory/core/archive-001.md")).toBe(
      true,
    );
    expect(isManagedMemoryArtifactPath(".agents/skills/mem-core/SKILL.md")).toBe(
      true,
    );
    expect(isManagedMemoryArtifactPath("src/index.ts")).toBe(false);
  });

  it("filters memory governance artifacts from visible untracked files", () => {
    const visible = filterVisibleUntrackedFiles([
      { filePath: ".agents/memory/core/archive-001.md" },
      { filePath: ".agents/skills/mem-core/archive-001.md" },
      { filePath: "src/new.ts" },
    ]);

    expect(visible).toEqual([{ filePath: "src/new.ts" }]);
  });

  it("returns a visible index without mutating the original index", () => {
    const index: CartridgeIndex = {
      version: 1,
      lastScanned: "",
      cartridges: {},
      fileMap: {},
      untrackedFiles: [
        {
          filePath: ".agents/memory/core/archive-001.md",
          suggestedOwner: null,
          detectedAt: "now",
          lastEvent: "add",
        },
        {
          filePath: "src/new.ts",
          suggestedOwner: null,
          detectedAt: "now",
          lastEvent: "add",
        },
      ],
    };

    const visible = createVisibleCartridgeIndex(index);

    expect(visible.untrackedFiles.map((entry) => entry.filePath)).toEqual([
      "src/new.ts",
    ]);
    expect(index.untrackedFiles).toHaveLength(2);
  });
});
