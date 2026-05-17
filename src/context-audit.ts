import type {
  ContextAsset,
  ContextAuditFinding,
  ContextInventory,
} from "./context-types.js";

function existingWithSignal(
  assets: ContextAsset[],
  signal: string,
): ContextAsset[] {
  return assets.filter((asset) => asset.exists && asset.signals.includes(signal));
}

function finding(args: {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  explanation: string;
  assets: ContextAsset[];
  recommendedTool?: string;
  recommendedAction?: string;
}): ContextAuditFinding {
  return {
    severity: args.severity,
    code: args.code,
    message: args.message,
    explanation: args.explanation,
    assets: args.assets.map((asset) => asset.id),
    paths: args.assets.filter((asset) => asset.exists).map((asset) => asset.path),
    blocking: args.severity === "error",
    recommendedTool: args.recommendedTool,
    recommendedAction: args.recommendedAction,
  };
}

export function auditContextInventory(
  inventory: ContextInventory,
): ContextAuditFinding[] {
  const findings: ContextAuditFinding[] = [];
  const assets = inventory.assets;
  const codex = assets.find((asset) => asset.id === "codex.agents");
  const claude = assets.find((asset) => asset.id === "claude.project");

  if (!codex?.exists && !claude?.exists && inventory.totals.existing > 0) {
    findings.push({
      severity: "warning",
      code: "primary_instruction_missing",
      message: "缺少主要 AI 規則檔。",
      explanation:
        "目前找得到一些技能或記憶卡，但沒有 AGENTS.md 或 CLAUDE.md 這類專案入口規則，AI 開工時比較難先讀到總規則。",
      assets: [],
      paths: [],
      blocking: false,
      recommendedTool: "context_inventory",
      recommendedAction: "新增或確認專案主要規則檔的位置。",
    });
  }

  const zhAssets = existingWithSignal(assets, "language:zh-TW");
  const enAssets = existingWithSignal(assets, "language:en-only");
  if (zhAssets.length > 0 && enAssets.length > 0) {
    findings.push(
      finding({
        severity: "warning",
        code: "context_language_conflict",
        message: "不同規則檔對回覆語言的要求不一致。",
        explanation:
          "有些規則要求繁體中文，有些規則要求只用英文。這通常不會阻止開工，但可能讓不同 AI 回覆風格不一致。",
        assets: [...zhAssets, ...enAssets],
        recommendedTool: "context_diff",
        recommendedAction: "比對相關規則檔，保留真正需要的語言規則。",
      }),
    );
  }

  const guardedCommit = existingWithSignal(
    assets,
    "commit:requires-explicit-approval",
  );
  const autoCommit = existingWithSignal(assets, "commit:auto-allowed");
  if (guardedCommit.length > 0 && autoCommit.length > 0) {
    findings.push(
      finding({
        severity: "error",
        code: "context_commit_policy_conflict",
        message: "提交規則互相衝突。",
        explanation:
          "有些規則要求等使用者明確授權才提交，但另一些規則允許自動提交。這會影響版本控制安全，所以列為阻塞。",
        assets: [...guardedCommit, ...autoCommit],
        recommendedTool: "context_diff",
        recommendedAction: "統一提交規則，預設保留明確授權後才提交。",
      }),
    );
  }

  const guardedWrite = existingWithSignal(assets, "write:requires-confirm");
  const autoWrite = existingWithSignal(assets, "write:auto-allowed");
  if (guardedWrite.length > 0 && autoWrite.length > 0) {
    findings.push(
      finding({
        severity: "error",
        code: "context_write_policy_conflict",
        message: "寫入規則互相衝突。",
        explanation:
          "有些規則要求寫入前確認，但另一些規則允許自動覆寫。這可能造成誤寫重要規則檔，所以列為阻塞。",
        assets: [...guardedWrite, ...autoWrite],
        recommendedTool: "context_diff",
        recommendedAction: "統一寫入規則，保留需要確認的安全邊界。",
      }),
    );
  }

  if (zhAssets.length > 1) {
    findings.push(
      finding({
        severity: "info",
        code: "context_rule_duplicate",
        message: "繁體中文回覆規則出現在多個檔案。",
        explanation:
          "這通常只是重複提醒，不一定需要處理；只有當不同檔案說法互相矛盾時才需要調整。",
        assets: zhAssets,
        recommendedTool: "context_inventory",
        recommendedAction: "確認重複規則是否刻意保留。",
      }),
    );
  }

  return findings;
}

export function summarizeContextReadiness(findings: ContextAuditFinding[]) {
  const blocking = findings.filter((item) => item.severity === "error");
  const warnings = findings.filter((item) => item.severity === "warning");
  const status =
    blocking.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready";
  return {
    status: status as "ready" | "warning" | "blocked",
    blockers: blocking.length,
    warnings: warnings.length,
    informational: findings.filter((item) => item.severity === "info").length,
  };
}
