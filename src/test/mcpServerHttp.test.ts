import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as http from "http";
import * as os from "os";
import * as path from "path";
import { AddressInfo } from "net";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "../mcpServer/tools";
import { startHttpServer } from "../mcpServer/httpTransport";
import { OAuthConfig } from "../mcpServer/auth";

const ISSUER = "https://issuer.example.test/";
const AUDIENCE = "api://specmesh-test";
const KID = "test-key";

suite("MCP server HTTP transport", () => {
  let jwksServer: http.Server;
  let jwksUrl: string;
  let privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
  let tempDir: string;

  suiteSetup(async function () {
    this.timeout(10000);
    const { privateKey: priv, publicKey } = await generateKeyPair("RS256");
    privateKey = priv;
    const jwk = await exportJWK(publicKey);
    jwk.kid = KID;
    jwk.alg = "RS256";
    jwk.use = "sig";

    jwksServer = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ keys: [jwk] }));
    });
    await new Promise<void>((resolve) => jwksServer.listen(0, "127.0.0.1", resolve));
    jwksUrl = `http://127.0.0.1:${(jwksServer.address() as AddressInfo).port}/jwks`;
  });

  suiteTeardown(async () => {
    await new Promise<void>((resolve) => jwksServer.close(() => resolve()));
  });

  setup(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "specmesh-mcp-http-"));
    fs.mkdirSync(path.join(tempDir, "docs"), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, ".specmesh.yml"),
      ["track:", "  - type: doc", "    label: Docs", "    glob: docs/*.md"].join("\n"),
      "utf8"
    );
    fs.writeFileSync(path.join(tempDir, "docs", "charter.md"), "# Charter\n", "utf8");
  });

  teardown(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  async function signToken(claims: Record<string, unknown> = {}): Promise<string> {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: KID })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);
  }

  async function startTestServer(oauthConfig: OAuthConfig): Promise<http.Server> {
    return startHttpServer(() => {
      const server = new McpServer({ name: "specmesh-test", version: "0.0.0" });
      registerAllTools(server, [{ name: "root", path: tempDir }]);
      return server;
    }, { port: 0, oauthConfig });
  }

  async function connectClient(port: number, token?: string): Promise<Client> {
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${port}/mcp`),
      token ? { requestInit: { headers: { Authorization: `Bearer ${token}` } } } : undefined
    );
    const client = new Client({ name: "test-client", version: "0.0.0" });
    await client.connect(transport);
    return client;
  }

  test("valid token: MCP tool call succeeds over HTTP", async () => {
    const httpServer = await startTestServer({ issuer: ISSUER, jwksUrl, audience: AUDIENCE });
    try {
      const token = await signToken();
      const client = await connectClient((httpServer.address() as AddressInfo).port, token);
      const { tools } = await client.listTools();
      assert.ok(tools.some((t) => t.name === "specmesh_list_docs"));
      await client.close();
    } finally {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  test("missing token: connection is rejected", async () => {
    const httpServer = await startTestServer({ issuer: ISSUER, jwksUrl, audience: AUDIENCE });
    try {
      await assert.rejects(() => connectClient((httpServer.address() as AddressInfo).port));
    } finally {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  test("required role missing from token: connection is rejected", async () => {
    const httpServer = await startTestServer({
      issuer: ISSUER,
      jwksUrl,
      audience: AUDIENCE,
      requiredRole: "SpecmeshReader",
    });
    try {
      const token = await signToken({ roles: ["OtherRole"] });
      await assert.rejects(() => connectClient((httpServer.address() as AddressInfo).port, token));
    } finally {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  test("required role present in token: MCP tool call succeeds", async () => {
    const httpServer = await startTestServer({
      issuer: ISSUER,
      jwksUrl,
      audience: AUDIENCE,
      requiredRole: "SpecmeshReader",
    });
    try {
      const token = await signToken({ roles: ["SpecmeshReader"] });
      const client = await connectClient((httpServer.address() as AddressInfo).port, token);
      const { tools } = await client.listTools();
      assert.ok(tools.some((t) => t.name === "specmesh_list_docs"));
      await client.close();
    } finally {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });
});
