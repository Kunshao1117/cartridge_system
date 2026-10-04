/** One data-only frontmatter boundary for all three shipped entry points. */
import grayMatter from "gray-matter";

type DataEngine = { parse: (input: string) => object; stringify: (data: object) => string };
// gray-matter's YAML engine uses js-yaml.safeLoad/safeDump (including Date support).
// Capture only the safe engine; never accept caller-provided parsers or options.
const yaml = { ...(grayMatter as typeof grayMatter & { engines: { yaml: DataEngine } }).engines.yaml };
const json: DataEngine = { parse: JSON.parse, stringify: (data) => JSON.stringify(data, null, 2) };
const dataEngines = { yaml, yml: yaml, json };
function rejectExecutableFrontmatter(): never {
  throw new Error("Executable frontmatter is not supported");
}
// gray-matter merges options with built-ins; shadow both executable names as a
// second barrier, even if a future delimiter/normalization change misses a header.
const engines = { ...dataEngines,
  javascript: { parse: rejectExecutableFrontmatter, stringify: rejectExecutableFrontmatter },
  js: { parse: rejectExecutableFrontmatter, stringify: rejectExecutableFrontmatter },
};

function checkedInput(input: string): string {
  const text = input.replace(/^\uFEFF+/, "");
  if (!text.startsWith("---") || text[3] === "-") return text;
  const end = text.indexOf("\n");
  const header = text.slice(3, end < 0 ? undefined : end).trim();
  if (header && !Object.prototype.hasOwnProperty.call(dataEngines, header)) {
    throw new Error(`Unsupported frontmatter language: ${header}`);
  }
  return text;
}

function parse(input: string) {
  const parsed = grayMatter(checkedInput(input), { language: "yaml", engines });
  if (!parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) {
    throw new Error("Frontmatter must be a data object");
  }
  assertFiniteDataGraph(parsed.data);
  // Do not expose gray-matter's attached stringify/read/language helpers.
  return { data: parsed.data, content: parsed.content };
}

function stringify(content: string, data: object, original?: string): string {
  // Serialize data directly: gray-matter.stringify reparses string bodies and
  // its object form copies data through Object.assign({}, data), losing an own
  // __proto__ field. Neither behavior belongs at this data-only boundary.
  assertFiniteDataGraph(data);
  const header = yaml.stringify(data).trim();
  const body = content.endsWith("\n") ? content : `${content}\n`;
  let output = (header === "{}" ? "" : `---\n${header}\n---\n`) + body;
  if (original?.includes("\r\n")) output = output.replace(/\r?\n/g, "\r\n");
  const bom = original?.match(/^\uFEFF+/)?.[0] ?? "";
  if (bom) output = bom + output;
  return output;
}

export default Object.assign(parse, { stringify });

/** YAML aliases may share values, but recursive graphs cannot be fingerprinted
 * or persisted. Check before exposing data and bound repeated alias expansion. */
function assertFiniteDataGraph(data: object): void {
  const ancestors = new Set<object>();
  const stack: Array<{ value: unknown; exit?: boolean; depth: number }> = [{ value: data, depth: 0 }];
  let visited = 0;
  while (stack.length) {
    const { value, exit, depth } = stack.pop()!;
    if (value === null || typeof value !== "object" || value instanceof Date) continue;
    if (exit) { ancestors.delete(value); continue; }
    if (ancestors.has(value)) throw new Error("Cyclic/recursive frontmatter aliases are not supported.");
    if (++visited > 10000 || depth > 100) throw new Error("Frontmatter data exceeds safe structural limits.");
    ancestors.add(value);
    stack.push({ value, exit: true, depth });
    for (const child of Object.values(value)) stack.push({ value: child, depth: depth + 1 });
  }
}
