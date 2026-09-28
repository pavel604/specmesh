import * as assert from "node:assert/strict";
import * as http from "http";
import { AddressInfo } from "net";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { ForbiddenError, OAuthConfig, UnauthorizedError, verifyBearerToken } from "../mcpServer/auth";

const ISSUER = "https://issuer.example.test/";
const AUDIENCE = "api://specmesh-test";
const KID = "test-key";

function requestWith(authorization?: string): http.IncomingMessage {
  return { headers: { authorization } } as unknown as http.IncomingMessage;
}

suite("verifyBearerToken", () => {
  let jwksServer: http.Server;
  let jwksUrl: string;
  let privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];

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

  function config(overrides: Partial<OAuthConfig> = {}): OAuthConfig {
    return { issuer: ISSUER, jwksUrl, audience: AUDIENCE, ...overrides };
  }

  async function signToken(options: {
    claims?: Record<string, unknown>;
    issuer?: string;
    audience?: string;
    expiresIn?: string;
  } = {}): Promise<string> {
    return new SignJWT(options.claims ?? {})
      .setProtectedHeader({ alg: "RS256", kid: KID })
      .setIssuer(options.issuer ?? ISSUER)
      .setAudience(options.audience ?? AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(options.expiresIn ?? "1h")
      .sign(privateKey);
  }

  test("accepts a valid token", async () => {
    const token = await signToken();
    const payload = await verifyBearerToken(requestWith(`Bearer ${token}`), config());
    assert.equal(payload.iss, ISSUER);
  });

  test("rejects a missing Authorization header", async () => {
    await assert.rejects(() => verifyBearerToken(requestWith(undefined), config()), UnauthorizedError);
  });

  test("rejects an expired token", async () => {
    const token = await signToken({ expiresIn: "-1h" });
    await assert.rejects(() => verifyBearerToken(requestWith(`Bearer ${token}`), config()), UnauthorizedError);
  });

  test("rejects the wrong audience", async () => {
    const token = await signToken({ audience: "api://someone-else" });
    await assert.rejects(() => verifyBearerToken(requestWith(`Bearer ${token}`), config()), UnauthorizedError);
  });

  test("rejects the wrong issuer", async () => {
    const token = await signToken({ issuer: "https://someone-else.example.test/" });
    await assert.rejects(() => verifyBearerToken(requestWith(`Bearer ${token}`), config()), UnauthorizedError);
  });

  test("rejects a malformed token", async () => {
    await assert.rejects(() => verifyBearerToken(requestWith("Bearer not-a-jwt"), config()), UnauthorizedError);
  });

  test("no required role configured: any valid token is authorized", async () => {
    const token = await signToken();
    await assert.doesNotReject(() => verifyBearerToken(requestWith(`Bearer ${token}`), config()));
  });

  test("required role missing from token: rejected as Forbidden", async () => {
    const token = await signToken({ claims: { roles: ["OtherRole"] } });
    await assert.rejects(
      () => verifyBearerToken(requestWith(`Bearer ${token}`), config({ requiredRole: "SpecmeshReader" })),
      ForbiddenError
    );
  });

  test("required role present in token: authorized", async () => {
    const token = await signToken({ claims: { roles: ["SpecmeshReader"] } });
    const payload = await verifyBearerToken(
      requestWith(`Bearer ${token}`),
      config({ requiredRole: "SpecmeshReader" })
    );
    assert.deepEqual(payload.roles, ["SpecmeshReader"]);
  });
});
