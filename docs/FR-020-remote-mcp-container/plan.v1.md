# Implementation Plan: FR-020 Self-Hosted Remote MCP Server (Container Distribution) (v1)

**Status**: Approved

## Approach

### Streamable HTTP transport alongside stdio

[src/mcpServer/server.ts](../../src/mcpServer/server.ts) currently always connects a `StdioServerTransport`. Add
a transport-selection env var (`SPECMESH_MCP_TRANSPORT`, default `stdio`) so the same entry point can instead
serve `StreamableHTTPServerTransport` (already available in the installed `@modelcontextprotocol/sdk`, confirmed
at `node_modules/@modelcontextprotocol/sdk/dist/cjs/server/streamableHttp.js` — no SDK version bump needed). The
HTTP path uses plain Node `http.createServer` (the transport's `handleRequest(req, res)` accepts a raw
`IncomingMessage`/`ServerResponse` directly per its own type signature — no Express needed for routing), listening
on `SPECMESH_MCP_PORT` (default `3000`) at a single `/mcp` path. Root folders come from the same CLI-args parsing
FR-019 already has (`parseRoots`) in both modes — no change to how roots are supplied.

**Files:**

- `src/mcpServer/server.ts` — branch on `SPECMESH_MCP_TRANSPORT`: existing stdio path unchanged; new path
  constructs a stateless `StreamableHTTPServerTransport({ sessionIdGenerator: undefined })`, connects the same
  `McpServer`/`registerAllTools(server, roots)` call already shared with stdio, and starts an `http.createServer`
  that calls the bearer-auth check (below) before `transport.handleRequest(req, res)`.

### Bearer-token verification (OAuth 2.1 resource-server validation only)

Per FR-020's Out of Scope, specmesh is a **resource server** here, not an authorization server — it validates
tokens issued by whatever IdP the consumer already runs, it never issues or exchanges them. The SDK's own
`requireBearerAuth` helper (`server/auth/middleware/bearerAuth.js`) is Express-`RequestHandler`-typed
(`node_modules/@modelcontextprotocol/sdk/dist/cjs/server/auth/middleware/bearerAuth.d.ts` imports `express`
directly) — pulling in Express only to reuse that one helper would add a whole web framework for a single-route
server, so this plan hand-rolls the check against the plain `http.IncomingMessage` instead, keeping Express out
entirely.

**Files:**

- `src/mcpServer/auth.ts` (new) — `verifyBearerToken(req: IncomingMessage): Promise<AuthInfo>`, reading
  `Authorization: Bearer <token>`, verifying it with **`jose`**'s `createRemoteJWKSet` + `jwtVerify` against
  `SPECMESH_OAUTH_ISSUER`/`SPECMESH_OAUTH_JWKS_URL`/`SPECMESH_OAUTH_AUDIENCE` env vars (all consumer-supplied —
  specmesh never hardcodes an IdP). Throws on missing/invalid/expired token; the HTTP handler catches this and
  responds `401` with a `WWW-Authenticate: Bearer` header before ever reaching `transport.handleRequest`.
  Dependency decision recorded in [ADR-005](../adr/ADR-005-oauth-bearer-verification-jose.md).
- `src/mcpServer/auth.ts` also reads an optional `SPECMESH_OAUTH_REQUIRED_ROLE` env var. When unset/empty, only
  audience+signature+expiry are checked (as above). When set, `verifyBearerToken` additionally requires the
  verified token's `roles` claim (Entra ID app-role convention; an array of strings) to include that value,
  otherwise responds `403` (valid token, insufficient role) rather than `401`.

### Container image

**Files:**

- `Dockerfile` (new) — multi-stage: build stage (`node:22-alpine`, `npm ci && npm run compile`), run stage
  (`node:22-alpine`, copies `out/` + `node_modules` + `package.json`, `ENTRYPOINT ["node", "out/mcpServer/server.js"]`).
  `node:22-alpine` (not 20) is deliberate: `jose` (ADR-005) is ESM-only and relies on Node's `require(esm)`
  support, stable from Node 20.17/22.0 — 22-alpine stays comfortably above that floor.
  Root path(s) come from a mounted volume (e.g. `docker run -v /host/repo:/repos/myrepo ... image /repos/myrepo`),
  matching FR-020 FR-4 — the image never bakes in or clones a checkout.
