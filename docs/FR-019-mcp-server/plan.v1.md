# Implementation Plan: FR-019 Standalone MCP Server for the Doc Graph (v1)

**Status**: Approved

## Approach

### Extract vscode-free query/formatting logic

Today, each `languageModelTools` class in [src/tools/specmeshTools.ts](../../src/tools/specmeshTools.ts) inlines
its own filtering + text-formatting logic (e.g. `ListDocsTool.invoke` filters `nodes` and builds a `"N doc(s)
found:..."` string directly). That logic has zero actual `vscode` dependency — only the surrounding
`crawlWorkspace()` call and the `vscode.LanguageModelToolResult` wrapper do. Pulling the formatting logic out into
plain functions lets both the Copilot-facing tools and the new MCP server call the exact same code.

**Files:**

- `src/queries/docQueries.ts` (new) — pure functions mirroring each tool: `listDocs(nodes, input)`,
  `findBrokenLinks(nodes, problems, folder)`, `findOrphans(nodes, problems, folder)`,
  `findMissingDocs(missingProblems, folder)`, `listRepos(repos, folder)`, `getDocLinks(nodes, path)`, each
  returning the same plain string the current tool returns today.
- `src/crawler/repoConfig.ts` — extract `mergeTrackEntry(existingTrack, entry): DocTypeDefinition[]` (the
  find-or-push logic currently inline in `UpdateTrackEntryTool.invoke`) as a pure function, shared by both entry
  points' write path.
- `src/tools/specmeshTools.ts` — each `*Tool.invoke` becomes a thin wrapper: call `crawlWorkspace()`, call the new
  pure function, wrap the string in `textResult(...)`. No behavior change (FR-5).

### Node-native crawl for the standalone process

An MCP server runs outside any extension host, so it cannot call `vscode.workspace.workspaceFolders`,
`vscode.workspace.findFiles`, or `vscode.workspace.fs`. It needs a Node-native twin of
[crawlWorkspace()](../../src/crawler/crawler.ts) that takes explicit folder roots and reads files via `fs`.

**Files:**

- `src/crawler/crawlNode.ts` (new) — `crawlPaths(roots: {name: string; path: string}[]): Promise<CrawlResult>`,
  mirroring `crawlWorkspace()`'s loop but using `fast-glob` (new runtime dependency, per
  [ADR-004](../adr/ADR-004-node-glob-matching-fast-glob.md)) instead of `vscode.workspace.findFiles`, and
  `fs/promises.readFile` instead of `vscode.workspace.fs.readFile`. Reuses the existing pure helpers unchanged:
  `parseFrontMatter`, `extractMarkdownLinks`, `resolveLinkTarget`, `withSpecmeshExclude`, `flattenDocTypes`,
  `attachParentIds`, `buildChildTypeOrder`.
- `src/crawler/repoConfig.ts` — extract `loadRepoConfigFromPath(rootPath: string): Promise<RepoConfig>`, a
  Node-`fs`-based twin of `loadRepoConfig` (which only uses `folder.uri` + `vscode.workspace.fs.readFile` today,
  so this is a mechanical copy swapping the I/O calls). Both functions share `parseRepoManifest`,
  `parseSpecRepoRemote`, `dropLaterDuplicates`, `findDuplicateTypes` unchanged.
- **Tradeoff**: `crawlWorkspace()` and `crawlPaths()` duplicate the outer traversal loop shape (not fully
  unified behind one abstraction). This is deliberate — the existing vscode-based crawler is central to the
  already-shipped tree view and heavily exercised; injecting a filesystem-abstraction layer into that hot path
  to unify it with the new Node path risks regressing working, tested behavior for a refactor whose only payoff
  is avoiding ~40 lines of structurally-similar-but-not-identical duplication. All the actual parsing/link logic
  stays fully shared either way.

### MCP server entry point

**Files:**

