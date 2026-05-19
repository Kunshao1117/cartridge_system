export type ToolRiskLevel = "low" | "medium" | "high";
export type ToolCapabilityLevel = "read" | "analyze" | "governance" | "write";

export interface CartridgeToolDefinition {
  name: string;
  description: string;
  safetySummary: string;
  risk: ToolRiskLevel;
  capability: ToolCapabilityLevel;
  readOnly: boolean;
  requiresExplicitApproval: boolean;
  safeForStartup: boolean;
  expectedLatency: "fast" | "medium" | "slow";
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

const projectRootProperty = {
  type: "string",
  description:
    "目標專案的根目錄絕對路徑；Gateway workspace 或 CLI --workspace 會自動補入，舊客戶端可手動傳入。",
};

const moduleNameProperty = {
  type: "string",
  description: "記憶卡匣名稱",
};

const projectRootSchema = {
  type: "object" as const,
  properties: {
    projectRoot: projectRootProperty,
  },
  required: [],
};

const moduleProjectRootSchema = {
  type: "object" as const,
  properties: {
    moduleName: moduleNameProperty,
    projectRoot: projectRootProperty,
  },
  required: ["moduleName"],
};

const memoryCommitSchema = {
  type: "object" as const,
  properties: {
    moduleName: moduleNameProperty,
    projectRoot: projectRootProperty,
    confirm: {
      type: "boolean",
      description:
        "確認已完成 SKILL.md 內容寫入，並允許同步記憶卡後設資料。",
    },
  },
  required: ["moduleName", "confirm"],
};

const memoryGraphSchema = {
  type: "object" as const,
  properties: {
    projectRoot: projectRootProperty,
    lens: {
      type: "string",
      enum: ["maintenance", "memory", "structure", "all"],
      description: "圖譜視角；all 會回傳全部連線類型。",
    },
    focusModule: {
      type: "string",
      description: "可選，限制為指定卡匣與一跳上下游關聯。",
    },
    maxCards: {
      type: "number",
      minimum: 1,
      maximum: 200,
      description: "最多回傳的卡匣數量，預設 80。",
    },
  },
  required: [],
};

const contextDiffSchema = {
  type: "object" as const,
  properties: {
    projectRoot: projectRootProperty,
    leftId: {
      type: "string",
      description: "左側 context asset id，例如 codex.agents",
    },
    rightId: {
      type: "string",
      description: "右側 context asset id，例如 claude.project",
    },
  },
  required: ["leftId", "rightId"],
};

export const CARTRIDGE_TOOLS: CartridgeToolDefinition[] = [
  {
    name: "memory_list",
    description: "列出指定專案中所有已被系統追蹤的記憶卡匣清單。",
    safetySummary: "只讀清單查詢，適合 AI 開工時快速確認有哪些記憶卡。",
    risk: "low",
    capability: "read",
    readOnly: true,
    requiresExplicitApproval: false,
    safeForStartup: true,
    expectedLatency: "fast",
    inputSchema: projectRootSchema,
  },
  {
    name: "memory_read",
    description: "讀取指定專案中特定記憶卡匣模組的完整內容。",
    safetySummary: "只讀單卡內容，適合在修改相關檔案前讀取。",
    risk: "low",
    capability: "read",
    readOnly: true,
    requiresExplicitApproval: false,
    safeForStartup: true,
    expectedLatency: "fast",
    inputSchema: moduleProjectRootSchema,
  },
  {
    name: "memory_status",
    description:
      "查詢指定記憶卡匣的過期修復診斷資訊，包含過期指數、異動檔案清單與修復行動指引。",
    safetySummary: "只讀診斷，不會修改記憶卡；適合查看單張卡為什麼亮警告。",
    risk: "low",
    capability: "analyze",
    readOnly: true,
    requiresExplicitApproval: false,
    safeForStartup: true,
    expectedLatency: "fast",
    inputSchema: moduleProjectRootSchema,
  },
  {
    name: "memory_commit",
    description:
      "在 AI 已寫入 SKILL.md 後同步後設資料：時間戳、staleness、索引與結構驗證。此工具會寫入檔案。",
    safetySummary: "會寫入記憶卡後設資料，必須在使用者或流程確認後帶 confirm:true。",
    risk: "high",
    capability: "write",
    readOnly: false,
    requiresExplicitApproval: true,
    safeForStartup: false,
    expectedLatency: "medium",
    inputSchema: memoryCommitSchema,
  },
  {
    name: "memory_deps",
    description:
      "查詢指定記憶卡匣的依賴拓樸，包含上游依賴、下游被依賴者與間接過期指數。",
    safetySummary: "只讀依賴查詢，適合分析某張記憶卡變更會影響誰。",
    risk: "medium",
    capability: "analyze",
    readOnly: true,
    requiresExplicitApproval: false,
    safeForStartup: true,
    expectedLatency: "fast",
    inputSchema: moduleProjectRootSchema,
  },
  {
    name: "memory_graph",
    description: "輸出 AI 可讀的整體記憶卡匣關聯圖譜摘要。",
    safetySummary: "只讀圖譜摘要，不讀完整 SKILL.md 原文，不修改記憶卡。",
    risk: "low",
    capability: "analyze",
    readOnly: true,
    requiresExplicitApproval: false,
    safeForStartup: true,
    expectedLatency: "fast",
    inputSchema: memoryGraphSchema,
  },
  {
    name: "memory_audit",
    description:
      "完整健檢專案記憶卡系統，回報舊格式相容、frontmatter、Tracked Files、索引與依賴語義問題。",
    safetySummary: "只讀深度健檢，不會修檔；適合在側邊欄有多個提醒時使用。",
    risk: "medium",
    capability: "governance",
    readOnly: true,
    requiresExplicitApproval: false,
    safeForStartup: false,
    expectedLatency: "medium",
    inputSchema: projectRootSchema,
  },
  {
    name: "workspace_brief",
    description:
      "彙整 AI 開工狀態：專案身份、記憶卡健康、規則檔提醒與下一步工具。",
    safetySummary: "只讀開工檢查，適合每次 AI 進入專案時先呼叫。",
    risk: "low",
    capability: "governance",
    readOnly: true,
    requiresExplicitApproval: false,
    safeForStartup: true,
    expectedLatency: "fast",
    inputSchema: projectRootSchema,
  },
  {
    name: "commit_preflight",
    description:
      "提交前治理檢查：彙整 git dirty state、記憶卡健康狀態、阻塞原因與建議提交前動作。",
    safetySummary: "只讀提交前檢查，不會 stage 或 commit；適合準備封存前使用。",
    risk: "low",
    capability: "governance",
    readOnly: true,
    requiresExplicitApproval: false,
    safeForStartup: false,
    expectedLatency: "medium",
    inputSchema: projectRootSchema,
  },
  {
    name: "context_inventory",
    description:
      "規則檔清冊：掃描 Codex、Claude、Copilot、Antigravity 與記憶卡規則來源。",
    safetySummary: "只讀檔案清冊，適合確認專案有哪些 AI 規則檔。",
    risk: "low",
    capability: "governance",
    readOnly: true,
    requiresExplicitApproval: false,
    safeForStartup: true,
    expectedLatency: "fast",
    inputSchema: projectRootSchema,
  },
  {
    name: "context_audit",
    description:
      "規則檔檢查：偵測指令檔、技能、子代理與記憶卡之間的衝突、過期與重複提醒。",
    safetySummary: "只讀規則檢查，不會修改 AGENTS.md、CLAUDE.md 或記憶卡。",
    risk: "medium",
    capability: "governance",
    readOnly: true,
    requiresExplicitApproval: false,
    safeForStartup: true,
    expectedLatency: "medium",
    inputSchema: projectRootSchema,
  },
  {
    name: "context_diff",
    description:
      "規則檔差異比對：比較兩個規則來源的適用代理、優先序與治理訊號。",
    safetySummary: "只讀比對工具，適合定位兩個規則檔哪裡說法不同。",
    risk: "low",
    capability: "analyze",
    readOnly: true,
    requiresExplicitApproval: false,
    safeForStartup: false,
    expectedLatency: "fast",
    inputSchema: contextDiffSchema,
  },
  {
    name: "context_plan",
    description:
      "規則檔整理建議：根據規則檔檢查產出只讀升級建議，不執行自動修復。",
    safetySummary: "只讀建議工具，不會寫入或自動修復任何規則檔。",
    risk: "low",
    capability: "governance",
    readOnly: true,
    requiresExplicitApproval: false,
    safeForStartup: false,
    expectedLatency: "medium",
    inputSchema: projectRootSchema,
  },
];

export function findToolDefinition(
  name: string,
): CartridgeToolDefinition | undefined {
  return CARTRIDGE_TOOLS.find((tool) => tool.name === name);
}
