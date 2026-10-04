// Real packaged MCP transport regression, using isolated fixture data only.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "cartridge-mcp-bundle-"));
const root = path.join(sandbox, "project");
const marker = path.join(sandbox, "execution-marker");
function write(relative, content) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}
write(".agents/memory/safe/MEMORY.md", "---\nname: safe\ndescription: SAFE_BUNDLE_SENTINEL\n---\n# Safe\n");
fs.writeFileSync(path.join(sandbox, "outside.md"), "OUTSIDE_BUNDLE_SENTINEL");
write(".cartridge/index.json", JSON.stringify({ cartridges: { poison: { skillPath: "../outside.md" } } }));
for (const language of ["js", "javascript"]) {
  write(`.agents/memory/mal-${language}/MEMORY.md`, `---${language}\n({ name: (require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'executed'), 'bad') })\n---\n# body\n`);
}

async function checkServer(number) {
  const client = new Client({ name: `security-smoke-${number}`, version: "1.0.0" });
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.resolve("dist/mcp-server.js"), "--workspace", root], stderr: "pipe" });
  try {
    await client.connect(transport);
    const read = async (moduleName) => {
      const result = await client.callTool({ name: "memory_read", arguments: { moduleName } });
      const block = result.content.find((item) => item.type === "text");
      assert.ok(block);
      return JSON.parse(block.text);
    };
    assert.match(JSON.stringify(await read("safe")), /SAFE_BUNDLE_SENTINEL/);
    for (const id of ["poison", "mal-js", "mal-javascript"]) {
      const result = await read(id);
      assert.equal(result.status, "error");
      assert.doesNotMatch(JSON.stringify(result), /OUTSIDE_BUNDLE_SENTINEL/);
    }
    assert.equal(fs.existsSync(marker), false);
  } finally {
    await client.close();
  }
}
try {
  await Promise.all([checkServer(1), checkServer(2)]);
  console.log("PASS: two independent packaged MCP stdio servers, safe read, poisoned index and inert JS frontmatter");
} finally {
  fs.rmSync(sandbox, { recursive: true, force: true });
}
