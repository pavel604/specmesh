# Tasks: FR-020 Self-Hosted Remote MCP Server (Container Distribution) (v1)

- [x] T1 — Add `jose` to `package.json` dependencies, per [ADR-005](../adr/ADR-005-oauth-bearer-verification-jose.md).
- [x] T2 — `src/mcpServer/server.ts` + new `src/mcpServer/httpTransport.ts`: add `SPECMESH_MCP_TRANSPORT`/
      `SPECMESH_MCP_PORT` env-var branch, wiring a stateless `StreamableHTTPServerTransport` + plain
      `http.createServer` at `/mcp` (a fresh `McpServer`/transport pair per request, since a stateless
      transport can only handle one request before it must be discarded).
- [x] T3 — `src/mcpServer/auth.ts`: implement `verifyBearerToken(req)` using `jose`'s `createRemoteJWKSet` +
      `jwtVerify` against `SPECMESH_OAUTH_ISSUER`/`SPECMESH_OAUTH_JWKS_URL`/`SPECMESH_OAUTH_AUDIENCE`, plus the
      optional `SPECMESH_OAUTH_REQUIRED_ROLE` check (skip when unset/empty, else require it in the token's
      `roles` claim, else throw a `403`-flagged error distinct from the `401` invalid-token error).
- [x] T4 — Wire `verifyBearerToken` into the HTTP handler from T2: `401` + `WWW-Authenticate: Bearer` on
      missing/invalid/expired token, `403` on valid-but-missing-role, else `transport.handleRequest(req, res)`.
- [x] T5 — `src/test/auth.test.ts`: unit tests for `verifyBearerToken` (valid, expired, wrong audience, wrong
      issuer, malformed, missing required role, present required role, no required role configured).
- [x] T6 — `src/test/mcpServerHttp.test.ts`: end-to-end HTTP-transport tests against a temp fixture (valid token
      succeeds, invalid/missing token gets 401, role-gated cases from T5 reproduced over real HTTP).
- [x] T7 — `Dockerfile` + `.dockerignore`: multi-stage build/run image; root path(s) via mounted volume, per
      FR-020 FR-4.
- [x] T8 — `README.md`: document `SPECMESH_MCP_TRANSPORT`/`SPECMESH_MCP_PORT`/`SPECMESH_OAUTH_*` env vars, an
      example `docker run` command, and an example remote MCP client config.
- [x] T9 — `.github/workflows/release.yml`: add `packages: write` permission and a build/push step publishing
      the image to `ghcr.io/<org>/specmesh` tagged `vX.Y.Z` + `latest` on the existing `v*.*.*` tag trigger.
      (Not yet exercised by an actual CI run — pushing a tag or running `workflow_dispatch` affects the shared
      GitHub Actions/GHCR, left for the user to trigger.)
- [x] T10 — Run `npm run compile` and `npm test`; fix any errors before marking this revision done.
