import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerAllTools } from "../mcpServer/tools";

function writeFile(root: string, relativePath: string, content: string): void {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, "utf8");
}

function textOf(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content.map((c) => c.text ?? "").join("\n");
}

suite("MCP server tools", () => {
  let tempDir: string;
  let client: Client;

  setup(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "specmesh-mcp-"));
    writeFile(
      tempDir,
      ".specmesh.yml",
      ["track:", "  - type: doc", "    label: Docs", "    glob: docs/*.md"].join("\n")
    );
    writeFile(tempDir, "docs/charter.md", "# Charter\n\nSee [missing](./missing.md).\n");

    const server = new McpServer({ name: "specmesh-test", version: "0.0.0" });
    registerAllTools(server, [{ name: "root", path: tempDir }]);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test-client", version: "0.0.0" });

    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  });

  teardown(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test("lists all 8 tools", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();

    assert.deepEqual(names, [
      "specmesh_find_broken_links",
      "specmesh_find_missing_docs",
      "specmesh_find_orphans",
      "specmesh_get_doc_links",
      "specmesh_get_help",
      "specmesh_list_docs",
      "specmesh_list_repos",
      "specmesh_update_track_entry",
    ]);
  });

  test("specmesh_list_docs finds the tracked doc", async () => {
    const result = await client.callTool({ name: "specmesh_list_docs", arguments: {} });
    assert.match(textOf(result as never), /Charter/);
  });

  test("specmesh_find_broken_links reports the broken link", async () => {
    const result = await client.callTool({ name: "specmesh_find_broken_links", arguments: {} });
    assert.match(textOf(result as never), /missing\.md/);
  });

  test("specmesh_get_doc_links lists the doc's outgoing link", async () => {
    const result = await client.callTool({ name: "specmesh_get_doc_links", arguments: { path: "docs/charter.md" } });
    assert.match(textOf(result as never), /BROKEN/);
  });

  test("specmesh_list_repos reports no declared repos", async () => {
    const result = await client.callTool({ name: "specmesh_list_repos", arguments: {} });
    assert.match(textOf(result as never), /No repos declared/);
  });

  test("specmesh_find_orphans and specmesh_find_missing_docs run without error", async () => {
    const orphans = await client.callTool({ name: "specmesh_find_orphans", arguments: {} });
    const missing = await client.callTool({ name: "specmesh_find_missing_docs", arguments: {} });
    assert.equal(typeof textOf(orphans as never), "string");
    assert.equal(typeof textOf(missing as never), "string");
  });

  test("specmesh_get_help returns this package's README", async () => {
    const result = await client.callTool({ name: "specmesh_get_help", arguments: {} });
    assert.match(textOf(result as never), /specmesh/i);
  });

  test("specmesh_update_track_entry adds a new entry and persists it to .specmesh.yml", async () => {
    const result = await client.callTool({
      name: "specmesh_update_track_entry",
      arguments: { folder: "root", type: "readme", label: "Readme", glob: "README.md" },
    });

    assert.match(textOf(result as never), /Updated root\/\.specmesh\.yml/);
    const written = fs.readFileSync(path.join(tempDir, ".specmesh.yml"), "utf8");
    assert.match(written, /type: readme/);
  });
});
