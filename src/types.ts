/**
 * 記憶卡匣外掛系統 — 共用型別定義
 */

/** 檔案異動事件類型 */
export type FileEventType = 'add' | 'change' | 'unlink'

/** 過期等級 */
export type StalenessLevel = 'healthy' | 'mild' | 'significant' | 'critical'

/** 單一卡匣的索引資料 */
export interface CartridgeEntry {
  /** 記憶技能檔案路徑（相對於專案根目錄） */
  skillPath: string
  /** 追蹤的檔案清單（相對路徑） */
  trackedFiles: string[]
  /** 過期衰退指數 */
  staleness: number
  /** 記憶卡最後更新時間 */
  lastUpdated: string
  /** 待處理的異動檔案 */
  pendingChanges: PendingChange[]
}

/** 待處理的異動紀錄 */
export interface PendingChange {
  /** 檔案路徑 */
  filePath: string
  /** 事件類型 */
  eventType: FileEventType
  /** 異動時間 */
  timestamp: string
}

/** 卡匣索引的完整結構 */
export interface CartridgeIndex {
  version: number
  lastScanned: string
  cartridges: Record<string, CartridgeEntry>
  /** 檔案→卡匣 反向映射 */
  fileMap: Record<string, string[]>
}

/** 注入器偵測結果 */
export type InjectionStatus = 'missing' | 'outdated' | 'match'

/** 注入器差異報告項目 */
export interface InjectionReportItem {
  /** 範本中的相對路徑 */
  templatePath: string
  /** 目標專案中的絕對路徑 */
  targetPath: string
  /** 處理狀態 */
  status: InjectionStatus
}

/** 外掛設定 */
export interface CartridgeConfig {
  /** 專案根目錄 */
  projectRoot: string
  /** 記憶卡匣技能目錄（相對路徑） */
  skillsDir: string
  /** 排除監聽的目錄 */
  excludeDirs: string[]
  /** 過期指數閾值設定 */
  thresholds: {
    /** 顯著過期閾值（植入橘色警報） */
    significant: number
    /** 嚴重過期閾值（植入紅色攔截警報） */
    critical: number
  }
  /** 過期計分權重 */
  scoring: {
    fileChanged: number
    fileDeleted: number
    fileAdded: number
    dailyDecay: number
  }
}
