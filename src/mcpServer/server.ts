#!/usr/bin/env node
import * as path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from "./tools";
import { WorkspaceRoot } from "../crawler/crawlNode";

/** Standalone MCP server entry point (FR-019): runs specmesh's doc-graph tools outside any VS Code extension
 * host, over stdio, for MCP-capable agent harnesses that aren't VS Code Copilot Chat. Root folders are given
 * as CLI args, each either a bare path (name defaults to its basename) or `path=name`. */
function parseRoots(args: string[]): WorkspaceRoot[] {
  if (args.length === 0) {
    throw new Error(
      "Usage: specmesh-mcp-server <path>[=<name>] [<path>[=<name>] ...]\n" +
        "At least one workspace root path is required, e.g.: specmesh-mcp-server ./my-repo"
    );
  }

  return args.map((arg) => {
    const eq = arg.indexOf("=");
    const rawPath = eq >= 0 ? arg.slice(0, eq) : arg;
    const name = eq >= 0 ? arg.slice(eq + 1) : path.basename(path.resolve(rawPath));
    return { name, path: path.resolve(rawPath) };
  });
}

async function main(): Promise<void> {
  const roots = parseRoots(process.argv.slice(2));

  const server = new McpServer({ name: "specmesh", version: "0.16.0" });
  registerAllTools(server, roots);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
