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
  for (const asset of assets) {
    const parseError = asset.signals.includes("context:parse-error");
    const readError = asset.signals.includes("context:read-error");
    if (parseError || readError) {
      findings.push({
        severity: "error",
        code: parseError ? "context_asset_parse_error" : "context_asset_read_error",
        message: parseError ? "上下文資產無法解析。" : "上下文資產無法讀取。",
        explanation: "已保留資產路徑供診斷，但不將其內容、追蹤檔案或治理宣告視為現行依據；其他資產仍可獨立讀取。",
        assets: [asset.id],
        paths: [asset.path],
        blocking: true,
        recommendedTool: "context_audit",
        recommendedAction: "確認此檔案的可讀性與 frontmatter 格式後重新檢查。",
      });
    }
    if (asset.type !== "memory" || !asset.mainFile) continue;
    const conflict = asset.mainFile.type === "conflict";
    const missing = asset.mainFile.type === "missing";
    if (!conflict && !missing) continue;
    findings.push({
      severity: "error",
      code: conflict ? "context_memory_main_file_conflict" : "context_memory_main_file_missing",
      message: conflict ? "記憶卡同時存在兩個主檔，尚未選定作用中主檔。" : "記憶目錄有子卡，但缺少主檔。",
      explanation: conflict
        ? "MEMORY.md 與 legacy SKILL.md 並存；清冊不讀取任一候選作為現行內容。"
        : "子卡仍保留在清冊中；父卡目前沒有可讀取的主檔。",
      assets: [asset.id],
      paths: [...asset.mainFile.candidatePaths],
      blocking: true,
      recommendedTool: "memory_audit",
      recommendedAction: conflict
        ? "確認兩個候選主檔的內容與授權後再處理衝突，不自動選邊或遷移。"
        : "確認此目錄是否需要主卡；需要寫入時先取得適用授權。",
    });
  }
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
