# Walkthrough: FR-020 Self-Hosted Remote MCP Server (Container Distribution) (v1)

## Files Changed

- [docs/roadmap.md](../roadmap.md) — added "Vector 4 — Self-hosted remote MCP server (container distribution)".
- [docs/FR-020-remote-mcp-container/spec.v1.md](spec.v1.md) — FR spec (FR-1..FR-6, Out of Scope, Assumptions).
- [docs/FR-020-remote-mcp-container/plan.v1.md](plan.v1.md) — implementation plan.
- [docs/FR-020-remote-mcp-container/tasks.v1.md](tasks.v1.md) — T1–T10, all complete.
- [docs/adr/ADR-005-oauth-bearer-verification-jose.md](../adr/ADR-005-oauth-bearer-verification-jose.md) — records
  the decision to hand-roll bearer-token verification with `jose` instead of the SDK's Express-coupled
  `requireBearerAuth` helper, and the Node `>=20.17.0` version floor `jose` introduces.
- [package.json](../../package.json) / [package-lock.json](../../package-lock.json) — added `jose` dependency and
  `engines.node: ">=20.17.0"`.
- [src/mcpServer/auth.ts](../../src/mcpServer/auth.ts) (new) — `verifyBearerToken(req, config)`: validates a
  bearer token's signature/issuer/audience/expiry via `jose`'s `createRemoteJWKSet` + `jwtVerify`, and optionally
  enforces a required role from the token's `roles` claim (`ForbiddenError`/`UnauthorizedError`).
- [src/mcpServer/httpTransport.ts](../../src/mcpServer/httpTransport.ts) (new) — `startHttpServer(createServer,
  options)`: serves the MCP Streamable HTTP transport at `/mcp`, gated by `verifyBearerToken` on every request.
  Builds a fresh `McpServer` + `StreamableHTTPServerTransport` pair per request (a stateless transport can only
  handle one request before it must be discarded — this was found and fixed while writing the end-to-end test).
- [src/mcpServer/server.ts](../../src/mcpServer/server.ts) — added `SPECMESH_MCP_TRANSPORT`/`SPECMESH_MCP_PORT`/
  `SPECMESH_OAUTH_*` env-var wiring; branches between the existing stdio path and the new HTTP path.
- [src/test/auth.test.ts](../../src/test/auth.test.ts) (new) — 9 unit tests for `verifyBearerToken` (valid,
  missing header, expired, wrong audience, wrong issuer, malformed, no-required-role, missing-required-role,
  present-required-role).
- [src/test/mcpServerHttp.test.ts](../../src/test/mcpServerHttp.test.ts) (new) — 4 end-to-end tests over real
  HTTP against a temp fixture repo: valid token succeeds, missing token rejected, required-role missing rejected,
  required-role present succeeds.
- [Dockerfile](../../Dockerfile) (new) — multi-stage `node:22-alpine` build; root repo path(s) supplied via a
  mounted volume at `docker run` time.
- [.dockerignore](../../.dockerignore) (new).
- [README.md](../../README.md) — new "Self-hosted remote server (Streamable HTTP + container)" section: env
  vars, `docker run` example, example remote MCP client config.
- [.github/workflows/release.yml](../../.github/workflows/release.yml) — added `packages: write` permission and a
  `build-and-push-image` job publishing to `ghcr.io/<org>/specmesh` (`vX.Y.Z` + `latest`) on the same `v*.*.*` tag
  trigger.

## Build/Test Results

- `npm run compile` — clean.
- `npm test` — 152/152 passing (includes the 13 new auth/HTTP-transport tests).
- `docker build` — verified locally: built the image, ran it with a mounted temp fixture repo and a real mock
  JWKS server, and confirmed over actual HTTP: a valid bearer token gets a normal MCP `initialize` response
  (200), and a missing token gets `401` + `WWW-Authenticate: Bearer`. Image and container removed after the
  smoke test.
- **Real-world validation against a live Azure AD tenant** (not just the mock JWKS server): minted a real
  client-credentials access token from an existing Entra ID app registration, ran the container configured with
  that tenant's actual issuer/JWKS/audience, and confirmed the same `200`/`401` behavior over real HTTP against a
  genuine Microsoft-issued token. Registered the running server with Claude CLI (`claude mcp add --transport
  http`) and confirmed a live tool call succeeded end-to-end from a second, independent MCP harness. All
  transient test artifacts (container, token, temp fixture) were torn down afterward.
- Attempted the same live wiring in VS Code (`.vscode/mcp.json`, kept in the repo for later): blocked by a
  GitHub Copilot **organization-level policy** disabling MCP servers in Copilot Chat for this account — not a
  bug in this feature. Confirmed via the local machine's registry that no VS Code Group Policy is involved; this
  is an org-side Copilot policy toggle instead. Cross-harness interop is still proven via Claude CLI above.

## Follow-ups / Known Gaps

- The new `build-and-push-image` CI job hasn't been exercised by an actual GitHub Actions run yet (pushing a tag
  or running `workflow_dispatch` affects the shared repo/GHCR, so this was left for you to trigger rather than
  done automatically).
- No CI currently runs `npm test` on PRs (pre-existing gap from FR-019, unchanged by this feature).
