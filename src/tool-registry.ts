export type ToolRiskLevel = "low" | "medium" | "high";
export type ToolCapabilityLevel = "read" | "analyze" | "governance" | "write";

export interface CartridgeToolDefinition {
  name: string;
  description: string;
  risk: ToolRiskLevel;
  capability: ToolCapabilityLevel;
  readOnly: boolean;
  requiresExplicitApproval: boolean;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

const projectRootProperty = {
  type: "string",
  description: "目標專案的根目錄絕對路徑",
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
  required: ["projectRoot"],
};

const moduleProjectRootSchema = {
  type: "object" as const,
  properties: {
    moduleName: moduleNameProperty,
    projectRoot: projectRootProperty,
  },
  required: ["moduleName", "projectRoot"],
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
  required: ["moduleName", "projectRoot", "confirm"],
};

export const CARTRIDGE_TOOLS: CartridgeToolDefinition[] = [
  {
    name: "memory_list",
    description: "列出指定專案中所有已被系統追蹤的記憶卡匣清單。",
    risk: "low",
    capability: "read",
    readOnly: true,
    requiresExplicitApproval: false,
    inputSchema: projectRootSchema,
  },
  {
    name: "memory_read",
    description: "讀取指定專案中特定記憶卡匣模組的完整內容。",
    risk: "low",
    capability: "read",
    readOnly: true,
    requiresExplicitApproval: false,
    inputSchema: moduleProjectRootSchema,
  },
  {
    name: "memory_status",
    description:
      "查詢指定記憶卡匣的過期修復診斷資訊，包含過期指數、異動檔案清單與修復行動指引。",
    risk: "low",
    capability: "analyze",
    readOnly: true,
    requiresExplicitApproval: false,
    inputSchema: moduleProjectRootSchema,
  },
  {
    name: "memory_commit",
    description:
      "在 AI 已寫入 SKILL.md 後同步後設資料：時間戳、staleness、索引與結構驗證。此工具會寫入檔案。",
    risk: "high",
    capability: "write",
    readOnly: false,
    requiresExplicitApproval: true,
    inputSchema: memoryCommitSchema,
  },
  {
    name: "memory_deps",
    description:
      "查詢指定記憶卡匣的依賴拓樸，包含上游依賴、下游被依賴者與間接過期指數。",
    risk: "medium",
    capability: "analyze",
    readOnly: true,
    requiresExplicitApproval: false,
    inputSchema: moduleProjectRootSchema,
  },
  {
    name: "memory_audit",
    description:
      "完整健檢專案記憶卡系統，回報舊格式相容、frontmatter、Tracked Files、索引與依賴語義問題。",
    risk: "medium",
    capability: "governance",
    readOnly: true,
    requiresExplicitApproval: false,
    inputSchema: projectRootSchema,
  },
  {
    name: "workspace_brief",
    description:
      "彙整專案治理狀態：專案身份、記憶卡健康、stale/ghost/untracked 狀態與建議下一步。",
    risk: "low",
    capability: "governance",
    readOnly: true,
    requiresExplicitApproval: false,
    inputSchema: projectRootSchema,
  },
  {
    name: "commit_preflight",
    description:
      "提交前治理檢查：彙整 git dirty state、記憶卡健康狀態、阻塞原因與建議提交前動作。",
    risk: "low",
    capability: "governance",
    readOnly: true,
    requiresExplicitApproval: false,
    inputSchema: projectRootSchema,
  },
];

export function findToolDefinition(
  name: string,
): CartridgeToolDefinition | undefined {
  return CARTRIDGE_TOOLS.find((tool) => tool.name === name);
}
