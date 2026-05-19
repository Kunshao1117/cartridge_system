import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const packageJsonPath = resolve(root, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const defaultOutputPath = resolve(
  root,
  `${packageJson.name}-${packageJson.version}.vsix`,
);
const packageArgs = process.argv.slice(2);
const hasExplicitOutput = packageArgs.some(
  (arg) => arg === "--out" || arg === "-o" || arg.startsWith("--out="),
);

if (!Array.isArray(packageJson.files)) {
  throw new Error("package.json files whitelist is required for VSIX packaging.");
}

if (!hasExplicitOutput && existsSync(defaultOutputPath)) {
  unlinkSync(defaultOutputPath);
}

const vsceCliPath = resolve(root, "node_modules", "@vscode", "vsce", "vsce");
const result = spawnSync(
  process.execPath,
  [vsceCliPath, "package", ...packageArgs],
  { stdio: "inherit" },
);

if (result.error) {
  throw result.error;
}
process.exitCode = typeof result.status === "number" ? result.status : 1;
