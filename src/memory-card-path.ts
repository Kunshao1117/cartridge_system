import fs from "node:fs";
import path from "node:path";
import { assertPathInsideProject, PathContainmentError } from "./file-containment.js";
import type { CartridgeConfig } from "./types.js";

/** Filesystem authority comes from trusted configuration, never index metadata. */
export function assertMemoryCardPath(config: CartridgeConfig, candidate: string): string {
  const absolute = assertPathInsideProject(config.projectRoot, candidate);
  if (!["MEMORY.md", "SKILL.md"].includes(path.basename(absolute))) throw new PathContainmentError(candidate);
  const within = (root: string, legacy: boolean) => {
    const relative = path.relative(assertPathInsideProject(config.projectRoot, root), absolute);
    const parts = relative.split(path.sep);
    return parts.length >= 2 && !path.isAbsolute(relative) && !parts.includes("..") &&
      !parts.slice(0, -1).some(part => part.toLowerCase() === "archive") &&
      (!legacy || parts[0].startsWith("mem-"));
  };
  if (!within(config.memoryDir, false) && !within(config.skillsDir, true)) throw new PathContainmentError(candidate);
  const otherName = path.basename(absolute) === "MEMORY.md" ? "SKILL.md" : "MEMORY.md";
  const other = assertPathInsideProject(config.projectRoot, path.join(path.dirname(absolute), otherName));
  if (fs.existsSync(absolute) && fs.existsSync(other)) {
    throw new Error("MEMORY_MAIN_FILE_CONFLICT: resolve dual Memory main files before writing");
  }
  return absolute;
}
