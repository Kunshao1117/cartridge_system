import { describe, expect, it } from "vitest";
import { projectCanonicalHealth } from "../project-health.js";
import type { CartridgeIndex } from "../types.js";

describe("projectCanonicalHealth", () => {
  it("is blocked by canonical blocking findings", () => {
    const index = emptyIndex();
    index.untrackedFiles = [
      {
        filePath: "src/orphan.ts",
        suggestedOwner: null,
        detectedAt: "now",
        lastEvent: "add",
      },
    ];
    expect(projectCanonicalHealth(index).status).toBe("blocked");
  });

  it("is warning for review or advisory findings and ready otherwise", () => {
    const warning = emptyIndex();
    warning.cartridges.core = {
      skillPath: ".agents/memory/core/SKILL.md",
      description: "legacy",
      trackedFiles: [],
      staleness: 0,
      lastUpdated: "now",
      pendingChanges: [],
      depth: 1,
      parent: null,
      ghostFiles: [],
      dependencies: [],
      indirectStaleness: 0,
    };
    expect(projectCanonicalHealth(warning).status).toBe("warning");
    expect(projectCanonicalHealth(emptyIndex()).status).toBe("ready");
  });

  it("overlays a sync warning on an otherwise ready canonical state", () => {
    const health = projectCanonicalHealth(
      emptyIndex(),
      "canonical index reload failed",
    );

    expect(health.status).toBe("warning");
    expect(health.syncWarning).toBe("canonical index reload failed");
  });
});

function emptyIndex(): CartridgeIndex {
  return {
    version: 1,
    lastScanned: "now",
    cartridges: {},
    fileMap: {},
    untrackedFiles: [],
  };
}
