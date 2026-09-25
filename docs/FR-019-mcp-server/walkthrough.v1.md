# Walkthrough: FR-019 Standalone MCP Server for the Doc Graph (v1)

## Files Changed

- [src/crawler/repoConfigCore.ts](../../src/crawler/repoConfigCore.ts) — new vscode-free module: `RepoConfig`,
  `dropLaterDuplicates`, `parseRepoManifest`, `parseSpecRepoRemote`, `parseRepoConfigContent`,
  `loadRepoConfigFromPath`, `isLiteralGlob`, `mergeTrackEntry`. Extracted from `repoConfig.ts` mid-implementation
  after discovering `repoConfig.ts`'s top-level `import * as vscode` would otherwise transitively crash the
  standalone server process.
- [src/crawler/repoConfig.ts](../../src/crawler/repoConfig.ts) — slimmed down to only the genuinely
  vscode-dependent `loadRepoConfig`/`writeSpecRepoRemote`, re-exporting the rest via `export * from
  "./repoConfigCore"` so every existing consumer's import path is unchanged.
- [src/crawler/docTypesCore.ts](../../src/crawler/docTypesCore.ts) — same split, for the same reason: vscode-free
  `DEFAULT_DOC_TYPES`/`cloneDocTypes`/`getBuiltinDefaultDocTypes`, extracted out of `docTypes.ts`.
- [src/crawler/docTypes.ts](../../src/crawler/docTypes.ts) — slimmed down to only `getDocTypeDefinitions`
  (needs `vscode.workspace.getConfiguration`), re-exporting `getBuiltinDefaultDocTypes` from the core module.
- [src/crawler/crawlNode.ts](../../src/crawler/crawlNode.ts) — new Node-fs-backed twin of `crawlWorkspace()`:
  `crawlPaths(roots: WorkspaceRoot[])`, using `fast-glob` for file discovery and reusing every existing
  vscode-free helper (`docPaths.ts`, `docTypeTree.ts`, `frontMatter.ts`, `linkExtractor.ts`, and the two new
  `*Core.ts` modules).
- [src/queries/docQueries.ts](../../src/queries/docQueries.ts) — pure query/formatting functions (`listDocs`,
  `findBrokenLinks`, `findOrphans`, `findMissingDocs`, `listRepos`, `getDocLinks`) shared by both the existing
  Copilot Chat tools and the new MCP tools, producing byte-identical output to the original inline tool logic.
- [src/tools/specmeshTools.ts](../../src/tools/specmeshTools.ts) — refactored each `*Tool.invoke` to thin
  wrappers calling the shared `docQueries.*` functions; `UpdateTrackEntryTool` now calls the shared
  `mergeTrackEntry`. No behavior change.
- [src/mcpServer/tools.ts](../../src/mcpServer/tools.ts) — new: `registerAllTools(server, roots)`, registering
  all 8 tools (same names/descriptions as `package.json`'s `contributes.languageModelTools`) against
  `crawlPaths` + the shared `docQueries`/`repoConfigCore` functions.
- [src/mcpServer/server.ts](../../src/mcpServer/server.ts) — new: CLI-args-driven standalone entry point
  (`node out/mcpServer/server.js <path>[=<name>] ...`), wiring `McpServer` + `StdioServerTransport`.
- [src/test/crawlNode.test.ts](../../src/test/crawlNode.test.ts) — new: temp-directory fixture tests for
  `crawlPaths` (tracked-file crawl + link resolution, literal-glob missing detection, brace-list exclude per
  ADR-004, declared-repo-missing detection).
- [src/test/docQueries.test.ts](../../src/test/docQueries.test.ts) — new: hand-built `DocNode[]`/`Problem[]`
  fixture tests for all 6 `docQueries` functions.
- [src/test/mcpServer.test.ts](../../src/test/mcpServer.test.ts) — new: in-memory `Client`/`McpServer` pair
  (`InMemoryTransport.createLinkedPair()`) exercising all 8 tools end-to-end, including a real
  `specmesh_update_track_entry` write-and-reread round trip.
- [src/test/mcpServerStandalone.test.ts](../../src/test/mcpServerStandalone.test.ts) — new: spawns the real
  compiled `out/mcpServer/server.js` as a genuinely separate `node` subprocess (via `StdioClientTransport`) and
  calls two tools over it — the only test that can catch a transitive `vscode` import reappearing later,
  since every other test in this suite runs inside the Extension Development Host where `vscode` always resolves.
- [package.json](../../package.json) — added `fast-glob`, `@modelcontextprotocol/sdk`, `zod` to
  `dependencies`; added a `"bin": { "specmesh-mcp-server": "./out/mcpServer/server.js" }` entry.
- [README.md](../../README.md) — new "Standalone MCP server" section documenting the run command and an
  example MCP host config snippet.
- [docs/adr/ADR-003-mcp-server-sdk.md](../adr/ADR-003-mcp-server-sdk.md),
  [docs/adr/ADR-004-node-glob-matching-fast-glob.md](../adr/ADR-004-node-glob-matching-fast-glob.md) — new,
  Accepted, documenting the `@modelcontextprotocol/sdk` and `fast-glob` dependency choices.

## Build/Test Results

- `npm run compile` (`tsc -p .`): clean, no errors.
- `npm test`: **139 passing, 0 failing.**
- Manually verified the SDK's CJS/ESM interop risk flagged in ADR-003: both `tsc --noEmit` and a plain
  `node -e "require(...)"` smoke check succeeded against `@modelcontextprotocol/sdk`'s subpath imports under
  this repo's `"module": "commonjs"` tsconfig.
- Manually ran `node out/mcpServer/server.js <repo path>` standalone and confirmed it starts and serves
  requests with no VS Code extension host involved.

## Known Gaps / Notes

- `zod` was added as an explicit direct dependency beyond what ADR-003 named, because `McpServer.registerTool`'s
  `inputSchema` requires zod schemas directly in our own tool-registration code (not just as an implicit SDK
  peer dependency). This is a direct consequence of the already-approved SDK choice, not an independent
  library decision, so it wasn't gated with a separate ADR.
- Per FR-019's Out of Scope: no per-harness scaffolding (Claude Desktop/Antigravity config generation), no
  Antigravity-specific work, and no automated parity fuzz-testing between the vscode and Node crawl paths —
  only the ADR-004-recommended brace-list-exclude test case was added.
- `specmesh_update_track_entry` has no confirmation step in the MCP server (unlike the VS Code tool, which
  asks for user confirmation before writing) — per FR-019's spec Assumptions, this was accepted as an explicit
  scope decision, since the standalone server has no VS Code UI to confirm through.
