import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isKnownProjectRoot,
  resolveProjectFilePath,
} from "../desktop/path-guard";

describe("desktop path guard", () => {
  it("matches known project roots after path normalization", () => {
    const root = path.resolve("D:/demo/project");

    expect(isKnownProjectRoot("D:/demo/project", [root])).toBe(true);
  });

  it("rejects unknown project roots", () => {
    expect(isKnownProjectRoot("D:/other/project", ["D:/demo/project"])).toBe(false);
  });

  it("resolves project relative file paths inside the project", () => {
    const root = path.resolve("D:/demo/project");

    expect(resolveProjectFilePath(root, ".agents/memory/app/SKILL.md")).toBe(
      path.resolve(root, ".agents/memory/app/SKILL.md"),
    );
  });

  it("rejects absolute file paths", () => {
    const root = path.resolve("D:/demo/project");

    expect(resolveProjectFilePath(root, path.resolve("D:/demo/secret.txt"))).toBeNull();
  });

  it("rejects paths escaping the project root", () => {
    const root = path.resolve("D:/demo/project");

    expect(resolveProjectFilePath(root, "../secret.txt")).toBeNull();
  });
});
