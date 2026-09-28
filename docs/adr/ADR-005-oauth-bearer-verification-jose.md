# ADR-005: OAuth Bearer Token Verification via `jose`

**Status**: Accepted
**Date**: 2026-09-25

## Context

[FR-020](../FR-020-remote-mcp-container/spec.v1.md) adds a Streamable HTTP transport to the standalone MCP
server, reachable off-machine unlike the existing stdio transport's implicit local-process trust. It needs to
verify an OAuth 2.1 bearer token (JWT: signature against the issuer's JWKS, expiry, issuer, audience) on every
HTTP request before dispatching to any tool. specmesh acts only as a **resource server** validating tokens
issued by whatever IdP the consumer already runs — it never issues, exchanges, or stores tokens itself
(FR-020's Out of Scope). No JWT/JOSE-related dependency exists in `package.json` today.

## Options Considered

1. **Hand-roll JWT verification** (base64url-decode the token, verify the signature manually against a fetched
   JWKS). Rejected — correct JWT/JWS verification has enough edge cases (algorithm confusion attacks, key
   rotation via `kid`, clock-skew tolerance, JWKS caching) that reimplementing it is exactly the kind of
   bespoke-crypto-plumbing risk this repo already avoids elsewhere (see ADR-003's rationale for not hand-rolling
   MCP's protocol framing).

2. **The MCP SDK's own `requireBearerAuth` middleware** (`server/auth/middleware/bearerAuth.js`). Rejected — its
   type signature (`node_modules/@modelcontextprotocol/sdk/dist/cjs/server/auth/middleware/bearerAuth.d.ts`)
   returns an Express `RequestHandler` and is built against `express-serve-static-core`'s `Request` type. Express
   is not otherwise used anywhere in this repo (only present as a transitive dependency today); adopting it
   solely to reuse one middleware for a single-route server would add a whole web framework for one auth check,
   which the plan's Streamable HTTP transport doesn't otherwise need (its `handleRequest` already accepts a raw
   Node `IncomingMessage`/`ServerResponse` directly).

3. **`jose`**. A zero-dependency, actively maintained JOSE (JSON Object Signing and Encryption) library covering
   JWT verification, remote JWKS fetching/caching (`createRemoteJWKSet`), and standard claim checks
   (issuer/audience/expiry) in one call (`jwtVerify`). Works against plain Node `http` request/response objects,
   no Express coupling.

## Decision

Adopt **Option 3**: add `jose` as a runtime dependency, used only by the new `src/mcpServer/auth.ts` module
(FR-020's plan) to verify bearer tokens on the HTTP transport. The stdio transport is unaffected — it has no
network exposure and keeps its existing implicit local-process trust model.

## Consequences

- New runtime dependency in `package.json`: `jose`.
- `src/mcpServer/auth.ts` owns all token verification; no other module should import `jose` directly, keeping
  the OAuth surface area to one file.
- `auth.test.ts` (FR-020's plan) builds its own JWKS and signs test tokens with `jose`'s own `SignJWT`, so tests
  never depend on a real external IdP being reachable.
- specmesh still never acts as an authorization server (no `/authorize`/`/token` endpoints, no client
  registration) — verification-only, consistent with FR-020's Out of Scope on IdP choice.
- `jose` ships ESM-only (`"type": "module"`, no `require` export condition) — verified it still resolves via a
  plain `import`/`require` under this repo's `"module": "commonjs"` tsconfig, but only because Node's
  `require(esm)` support (stable from Node 20.17/22.0 per Node's own docs) makes that work. This sets a new
  implicit minimum Node version for anyone running the standalone MCP server (`package.json` `engines.node` set
  to `>=20.17.0`); the container image (FR-020) uses `node:22-alpine` to stay comfortably above that floor.
