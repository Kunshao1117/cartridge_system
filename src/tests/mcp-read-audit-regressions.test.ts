import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { handleCommitPreflight } from "../commit-preflight.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleMemoryCommit, handleMemoryDeps, handleMemoryList, handleMemoryRead, handleMemoryStatus, memoryReadSchema, memoryCommitSchema } from "../mcp-handlers.js";
import { handleMemoryGraph, memoryGraphSchema } from "../memory-graph.js";
import { collectContextSignals } from "../context-contract.js";
import { handleProjectContextRead, handleProjectContextValidate } from "../project-context-tools.js";
import { buildWorkspaceBrief } from "../workspace-brief-summary.js";
import { handleWorkspaceBrief } from "../workspace-brief.js";
import { CartridgeIndexManager } from "../index-manager.js";
import { createConfig } from "../config.js";
import { parseGitStatusPorcelain } from "../commit-preflight-summary.js";
import { findToolDefinition } from "../tool-registry.js";

let root: string;
function write(relative: string, content: string) {
  const target = path.join(root, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content);
}
const card = "---\nname: card\ndescription: Summary\nlast_updated: '2026-10-04T08:00:00Z'\nstaleness: 0\nverification_status: verified\nlast_verified: '2026-10-04'\nvalid_scope: module\n---\n## Tracked Files\n- src/a.ts\n## Evidence Base\n- src/a.ts reviewed\n## Key Decisions\n- Keep\n## Module Lessons\n- Keep\n## Cycle Events\n- Reviewed\n";
function envelope(result: Awaited<ReturnType<typeof handleMemoryRead>>) { return JSON.parse(result.content[0].text); }
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "cartridge-audit-read-")); });
afterEach(() => { vi.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true }); });