- `.dockerignore` (new) — excludes `out/`, `node_modules/`, `.git/`, `coverage/`, etc. from the build context.
- `README.md` — new section documenting: the env vars (`SPECMESH_MCP_TRANSPORT`, `SPECMESH_MCP_PORT`,
  `SPECMESH_OAUTH_*`), an example `docker run` command mounting a checkout, and an example MCP client config
  (Claude Code / other IDE) pointing at the resulting `https://.../mcp` URL — per FR-020 FR-6.
- `src/mcpServer/tools.ts`'s existing `specmesh_get_help` tool reads this same `README.md`, so no separate change
  needed there for the new section to be queryable.

### Release pipeline: publish the image alongside the VSIX

**Files:**

- `.github/workflows/release.yml` — add a second job (or steps in the existing job) that builds the `Dockerfile`
  and pushes it to GitHub Container Registry (`ghcr.io/<org>/specmesh:vX.Y.Z` + `:latest`), tagged from the same
  `v*.*.*` trigger as the VSIX build, using `docker/login-action` (`GITHUB_TOKEN`, already available, no new
  secret) + `docker/build-push-action`. Requires adding `packages: write` to the workflow's `permissions:` block
  (currently only `contents: write`). GHCR is chosen over a cloud-specific registry (e.g. ACR) so a consumer can
  pull the image regardless of which cloud/host they self-host it on — matches FR-020's "consumer self-hosts,
  nothing this repo owns" framing; no new cloud account/credential needed to ship this.

### Tests

**Files:**

- `src/test/mcpServerHttp.test.ts` (new) — starts the HTTP-transport server on an ephemeral port against a temp
  fixture (same fixture style as `mcpServer.test.ts`), asserts: (a) a request with a valid mock-signed JWT (test
  builds its own JWKS + signs a token with `jose`'s own `SignJWT`, so no real IdP is needed in tests) reaches the
  tools and gets a normal MCP response; (b) a missing/invalid/expired token gets `401` with `WWW-Authenticate`;
  (c) with `SPECMESH_OAUTH_REQUIRED_ROLE` set, a valid token missing that role gets `403`, and one carrying it
  succeeds.
- `src/test/auth.test.ts` (new) — unit tests for `verifyBearerToken` directly against hand-built JWTs (valid,
  expired, wrong audience, wrong issuer, malformed, missing/present required role when configured) — no HTTP
  server involved.
- Both run through the existing `npm test` (ADR-001), no new test runner.

## Sequencing

1. Resolve the New Dependency gate for `jose` (ADR or alternative) before writing `auth.ts`.
2. Add `SPECMESH_MCP_TRANSPORT`/HTTP branch to `server.ts` (no auth yet — internal smoke-test only, never
   deployed at this step).
3. Add `auth.ts` + wire the 401 check into the HTTP handler; write `auth.test.ts`.
4. Write `mcpServerHttp.test.ts` end-to-end (valid/invalid token cases).
5. Add `Dockerfile` + `.dockerignore`; verify the image builds and runs locally against a mounted temp repo.
6. Update `README.md` with env vars, run command, and example client config.
7. Extend `release.yml` with the GHCR build/push job; verify via `workflow_dispatch` before relying on a real tag
   push.

## Risks / Tradeoffs

- Stateless HTTP mode (`sessionIdGenerator: undefined`) means no session affinity across requests — acceptable
  for a read-mostly doc-graph query server (each tool call already re-crawls fresh via `crawlPaths(roots)` per
  FR-019), but would need revisiting if a future FR adds server-initiated push/streaming behavior.
- Hand-rolling the bearer-check instead of the SDK's `requireBearerAuth` means we don't get its built-in
  `WWW-Authenticate`/scope-checking conveniences for free — accepted to avoid the Express dependency; `auth.ts`
  re-implements only the minimal subset FR-020 actually needs (valid-signature + issuer + audience + expiry).
- GHCR (not a specmesh-run host) is only the *publish* target — running the pulled image anywhere (a consumer's
  own Azure Container Apps, a bare Docker host, etc.) is entirely the consumer's choice and infrastructure, per
  FR-020's Out of Scope.
- No CI currently runs `npm test` on PRs (noted as a pre-existing gap in FR-019's plan) — this FR doesn't change
  that; new tests only run locally via `npm test` like the rest of the suite, and `release.yml`'s new job only
  builds/publishes on tag push, it doesn't gate on tests passing first unless that's added separately.