- `src/mcpServer/tools.ts` (new) — one `registerAllTools(server: McpServer, roots)` function, registering the
  same 8 tools (name, description, input schema copied from today's `contributes.languageModelTools` in
  `package.json`) via `server.tool(...)`, each handler calling `crawlPaths(roots)` once per request then the
  shared pure query functions from `src/queries/docQueries.ts`. `update_track_entry`'s write path uses
  `fs/promises.writeFile` + `mergeTrackEntry`; `get_help` reads this package's own `README.md` via `fs`.
- `src/mcpServer/server.ts` (new) — process entry point: parses workspace roots from CLI args
  (`node out/mcpServer/server.js <path>[=<name>] ...`, defaulting `name` to `path.basename`), constructs an
  `McpServer`, calls `registerAllTools`, connects a `StdioServerTransport`.
- `package.json` — add `@modelcontextprotocol/sdk` (per [ADR-003](../adr/ADR-003-mcp-server-sdk.md)) and
  `fast-glob` (per [ADR-004](../adr/ADR-004-node-glob-matching-fast-glob.md)) as `dependencies`; add a `"bin"`
  entry (or documented `node out/mcpServer/server.js` run command) so an MCP host's config can point at a stable
  path.
- `README.md` — document the run command and an example MCP host config snippet (e.g. a `.mcp.json`/
  `claude_desktop_config.json` entry), per FR-019 Assumptions (local stdio process only).

### Tests

**Files:**

- `src/test/docQueries.test.ts` (new) — plain-logic tests for each function in `docQueries.ts` against
  hand-built `DocNode[]`/`Problem[]` fixtures, `assert/strict`, no `vscode` import — same style as existing
  `graph.test.ts`.
- `src/test/crawlNode.test.ts` (new) — builds a temp directory (`fs.mkdtempSync`) with sample tracked docs and
  a `.specmesh.yml`, runs `crawlPaths`, asserts the resulting `CrawlResult` — no `vscode` import.
- `src/test/mcpServer.test.ts` (new) — constructs an `McpServer` with `registerAllTools`, connects it to a
  `Client` via `InMemoryTransport.createLinkedPair()` (per ADR-003), calls `listTools`/`callTool` for each of the
  8 tools against the same temp-directory fixture, and asserts on the real JSON-RPC response content — verifies
  end-to-end wiring without spawning a subprocess.
- All three run through the existing `npm test` (`@vscode/test-cli` + Mocha) — no second test runner, consistent
  with ADR-001; none of these files import `vscode`, but they execute fine inside the Extension Development Host
  since it's a strict superset environment.

## Sequencing

1. Extract `docQueries.ts` + `mergeTrackEntry`, refactor `specmeshTools.ts` to use them, confirm no behavior
   change (existing manual/tree-view usage still works).
2. Add `fast-glob` (ADR-004), build `crawlNode.ts` + `loadRepoConfigFromPath`, write `crawlNode.test.ts`
   (including a brace-list-exclude case per ADR-004's Consequences).
3. Add `@modelcontextprotocol/sdk`, build `mcpServer/tools.ts` + `server.ts`, write `mcpServer.test.ts`.
4. Update `README.md` with the run command + example host config; verify CJS/ESM interop per ADR-003's
   Consequences before considering this step done.

## Risks / Tradeoffs

- `@modelcontextprotocol/sdk`'s module format (ESM vs CJS) against this repo's `tsconfig.json`
  (`"module": "commonjs"`) is unverified until step 3 — flagged in ADR-003, may require isolating the MCP entry
  point's module handling rather than a wider tsconfig change.
- `crawlPaths()` duplicates `crawlWorkspace()`'s traversal shape (see Tradeoff above) — accepted deliberately to
  avoid destabilizing the existing tree view.
- No CI currently runs `npm test` (per ADR-001, wiring CI was called out as a future follow-up) — this FR doesn't
  change that; the new tests only run locally via `npm test` like the rest of the suite today.
