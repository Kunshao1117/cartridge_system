import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  handleProjectContextList,
  handleProjectContextRead,
  handleProjectContextStatus,
  handleProjectContextValidate,
} from "../project-context-tools.js";

let projectRoot: string;

beforeEach(async () => {
  projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-context-"));
});

afterEach(async () => {
  await fs.rm(projectRoot, { recursive: true, force: true });
});

async function writeFile(relativePath: string, content: string) {
  const fullPath = path.join(projectRoot, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf-8");
}

function card(args: {
  name: string;
  status: string;
  approval?: string;
  lastReviewed?: string;
  conflicts?: string;
}) {
  return `---
name: ${args.name}
description: Project context test card.
context_type: preference
scope: project
status: ${args.status}
confidence: high
last_reviewed: ${args.lastReviewed ?? "2026-05-29"}
approval: ${args.approval ?? "GO CONTEXT"}
sources: []
---

# ${args.name}

## Approved Context

- Approved item.

## Candidate Context

- Candidate item.

## Deprecated Context

- None.

## Conflicts

${args.conflicts ?? "- None."}

## Evidence

- Test evidence.

## Relations

- .agents/context/

## Promotion Notes

- None.
`;
}

function parseEnvelope(result: Awaited<ReturnType<typeof handleProjectContextList>>) {
  return JSON.parse(result.content[0].text);
}

describe("project context MCP tools", () => {
  it("應列出並讀取專案脈絡索引卡", async () => {
    await writeFile(".agents/context/_map/CONTEXT.md", card({ name: "context-map", status: "approved" }));

    const list = parseEnvelope(await handleProjectContextList({ projectRoot }));
    const read = parseEnvelope(
      await handleProjectContextRead({ projectRoot, target: "_map" }),
    );

    expect(list.status).toBe("ready");
    expect(list.summary.cards[0]).toEqual(
      expect.objectContaining({
        id: "_map",
        name: "context-map",
        status: "approved",
        contextType: "preference",
      }),
    );
    expect(read.summary.card.sections.approved).toContain("Approved item");
  });

  it("應驗證核准、衝突與過久候選脈絡", async () => {
    await writeFile(
      ".agents/context/missing-approval/CONTEXT.md",
      card({ name: "missing-approval", status: "approved", approval: "None" }),
    );
    await writeFile(
      ".agents/context/conflict/CONTEXT.md",
      card({ name: "conflict", status: "conflict", conflicts: "None." }),
    );
    await writeFile(
      ".agents/context/old-candidate/CONTEXT.md",
      card({
        name: "old-candidate",
        status: "candidate",
        lastReviewed: "2000-01-01",
      }),
    );
    await writeFile(".agents/memory/wrong/CONTEXT.md", card({ name: "wrong", status: "approved" }));

    const envelope = parseEnvelope(await handleProjectContextValidate({ projectRoot }));
    const codes = envelope.findings.map((finding: { code: string }) => finding.code);

    expect(envelope.status).toBe("warning");
    expect(codes).toContain("PROJECT_CONTEXT_APPROVAL_MISSING");
    expect(codes).toContain("PROJECT_CONTEXT_CONFLICT_DETAIL_MISSING");
    expect(codes).toContain("PROJECT_CONTEXT_CANDIDATE_STALE");
    expect(codes).toContain("PROJECT_CONTEXT_MISPLACED_IN_MEMORY");
  });

  it("狀態摘要應分清可用、候選與需決策脈絡", async () => {
    await writeFile(".agents/context/approved/CONTEXT.md", card({ name: "approved", status: "approved" }));
    await writeFile(".agents/context/candidate/CONTEXT.md", card({ name: "candidate", status: "candidate" }));
    await writeFile(
      ".agents/context/conflict/CONTEXT.md",
      card({ name: "conflict", status: "conflict", conflicts: "- Needs Director decision." }),
    );

    const envelope = parseEnvelope(await handleProjectContextStatus({ projectRoot }));

    expect(envelope.summary.totals.byStatus.approved).toBe(1);
    expect(envelope.summary.usage.approved).toEqual(["approved"]);
    expect(envelope.summary.usage.advisory).toEqual(["candidate"]);
    expect(envelope.summary.usage.requiresDecision).toEqual(["conflict"]);
    expect(envelope.recommendedActions[0]).toEqual(
      expect.objectContaining({ nextTool: "project_context_read", blocking: false }),
    );
  });

  it("讀取工具應拒絕路徑穿越 target", async () => {
    const result = await handleProjectContextRead({
      projectRoot,
      target: "../memory/_system/SKILL.md",
    });
    const envelope = parseEnvelope(result);

    expect(result.isError).toBe(true);
    expect(envelope.findings[0].code).toBe("project_context_read_failed");
  });
});
