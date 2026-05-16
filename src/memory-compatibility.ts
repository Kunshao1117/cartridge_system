export type CompatibilityMode = "modern" | "compatibility";

export interface CompatibilityWarning {
  code: string;
  message: string;
  target: string;
}

export interface CompatibilityReport {
  mode: CompatibilityMode;
  warnings: CompatibilityWarning[];
}

interface CompatibilityIndexEntry {
  ghostFiles?: unknown[];
  dependencies?: unknown[];
  indirectStaleness?: unknown;
}

interface CompatibilityIndex {
  cartridges?: Record<string, CompatibilityIndexEntry>;
  fileMap?: Record<string, unknown>;
  untrackedFiles?: unknown[];
}

const REQUIRED_ENTRY_FIELDS = [
  "ghostFiles",
  "dependencies",
  "indirectStaleness",
] as const;

export function buildCompatibilityReport(
  index: CompatibilityIndex,
  options: { indexAvailable?: boolean } = {},
): CompatibilityReport {
  const warnings: CompatibilityWarning[] = [];

  if (options.indexAvailable === false) {
    warnings.push({
      code: "INDEX_MISSING",
      target: ".cartridge/index.json",
      message:
        "找不到 .cartridge/index.json，目前只能進入舊專案相容模式，建議先執行 memory_audit。",
    });
  }

  if (!index.cartridges || typeof index.cartridges !== "object") {
    warnings.push({
      code: "INDEX_CARTRIDGES_MISSING",
      target: ".cartridge/index.json",
      message: "索引缺少 cartridges，記憶卡健康摘要可能不完整。",
    });
  }

  if (!index.fileMap || typeof index.fileMap !== "object") {
    warnings.push({
      code: "INDEX_FILEMAP_MISSING",
      target: ".cartridge/index.json",
      message: "索引缺少 fileMap，無法完整判斷檔案歸屬。",
    });
  }

  if (!Array.isArray(index.untrackedFiles)) {
    warnings.push({
      code: "INDEX_UNTRACKED_MISSING",
      target: ".cartridge/index.json",
      message: "索引缺少 untrackedFiles，可能是舊索引格式。",
    });
  }

  for (const [moduleName, entry] of Object.entries(index.cartridges ?? {})) {
    for (const field of REQUIRED_ENTRY_FIELDS) {
      if (!(field in entry)) {
        warnings.push({
          code: "INDEX_ENTRY_FIELD_MISSING",
          target: moduleName,
          message: `${moduleName} 索引缺少 ${field}，建議執行 memory_audit 確認舊格式影響。`,
        });
      }
    }
  }

  return {
    mode: warnings.length > 0 ? "compatibility" : "modern",
    warnings,
  };
}
