/** One data-only frontmatter boundary for all three shipped entry points. */
import grayMatter from "gray-matter";

type DataEngine = { parse: (input: string) => object; stringify: (data: object) => string };
// gray-matter's YAML engine uses js-yaml.safeLoad/safeDump (including Date support).
// Capture only the safe engine; never accept caller-provided parsers or options.
const yaml = { ...(grayMatter as typeof grayMatter & { engines: { yaml: DataEngine } }).engines.yaml };
const json: DataEngine = { parse: JSON.parse, stringify: (data) => JSON.stringify(data, null, 2) };
const engines = { yaml, yml: yaml, json };

function checkedInput(input: string): string {
  const text = input.replace(/^\uFEFF/, "");
  if (!text.startsWith("---") || text[3] === "-") return text;
  const end = text.indexOf("\n");
  const header = text.slice(3, end < 0 ? undefined : end).trim();
  if (header && !Object.prototype.hasOwnProperty.call(engines, header)) {
    throw new Error(`Unsupported frontmatter language: ${header}`);
  }
  return text;
}

function parse(input: string) {
  const parsed = grayMatter(checkedInput(input), { language: "yaml", engines });
  if (!parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) {
    throw new Error("Frontmatter must be a data object");
  }
  // Do not expose gray-matter's attached stringify/read/language helpers.
  return { data: parsed.data, content: parsed.content };
}

function stringify(content: string, data: object, original?: string): string {
  // Object form is important: string form reparses a possible second frontmatter
  // block at the start of the body, including gray-matter's JavaScript engine.
  let output = grayMatter.stringify({ content }, data, { language: "yaml", engines });
  if (original?.includes("\r\n")) output = output.replace(/\r?\n/g, "\r\n");
  if (original?.startsWith("\uFEFF")) output = `\uFEFF${output}`;
  return output;
}

export default Object.assign(parse, { stringify });
