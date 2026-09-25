# ADR-003: MCP Server Implementation via `@modelcontextprotocol/sdk`

**Status**: Accepted
**Date**: 2026-09-25

## Context

[FR-019](../FR-019-mcp-server/spec.v1.md) requires exposing specmesh's doc-graph queries over the standard Model
Context Protocol (MCP), so non-Copilot agent harnesses (Claude Code, Claude Desktop, etc.) can call the same
queries today's `languageModelTools` expose to Copilot Chat. This needs: a stdio JSON-RPC transport, MCP's
handshake/capability-negotiation sequence, and tool registration with JSON-schema input validation — none of
which exists in the repo today.

specmesh has no MCP-related dependency yet, so per `new-feature`'s New Dependency gate this choice needs an ADR
rather than being decided unilaterally inside the implementation plan.

## Options Considered

1. **Hand-roll the MCP JSON-RPC protocol** (stdio framing, `initialize` handshake, `tools/list`/`tools/call`
   methods) directly against Node's `process.stdin`/`stdout`. Rejected — MCP's message framing and lifecycle
   have enough edge cases (capability negotiation, request/response correlation, error shapes) that
   reimplementing them is exactly the kind of bespoke-protocol-plumbing risk an official SDK exists to avoid;
   this project already avoids hand-rolled parsers where a maintained library exists (e.g. `yaml` for
   `.specmesh.yml`).

2. **`@modelcontextprotocol/sdk`** (the official TypeScript SDK, published by the Model Context Protocol
   project/Anthropic). Provides `McpServer` (tool registration with Zod/JSON-schema input validation) and
   `StdioServerTransport`, plus a `Client` + `InMemoryTransport` pair usable directly in tests without spawning a
   real subprocess. This is the SDK the MCP spec's own documentation and reference servers use.

3. **A third-party/community MCP framework** (e.g. wrappers built on top of the official SDK). Rejected — adds
   an extra dependency layer with no clear benefit over the official SDK for a server this small (8 read-mostly
   tools), and less certainty of staying current with protocol changes.

## Decision

Adopt **Option 2**: `@modelcontextprotocol/sdk` as a runtime dependency, used for:

- `McpServer` to register the same 8 tools as `src/tools/specmeshTools.ts`, sharing the same underlying pure
  query functions (see FR-019's plan) so behavior never diverges between the two entry points.
- `StdioServerTransport` to serve the standalone process over stdio — the standard local-process MCP transport,
  matching FR-019's "local process, no remote/cloud transport" scope.
- `InMemoryTransport`-backed `Client` in tests, per this repo's existing single-test-runner convention
  ([ADR-001](./ADR-001-testing-strategy.md)) — no second test toolchain, no real subprocess needed to exercise
  the protocol layer.

## Consequences

- New runtime dependency in `package.json`: `@modelcontextprotocol/sdk`. Its CommonJS/ESM interop must be
  verified against this repo's `tsconfig.json` (`"module": "commonjs"`) during implementation; if the SDK ships
  ESM-only, the MCP server entry point may need `"type": "module"`/dynamic `import()` handling isolated to that
  one entry point rather than changing the whole extension's module system.
- The MCP server becomes a second consumer of the shared query/crawl core alongside the existing
  `vscode.lm.registerTool` tools — both must be reviewed together when either changes, per FR-019 FR-5.
- No new dev-only test dependency is introduced — the SDK's own `Client`/`InMemoryTransport` classes are the
  runtime dependency already being added, reused for tests too.
