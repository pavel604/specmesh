# FR-018 Plan: `${workspaceFolder}` Markdown Link Resolution

**Revision**: 1
**Status**: Approved

## Approach

`resolveLinkTarget` in `src/crawler/crawler.ts` currently only resolves a link target relative to the linking
file's own directory via `path.resolve(path.dirname(fromFile), withoutAnchor)`. Add a third parameter,
`workspaceFolderPath`, and detect a `${workspaceFolder}` prefix before falling back to the existing relative
resolution:

- If `withoutAnchor === "${workspaceFolder}"` or it starts with `"${workspaceFolder}/"`, strip that literal
  prefix and resolve the remainder against `workspaceFolderPath` (e.g.
  `path.resolve(workspaceFolderPath, remainder)`).
- Otherwise, resolve relative to `path.dirname(fromFile)` exactly as today.

The one call site (inside `crawlWorkspaceFolder`'s per-doc `rawLinks.map(...)`) already has `folder.uri.fsPath`
in scope, so it just needs to pass it through as the new third argument.

`resolveLinkTarget` becomes exported (it currently isn't) so it can be unit-tested directly, following the
same pure-function testing pattern used for `linkExtractor.ts`/`docMatchesFilter` — no VS Code API test harness
needed for this logic.

## Files to Change

- `src/crawler/crawler.ts`:
  - Export `resolveLinkTarget` and add a `workspaceFolderPath: string` parameter.
  - Add the `${workspaceFolder}` prefix check described above.
  - Update the single call site to pass `folder.uri.fsPath`.
- `src/test/crawler.test.ts` (new file):
  - Unit tests for `resolveLinkTarget` covering: plain relative resolution unchanged (regression guard),
    `${workspaceFolder}/...` resolves against the workspace folder root regardless of the linking file's
    nesting depth, bare `${workspaceFolder}` (no trailing path) resolves to the folder root itself, and a
    `${workspaceFolder}`-prefixed target that doesn't exist still resolves to a (non-existent) absolute path
    rather than silently returning `null` — existence is checked separately by `existsSafe` at the call site,
    consistent with today's behavior for plain relative targets.
- `README.md`:
  - Update the existing "Broken cross-repo link detection" bullet to mention `${workspaceFolder}/...`-prefixed
    links are also resolved (in addition to plain relative links).

## Out of Scope / No Changes Needed

- No changes to `src/crawler/linkExtractor.ts` — target string extraction is unaffected, only resolution
  changes.
- No changes to `src/views/diagnostics.ts` or `src/crawler/graph.ts` — they consume `DocLink.exists`/
  `resolvedAbsolutePath` as-is; fixing resolution upstream fixes their output automatically.
- No new ADR — no new dependency, pure logic fix to an existing internal function.
- No `package.json` changes — no new command/setting.

## Testing

- New `src/test/crawler.test.ts` unit tests per above (pure function, no VS Code API needed — follows
  ADR-001's preference for plain Mocha/`assert` tests where a VS Code API isn't required).
- Run full suite via `npm test` to confirm no regressions (existing count: 101 passing).
