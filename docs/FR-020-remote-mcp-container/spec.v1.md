# FR-020: Self-Hosted Remote MCP Server (Container Distribution)

**Revision**: 1
**Status**: Approved
**Repos**: specmesh
**Created**: 2026-09-25
**Epic**: [EPIC-004: Multi-Harness Agent Support](../epics/EPIC-004-multi-harness-agent-support.md)

## User Story

As a team building a product that doesn't use VS Code (e.g. Claude Code, a custom IDE, or a CI-driven coding
agent), I want to run specmesh's doc-graph MCP server myself, reachable over HTTPS instead of only as a
locally-spawned stdio process, so my own agentic SDLC can query the same doc graph a VS Code/Copilot user gets
today — without specmesh becoming a service we don't control.

## Overview

Add a second MCP transport — Streamable HTTP, with OAuth 2.1 authorization — to the existing standalone server
from [FR-019](../FR-019-mcp-server/spec.v1.md), on the exact same query core and tool registrations
([src/mcpServer/server.ts](../../src/mcpServer/server.ts), [src/mcpServer/tools.ts](../../src/mcpServer/tools.ts)).
Package the HTTP-transport server as a container image so a consumer without VS Code can self-host it against
their own repo checkout, alongside the existing VSIX distribution.

## Functional Requirements

- **FR-1**: `src/mcpServer/server.ts` supports a second transport mode — Streamable HTTP (`StreamableHTTPServerTransport`
  from `@modelcontextprotocol/sdk`) — selected via a startup flag/env var, without changing the existing default
  stdio behavior or FR-019's CLI root-path argument parsing.
- **FR-2**: The same `registerAllTools(server, roots)` call and the same 8 tools ([FR-019](../FR-019-mcp-server/spec.v1.md)
  FR-1) back both transports — no duplicated tool-registration code path.
- **FR-3**: The HTTP transport requires a valid OAuth 2.1 bearer token on every request; unauthenticated requests
  are rejected. Token issuance/validation config (issuer, audience, etc.) is supplied via startup env vars, not
  hardcoded. An optional required-role env var may also be configured: when set, a valid token lacking that role
  is rejected (`403`); when unset/empty, any valid token for the configured audience is accepted.
- **FR-4**: A `Dockerfile` builds a container image that runs the HTTP-transport server, with workspace-folder
  root(s) supplied as a mounted volume path (env var/CLI arg pointing at the mount), so the container crawls a
  real checkout the consumer already has on disk — specmesh itself never clones or holds the consumer's repo.
- **FR-5**: The container image is published as a build artifact from this repo's own release process (alongside
  the existing VSIX), versioned the same way (matches `package.json`'s version).
- **FR-6**: README/help content (the existing `specmesh_get_help` tool output and repo docs) documents how a
  consumer runs the container against their own checkout and points an MCP-aware client (Claude Code, another
  IDE, a CI job) at the resulting URL.

## Out of Scope

- specmesh hosting the server centrally for third parties (ruled out by the charter's "not a hosted/cloud index"
  non-goal) — every deployment of the HTTP-transport server is run by the consumer, against their own checkout.
- Per-harness scaffolding for non-VS-Code harnesses (`.claude/skills/*`, `CLAUDE.md`, `AGENTS.md`, etc.) —
  roadmap Vector 1/2's later steps, separate FR(s).
- Auto-cloning a consumer's declared repos into the container (roadmap Vector 3) — the container image never
  bakes in or clones any repo itself, at build time or runtime. The consumer always mounts an already-existing
  checkout as a volume at container start (e.g. `docker run -v /host/path/to/repo:/repos/myrepo ...`), the same
  way FR-019's stdio server crawls CLI-supplied local paths today.
- Multi-tenant support (one running server instance serving more than one consumer's repos) — one container
  instance serves one consumer's own checkout, matching today's one-VS-Code-workspace-per-server model.
- Choice of OAuth identity provider / token issuer — this FR validates bearer tokens against consumer-supplied
  config; which IdP a consumer uses is their own infrastructure decision.

## Assumptions

- `@modelcontextprotocol/sdk`'s `StreamableHTTPServerTransport` works with Node's built-in `http` module directly
  (per the SDK's own reference examples), so no new HTTP-framework dependency (e.g. Express) is needed —
  Phase 2 will verify this against the installed SDK version before relying on it.
- OAuth 2.1 validation needs at minimum a JWT-verification dependency not currently in this repo's `package.json`
  — Phase 2's New Dependency gate will confirm the specific package before it's added.
  Containerization itself (a `Dockerfile`) is not a new npm dependency, but is new build/release tooling for this
  repo — flagged in Phase 2 so the plan documents the choice rather than assuming it silently.
- The container image is published from this same repo's existing release pipeline, not a new separate
  package/repo — matches FR-019's "one implementation" framing.

## Open Questions

- None — the roadmap (Vector 4) already resolved the shape of this work; remaining unknowns are implementation
  details (exact OAuth validation library, base image, registry target) for the plan phase.
