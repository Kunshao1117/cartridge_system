import { describe, expect, it } from "vitest";
import {
  formatDependencySemanticWarning,
  validateDependencySemantics,
} from "../dependency-semantics.js";

describe("validateDependencySemantics — dependencies 語義警告", () => {
  it("有明確依賴理由時不應回傳 warning", () => {
    const warnings = validateDependencySemantics({
      moduleName: "mcp-tools.dispatcher",
      dependencies: ["mcp-tools.handlers"],
      body: `
## Key Decisions
- D01: mcp-tools.dispatcher dependencies include mcp-tools.handlers because it imports handler functions.

## Relations
- mcp-tools
`,
    });

    expect(warnings).toEqual([]);
  });

  it("缺少 Key Decisions 或 Known Issues 依賴理由時應回傳 warning", () => {
    const warnings = validateDependencySemantics({
      moduleName: "mcp-tools.dispatcher",
      dependencies: ["mcp-tools.handlers"],
      body: `
## Key Decisions
- D01: Dispatcher routes tool calls.
`,
    });

    expect(warnings.map((warning) => warning.code)).toContain(
      "DEPENDENCY_REASON_MISSING",
    );
  });

  it("父卡依賴應標記為可疑導覽關係", () => {
    const warnings = validateDependencySemantics({
      moduleName: "mcp-tools.dispatcher",
      dependencies: ["mcp-tools"],
      parent: "mcp-tools",
      body: `
## Key Decisions
- D01: Dispatcher routes tool calls.
`,
    });

    expect(warnings.map((warning) => warning.code)).toContain(
      "DEPENDENCY_PARENT_CHILD_SUSPECT",
    );
  });

  it("技能名稱寫入 dependencies 應標記為 Applicable Skills 可疑混用", () => {
    const warnings = validateDependencySemantics({
      moduleName: "mcp-tools.handlers",
      dependencies: ["memory-ops"],
      body: `
## Key Decisions
- D01: Handler owns memory_commit behavior.
`,
    });

    expect(warnings.map((warning) => warning.code)).toContain(
      "DEPENDENCY_SKILL_NAME_SUSPECT",
    );
  });

  it("同時出現在 dependencies 與 Relations 且無理由時應標記鏡像可疑", () => {
    const warnings = validateDependencySemantics({
      moduleName: "mcp-tools.handlers",
      dependencies: ["mcp-tools"],
      body: `
## Key Decisions
- D01: Handler owns memory_commit behavior.

## Relations
- mcp-tools（父卡）
`,
    });

    expect(warnings.map((warning) => warning.code)).toContain(
      "DEPENDENCY_RELATION_MIRROR_SUSPECT",
    );
  });

  it("格式化 warning 應包含 code", () => {
    const [warning] = validateDependencySemantics({
      moduleName: "mcp-tools.handlers",
      dependencies: ["memory-ops"],
      body: "",
    });

    expect(formatDependencySemanticWarning(warning)).toContain(
      "[DEPENDENCY_REASON_MISSING]",
    );
  });
});
