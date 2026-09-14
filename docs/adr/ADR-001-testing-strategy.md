# ADR-001: Testing Strategy for the specmesh Extension

**Status**: Accepted
**Date**: 2026-09-14

## Context

specmesh (`src/`) currently has no automated tests and no test tooling in `package.json`. Almost every module
(`crawler.ts`, `docTypes.ts`, `repoConfig.ts`, `scaffold/*`, `tools/specmeshTools.ts`, `views/*`) imports the
`vscode` module directly, so most logic is only exercisable inside a real VS Code host. A small number of modules
(`crawler/frontMatter.ts`, `crawler/linkExtractor.ts`, `crawler/graph.ts`) are plain TypeScript with no `vscode`
dependency.

We need to pick one testing approach that:

- Covers both the `vscode`-free parsing/graph logic and the `vscode`-API-dependent crawler/scaffold/tools/views code.
- Fits a solo/small-team, early-stage extension (v0.6.0) without adding maintenance burden disproportionate to
  the project's size.
- Slots into the existing `tsc`-based build (`npm run compile` / `npm run watch`) without a second bundler/runner
  to maintain.

This is cross-cutting technical plumbing (per `docs/spec-driven-development.md`), not a user-facing feature, so
it's captured as an ADR rather than an FR.

## Options Considered

1. **`@vscode/test-cli` + `@vscode/test-electron` + Mocha** (the official VS Code extension testing toolchain).
   Tests run inside a real Extension Development Host, so the actual `vscode` module is available — no mocking
   needed for `Uri`, `workspace.fs`, `TreeItem`, etc. Same toolchain covers both pure-logic tests and
   `vscode`-API-dependent tests. Downsides: each test run launches a VS Code instance (slower than pure Node
   unit tests), and it's an extra devDependency surface.

2. **Jest or Vitest with a hand-rolled `vscode` mock module.** Fast, pure-Node unit tests. Downside: the `vscode`
   API surface actually used here is broad enough (`Uri`, `workspace.fs`, `TreeDataProvider`, `EventEmitter`,
   `languageModelTools`, diagnostics collections) that a hand-written mock would need constant upkeep and risks
   asserting against a fake API that drifts from real VS Code behavior — false confidence is worse than no test
   for the `vscode`-heavy modules.

3. **Split toolchain**: Vitest for the three `vscode`-free modules, `@vscode/test-cli`/`test-electron` for
   everything else. Most "accurate" coverage per module, but two test runners/configs to maintain for a project
   this size — violates simplicity-first for the value it adds today.

## Decision

Adopt **Option 1**: `@vscode/test-cli` + `@vscode/test-electron`, with Mocha as the test framework and Node's
built-in `assert/strict` for assertions (no extra assertion library).

- Test files live under `src/test/**/*.test.ts`, compiled by the existing `tsc` pipeline to `out/test/**/*.test.js`
  alongside the rest of the compiled output.
- A `.vscode-test.mjs` config at the repo root points the runner at `out/test/**/*.test.js`.
- `npm test` runs `pretest` (compile) then `vscode-test`.
- Initial coverage priority: `crawler/frontMatter.ts`, `crawler/linkExtractor.ts`, `crawler/graph.ts` first (pure
  logic, highest value-to-effort ratio), then `crawler/repoConfig.ts` and `scaffold/*` as they stabilize.
  `views/*` (tree providers/diagnostics) are thin wrappers over the `vscode` API — lower priority, covered
  opportunistically rather than blocking this decision on full coverage.

## Consequences

- New devDependencies: `@vscode/test-cli`, `@vscode/test-electron`, `mocha`, `@types/mocha`.
- `package.json` gets a `test` script (and `pretest`); `copilot-instructions.md`'s coding-guidelines placeholder
  for the build/test command gets filled in with `npm test`.
- Test runs are slower than pure-Node unit tests (Extension Development Host startup) — acceptable at this
  project's size; can be revisited if the suite grows large enough for that to matter.
- No CI workflow exists yet (`.github/workflows/` only has `release.yml`); wiring `npm test` into CI is a
  follow-up, not part of this decision.
- Future FR plans that touch tested modules should add/update tests as part of their own implementation
  (per each skill's Phase 4 "follow this workspace's existing conventions"), not via a separate testing skill.