describe("MCP read-only audited regressions", () => {
  it.each(["\n", "\r\n"])("MCP-03 reads top-level stale metadata with BOM and %j newlines", async newline => {
    write(".agents/memory/a/MEMORY.md", "\uFEFF" + card.replace("staleness: 0", "metadata:\n  staleness: 99\nstaleness: 30").replace(/\n/g, newline));
    const result = envelope(await handleMemoryStatus({ projectRoot: root, moduleName: "a" }));
    expect(result.summary.staleness).toBe(30);
    expect(result.summary.lastUpdated).toBe("2026-10-04T08:00:00Z");
  });
  it("MCP-04 does not retain complete quality when an indexed main card disappears", async () => {
    write(".agents/memory/a/MEMORY.md", card); write("src/a.ts", "export const a = 1;");
    const manager = new CartridgeIndexManager(createConfig(root)); await manager.scan(); await manager.persist();
    fs.unlinkSync(path.join(root, ".agents/memory/a/MEMORY.md"));
    const result = envelope(await handleMemoryList({ projectRoot: root }));
    expect(result.status).not.toBe("ready");
    expect(result.summary.cartridges[0]).toMatchObject({ mainFileType: "missing", contentQualityStatus: "pending_review" });
  });
  it("MCP-05 graph retains durable source-review state without changing card or index bytes", async () => {
    write(".agents/memory/a/MEMORY.md", card); write("src/a.ts", "export const a = 1;");
    const manager = new CartridgeIndexManager(createConfig(root)); await manager.scan();
    manager.getIndex().cartridges.a.staleness = 30;
    manager.getIndex().cartridges.a.pendingChanges = [{ filePath: "src/a.ts", eventType: "change", timestamp: "2026-10-04T09:00:00Z" }];
    manager.markDirty(); await manager.persist();
    const before = fs.readFileSync(path.join(root, ".cartridge/index.json"), "utf8");
    const result = envelope(await handleMemoryGraph({ projectRoot: root }));
    expect(result.summary.cards[0].maintenanceScore).toBeGreaterThanOrEqual(30);
    expect(fs.readFileSync(path.join(root, ".agents/memory/a/MEMORY.md"), "utf8")).toBe(card);
    expect(fs.readFileSync(path.join(root, ".cartridge/index.json"), "utf8")).toBe(before);
  });
  it.each(["明確授權後提交，禁止自動提交。confirm: true，禁止自動寫入", "Require explicit approval. Do not auto-commit. Never write automatically.", "Auto-commit is disabled. Automatic writes are prohibited.", "需要明確授權，不允許 AI 自動提交；禁止任何自動寫入"])("MCP-06 excludes negated permission signals: %s", content => {
    const signals = collectContextSignals(content);
    expect(signals).not.toContain("commit:auto-allowed"); expect(signals).not.toContain("write:auto-allowed");
  });
  it("MCP-06 retains actual affirmative conflicts", () => {
    expect(collectContextSignals("Explicit approval is required. Please auto-commit. Please write automatically.")).toEqual(expect.arrayContaining(["commit:requires-explicit-approval", "commit:auto-allowed", "write:auto-allowed"]));
  });
  it("MCP-07 exact ID beats a prior alias and ambiguous aliases fail closed", async () => {
    write(".agents/context/a/CONTEXT.md", "---\nname: b\n---\n# Alias\n");
    write(".agents/context/b/CONTEXT.md", "---\nname: exact\n---\n# Exact\n");
    expect(envelope(await handleProjectContextRead({ projectRoot: root, target: "b" })).summary.card.id).toBe("b");
    expect(envelope(await handleProjectContextValidate({ projectRoot: root, target: "b" })).summary.checked).toBe(1);
    write(".agents/context/c/CONTEXT.md", "---\nname: shared\n---\n# C\n");
    write(".agents/context/d/CONTEXT.md", "---\nname: shared\n---\n# D\n");
    expect(envelope(await handleProjectContextRead({ projectRoot: root, target: "shared" })).status).toBe("error");
  });
  it.each(["中文卡", "a b"])("MCP-08 list IDs remain usable by read/status/commit/graph schemas: %s", async id => {
    write(`.agents/memory/${id}/MEMORY.md`, card);
    expect(memoryReadSchema.safeParse({ projectRoot: root, moduleName: id }).success).toBe(true);
    expect(memoryCommitSchema.safeParse({ projectRoot: root, moduleName: id, confirm: true }).success).toBe(true);
    expect(memoryGraphSchema.safeParse({ projectRoot: root, focusModule: id }).success).toBe(true);
    write("src/a.ts", "export const a = 1;");
    const manager = new CartridgeIndexManager(createConfig(root)); await manager.scan(); await manager.persist();
    expect(envelope(await handleMemoryRead({ projectRoot: root, moduleName: id })).status).not.toBe("error");
    expect(envelope(await handleMemoryStatus({ projectRoot: root, moduleName: id })).status).not.toBe("error");
    expect(envelope(await handleMemoryDeps({ projectRoot: root, moduleName: id })).status).not.toBe("error");
    expect(envelope(await handleMemoryGraph({ projectRoot: root, focusModule: id })).summary.cards[0].id).toBe(id);
    expect(envelope(await handleMemoryCommit({ projectRoot: root, moduleName: id, confirm: true })).summary.synchronizationComplete).toBe(true);
  });
  it.each(["../a", "a/b", "a\\b", "a..b", ".", "a\0b", "C:a"])("MCP-08 rejects unsafe ID %j", moduleName => {
    expect(memoryReadSchema.safeParse({ projectRoot: root, moduleName }).success).toBe(false);
  });
  it("MCP-09 context blocker takes priority over memory warning", () => {
    const brief = buildWorkspaceBrief({ name: "x", version: "1", description: "" }, { cartridges: { a: { staleness: 0, indirectStaleness: 5, mainFileType: "MEMORY.md", contentQualityStatus: "complete" } } }, { indexAvailable: true, context: { inventory: { assets: 0, existing: 0, missing: 0, byOwner: {}, byType: {} }, readiness: { status: "blocked", blockers: 1, warnings: 0, informational: 0 }, findings: [{ severity: "error", code: "commit_conflict", message: "Conflicting rules", assets: ["codex.agents"], paths: ["AGENTS.md"] }] } });
    expect(brief.readiness.status).toBe("warning");
    expect(brief.startupReadiness.status).toBe("blocked");
  });
  it("MCP-09 outer workspace status reflects project-context review warnings", async () => {
    write("package.json", '{"name":"demo"}');
    write(".cartridge/index.json", '{"version":1,"lastScanned":"now","cartridges":{},"fileMap":{},"untrackedFiles":[]}');
    write(".agents/context/a/CONTEXT.md", "---\nname: draft\nstatus: candidate\n---\n# Draft\n");
    const result = envelope(await handleWorkspaceBrief({ projectRoot: root }));
    expect(result.summary.startupReadiness.status).toBe("needs_review"); expect(result.status).toBe("warning");
  });
  it("MCP-C02 preserves NUL porcelain filenames and rename destination", () => {
    const entries = parseGitStatusPorcelain("?? notes -> plan.md\0 M 中文.txt\0R  new\nname.txt\0old name.txt\0");
    expect(entries.map(entry => entry.path)).toEqual(["notes -> plan.md", "中文.txt", "new\nname.txt"]);
  });
  it("MCP-C02 real Git rename includes the original tracked owner in preflight", async () => {
    const git = (...args: string[]) => execFileSync("git", args, { cwd: root, windowsHide: true, stdio: "pipe" });
    git("init", "-q"); git("config", "user.name", "Fixture"); git("config", "user.email", "fixture@example.invalid");
    const original = process.platform === "win32" ? "src/old 中文.ts" : "src/old -> 中文.ts";
    write(original, "export const a = 1;\n"); git("add", "--", original); git("commit", "-qm", "fixture");
    git("mv", "--", original, "src/new 中文.ts");
    write(".agents/memory/a/MEMORY.md", card.replace("staleness: 0", "staleness: 0\ndependencies: [base]").replace("src/a.ts", original));
    write(".cartridge/index.json", JSON.stringify({ cartridges: { a: { skillPath: ".agents/memory/a/MEMORY.md", dependencies: ["base"], trackedFiles: [original] } }, fileMap: { [original]: ["a"] }, untrackedFiles: [] }));
    const result = envelope(await handleCommitPreflight({ projectRoot: root }));
    expect(result.summary.summary.git.files).toEqual(expect.arrayContaining([expect.objectContaining({ path: "src/new 中文.ts", originalPath: original })]));
    expect(result.summary.summary.dependencySemantics.modules).toEqual(expect.arrayContaining([expect.objectContaining({ module: "a", codes: expect.arrayContaining(["DEPENDENCY_REASON_MISSING"]) })]));
  });
  it("MCP-C03 publishes integer maxCards and shared ID/approval constraints", () => {
    const graph = findToolDefinition("memory_graph")!;
    expect(graph.inputSchema.properties.maxCards).toMatchObject({ type: "integer", minimum: 1, maximum: 200 });
    expect(graph.inputSchema.properties.focusModule).toMatchObject({ type: "string", minLength: 1, pattern: expect.any(String) });
    expect(findToolDefinition("memory_commit")!.inputSchema.properties.confirm).toMatchObject({ const: true });
  });
});
