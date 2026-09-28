import * as http from "http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ForbiddenError, OAuthConfig, UnauthorizedError, verifyBearerToken } from "./auth";

export interface HttpServerOptions {
  port: number;
  oauthConfig: OAuthConfig;
}

/** Starts specmesh's MCP Streamable HTTP transport (FR-020) on `/mcp`, gated by a bearer-token check
 * (`verifyBearerToken`) on every request. Returns the listening `http.Server` so callers control its
 * lifecycle (e.g. tests close it in teardown).
 *
 * Runs in stateless mode (`sessionIdGenerator: undefined`): a stateless `StreamableHTTPServerTransport`
 * can only ever handle one request before it must be discarded, so a fresh `McpServer` + transport pair
 * is created per request via `createServer` rather than reused across requests. */
export async function startHttpServer(createServer: () => McpServer, options: HttpServerOptions): Promise<http.Server> {
  const httpServer = http.createServer((req, res) => {
    if (req.url !== "/mcp") {
      res.writeHead(404).end();
      return;
    }

    verifyBearerToken(req, options.oauthConfig)
      .then(async () => {
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        await createServer().connect(transport);
        await transport.handleRequest(req, res);
      })
      .catch((error) => {
        if (error instanceof ForbiddenError) {
          res.writeHead(403, { "Content-Type": "text/plain" }).end(error.message);
        } else if (error instanceof UnauthorizedError) {
          res.writeHead(401, { "WWW-Authenticate": "Bearer", "Content-Type": "text/plain" }).end(error.message);
        } else {
          res.writeHead(500).end();
        }
      });
  });

  await new Promise<void>((resolve) => httpServer.listen(options.port, resolve));
  return httpServer;
}
