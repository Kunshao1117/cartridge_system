import { assertPathInsideProject } from "./file-containment.js";

/** Defer path validation until command execution, rather than TreeItem creation. */
export function projectFileOpenCommand(projectRoot: string, targetPath: string, title: string) {
  return {
    command: "cartridge.openProjectFile",
    title,
    arguments: [projectRoot, targetPath],
  };
}

/** Shared by the registered VS Code command; check immediately before host I/O. */
export async function openProjectFile(
  projectRoot: string,
  targetPath: string,
  open: (absolutePath: string) => PromiseLike<unknown>,
): Promise<void> {
  await open(assertPathInsideProject(projectRoot, targetPath));
}
