# Tasks: FR-019 Standalone MCP Server for the Doc Graph (v1)

- [x] T1 — Extract `mergeTrackEntry` in `src/crawler/repoConfig.ts` (pure find-or-push logic from
      `UpdateTrackEntryTool.invoke`).
- [x] T2 — Create `src/queries/docQueries.ts` with `listDocs`, `findBrokenLinks`, `findOrphans`,
      `findMissingDocs`, `listRepos`, `getDocLinks` pure functions, mirroring today's tool output strings
      exactly.
- [x] T3 — Refactor each `*Tool.invoke` in `src/tools/specmeshTools.ts` to call the new pure functions
      (thin wrappers only — no behavior change).
- [x] T4 — Add `fast-glob` to `package.json` dependencies.
- [x] T5 — Add `loadRepoConfigFromPath` (Node-fs twin of `loadRepoConfig`). Discovered `repoConfig.ts` (and
      `docTypes.ts`) had a top-level `vscode` import that would transitively crash a standalone process, so
      split each into a vscode-free `*Core.ts` module (`repoConfigCore.ts`, `docTypesCore.ts`) re-exported by
      the original file, keeping every existing consumer's import path unchanged.
- [x] T6 — Create `src/crawler/crawlNode.ts` with `crawlPaths(roots)`, reusing existing pure helpers
      (importing `repoConfigCore`/`docTypesCore` directly, not `repoConfig`/`docTypes`, to stay vscode-free).
- [x] T7 — Write `src/test/crawlNode.test.ts` (temp-directory fixture, incl. a brace-list-exclude case).
- [x] T8 — Write `src/test/docQueries.test.ts` (hand-built `DocNode[]`/`Problem[]` fixtures).
- [x] T9 — Add `@modelcontextprotocol/sdk` to `package.json` dependencies; verify CJS/ESM interop against
      `tsconfig.json` (`"module": "commonjs"`) and adjust the MCP entry point's module handling if needed.
      Verified: the SDK ships dual ESM/CJS builds with a proper `exports` map, and its `typesVersions`
      fallback lets `tsc` resolve subpath import types even under this repo's classic module resolution;
      confirmed both `tsc --noEmit` and a plain `node -e "require(...)"` smoke check succeed. Also added
      `zod` as an explicit direct dependency (not just an implicit peer dep) since `McpServer` tool
      registration requires zod schemas directly in our own code (T10).
- [x] T10 — Create `src/mcpServer/tools.ts` (`registerAllTools`), registering all 8 tools against
      `crawlPaths` + the shared query functions + `mergeTrackEntry`.
- [x] T11 — Create `src/mcpServer/server.ts` (CLI-args-driven entry point, `StdioServerTransport`).
- [x] T12 — Write `src/test/mcpServer.test.ts` using `InMemoryTransport.createLinkedPair()` + `Client`,
      calling all 8 tools against a temp-directory fixture.
- [x] T12b — Write a standalone subprocess smoke test that spawns the real compiled `out/mcpServer/server.js`
      as a genuinely separate `node` process (no Extension Development Host) against a temp-directory fixture,
      sends a `listTools`/`callTool` request over its stdio transport, and asserts on the response — this is
      the only way to catch a transitive `vscode` import reintroduced by a future change, since the in-memory
      transport test (T12) and the rest of `npm test` always run inside a real extension host where `vscode`
      resolves fine.
- [x] T13 — Add a `"bin"` entry (or documented run command) to `package.json`; update `README.md` with the
      run command and an example MCP host config snippet.
- [x] T14 — Run `npm test` and fix any build/test failures. Final run: 139 passing, 0 failing.
