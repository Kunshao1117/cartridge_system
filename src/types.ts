/**
 * 記憶卡匣外掛系統 — 共用型別定義
 */

import type { MemoryCompactionMetrics } from "./memory-compaction.js";
import type {
  MemoryMainFileInfo,
  MemoryQualityReport,
  MemoryMainFileType,
  MemoryContentQualityStatus,
} from "./memory-main-file.js";

/** 檔案異動事件類型 */
export type FileEventType = "add" | "change" | "unlink";

/** 過期等級 */
export type StalenessLevel = "healthy" | "mild" | "significant" | "critical";

/** 單一卡匣的索引資料 */
export interface CartridgeEntry {
  /** 記憶技能檔案路徑（相對於專案根目錄） */
  skillPath: string;
  /** 作用中記憶主檔資訊（MEMORY.md / legacy SKILL.md / conflict / missing） */
  mainFile?: MemoryMainFileInfo;
  /** 作用中主檔型態，相容型扁平欄位 */
  mainFileType?: MemoryMainFileType;
  /** 內容品質判定 */
  contentQuality?: MemoryQualityReport;
  /** 內容品質狀態，相容型扁平欄位 */
  contentQualityStatus?: MemoryContentQualityStatus;
  /** 是否需要遷移或品質補齊 */
  migrationRequired?: boolean;
  /** 是否仍處於 legacy SKILL.md 相容模式 */
  legacyCompatibility?: boolean;
  /** 記憶卡描述（含繁體中文關鍵字，用於語意搜尋） */
  description: string;
  /** 追蹤的檔案清單（相對路徑） */
  trackedFiles: string[];
  /** 過期衰退指數 */
  staleness: number;
  /** 記憶卡最後更新時間 */
  lastUpdated: string;
  /** 待處理的異動檔案 */
  pendingChanges: PendingChange[];
  /** 記憶卡在樹中的深度（1=根層, 2=功能域, 3=子模組, 4=極限） */
  depth: number;
  /** 父記憶卡名稱（從目錄結構推導，非手動設定） */
  parent: string | null;
  /** 已追蹤但磁碟上不存在的幽靈檔案清單（由插件自動偵測） */
  ghostFiles: string[];
  /** 此卡匣依賴的其他卡匣 ID（系統自動推導 + AI 手動補充） */
  dependencies: string[];
  /** 因上游依賴過期而傳播的間接過期指數 */
  indirectStaleness: number;
  /** 記憶卡壓縮治理度量 */
  compaction?: MemoryCompactionMetrics;
}

/** 待處理的異動紀錄 */
export interface PendingChange {
  /** 檔案路徑 */
  filePath: string;
  /** 事件類型 */
  eventType: FileEventType;
  /** 異動時間 */
  timestamp: string;
}

/** 未歸屬檔案紀錄 */
export interface UntrackedFileEntry {
  /** 檔案相對路徑 */
  filePath: string;
  /** 建議歸屬的記憶卡識別碼（預留欄位，未來可擴充智慧分配演算法） */
  suggestedOwner: string | null;
  /** 首次偵測時間 */
  detectedAt: string;
  /** 最近一次事件類型 */
  lastEvent: FileEventType;
}

/** 卡匣索引的完整結構 */
export interface CartridgeIndex {
  version: number;
  lastScanned: string;
  cartridges: Record<string, CartridgeEntry>;
  /** 檔案→卡匣 反向映射 */
  fileMap: Record<string, string[]>;
  /** 未歸屬檔案池 */
  untrackedFiles: UntrackedFileEntry[];
}

/** 注入器偵測結果 */
export type InjectionStatus =
  | "missing"
  | "outdated"
  | "match"
  | "skipped"
  | "conflict";

/** 注入器差異報告項目 */
export interface InjectionReportItem {
  /** 範本中的相對路徑 */
  templatePath: string;
  /** 目標專案中的絕對路徑 */
  targetPath: string;
  /** 處理狀態 */
  status: InjectionStatus;
}

/** 外掛設定 */
export interface CartridgeConfig {
  /** 專案根目錄 */
  projectRoot: string;
  /** 操作技能目錄（相對路徑） */
  skillsDir: string;
  /** 記憶卡匣目錄（相對路徑，v4.0 路徑遷移） */
  memoryDir: string;
  /** 插件運行時狀態目錄（相對路徑） */
  cartridgeDir: string;
  /** 排除監聽的目錄 */
  excludeDirs: string[];
  /** 系統產物豁免清單（不觸發過期計算的檔案） */
  ignoreFiles: string[];
  /** 過期指數閾值設定 */
  thresholds: {
    /** 顯著過期閾值（植入橘色警報） */
    significant: number;
    /** 嚴重過期閾值（植入紅色攔截警報） */
    critical: number;
  };
  /** 過期計分權重 */
  scoring: {
    fileChanged: number;
    fileDeleted: number;
    fileAdded: number;
    dailyDecay: number;
  };
  /** 依賴過期傳播最大深度（預設 2） */
  dependencyDepth: number;
}

/** 注入器衝突處理策略 */
export type ConflictPolicy = "ask" | "alwaysUpdate" | "alwaysKeepMine";

/** 注入器狀態檔結構（.cartridge/injector.json） */
export interface InjectorState {
  version: number;
  settings: {
    conflictPolicy: ConflictPolicy;
  };
  deployedHashes: Record<string, string>;
}
