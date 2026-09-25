import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/** Spawns the real compiled `out/mcpServer/server.js` as a genuinely separate `node` process (not the
 * Extension Development Host `npm test` otherwise always runs in) and talks to it over its real stdio
 * transport. This is the only test in the suite that can catch a transitive `vscode` import creeping back
 * into any module the standalone server depends on -- every other test here runs inside a real extension
 * host, where `require("vscode")` always resolves fine even if it shouldn't have been reachable at all. */
suite("standalone MCP server subprocess", () => {
  let tempDir: string;
  let client: Client;
  let transport: StdioClientTransport;

  setup(async function () {
    this.timeout(10000);
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "specmesh-mcp-subprocess-"));
    fs.writeFileSync(
      path.join(tempDir, ".specmesh.yml"),
      ["track:", "  - type: doc", "    label: Docs", "    glob: docs/*.md"].join("\n"),
      "utf8"
    );
    fs.mkdirSync(path.join(tempDir, "docs"), { recursive: true });
    fs.writeFileSync(path.join(tempDir, "docs", "charter.md"), "# Charter\n", "utf8");

    const serverScript = path.join(__dirname, "..", "mcpServer", "server.js");
    // "node", not process.execPath: inside the Extension Development Host that ADR-001 runs tests in,
    // process.execPath is the Electron/VS Code binary, not a real node executable, and spawning it directly
    // hangs instead of running the script. Relying on "node" via PATH also matches how a real MCP host config
    // would invoke this server.
    transport = new StdioClientTransport({ command: "node", args: [serverScript, tempDir] });
    client = new Client({ name: "test-subprocess-client", version: "0.0.0" });
    await client.connect(transport);
  });

  teardown(async function () {
    this.timeout(10000);
    await client.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("lists all 8 tools from the real, standalone (non-VS-Code) process", async () => {
    const { tools } = await client.listTools();
    assert.equal(tools.length, 8);
  });

  test("specmesh_list_docs finds the tracked doc when run standalone", async () => {
    const result = await client.callTool({ name: "specmesh_list_docs", arguments: {} });
    const content = (result as { content: Array<{ text?: string }> }).content;
    const text = content.map((c) => c.text ?? "").join("\n");
    assert.match(text, /Charter/);
  });
});
