#!/usr/bin/env node
import * as path from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from "./tools";
import { WorkspaceRoot } from "../crawler/crawlNode";
import { OAuthConfig } from "./auth";
import { startHttpServer } from "./httpTransport";

/** Standalone MCP server entry point (FR-019/FR-020): runs specmesh's doc-graph tools outside any VS Code
 * extension host, over stdio (default) or Streamable HTTP (`SPECMESH_MCP_TRANSPORT=http`), for MCP-capable
 * agent harnesses that aren't VS Code Copilot Chat. Root folders are given as CLI args, each either a bare
 * path (name defaults to its basename) or `path=name`. */
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

/** Reads the HTTP transport's OAuth resource-server config from env vars. Throws if a required var is
 * missing -- the HTTP transport is reachable off-machine, so it must never start unauthenticated. */
function oauthConfigFromEnv(): OAuthConfig {
  const issuer = process.env.SPECMESH_OAUTH_ISSUER;
  const jwksUrl = process.env.SPECMESH_OAUTH_JWKS_URL;
  const audience = process.env.SPECMESH_OAUTH_AUDIENCE;
  if (!issuer || !jwksUrl || !audience) {
    throw new Error(
      "SPECMESH_MCP_TRANSPORT=http requires SPECMESH_OAUTH_ISSUER, SPECMESH_OAUTH_JWKS_URL, and " +
        "SPECMESH_OAUTH_AUDIENCE to be set."
    );
  }
  return { issuer, jwksUrl, audience, requiredRole: process.env.SPECMESH_OAUTH_REQUIRED_ROLE || undefined };
}

async function main(): Promise<void> {
  const roots = parseRoots(process.argv.slice(2));

  if (process.env.SPECMESH_MCP_TRANSPORT === "http") {
    const oauthConfig = oauthConfigFromEnv();
    const port = Number(process.env.SPECMESH_MCP_PORT || "3000");
    await startHttpServer(() => {
      const server = new McpServer({ name: "specmesh", version: "0.16.0" });
      registerAllTools(server, roots);
      return server;
    }, { port, oauthConfig });
    console.error(`specmesh MCP server listening on http://localhost:${port}/mcp`);
  } else {
    const server = new McpServer({ name: "specmesh", version: "0.16.0" });
    registerAllTools(server, roots);
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

