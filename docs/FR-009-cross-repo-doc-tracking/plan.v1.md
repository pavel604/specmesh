# Implementation Plan: FR-009 Cross-Repo Detached Doc Tracking (v1)

**Status**: Approved

## Affected Files/Projects

- [src/git/gitPlumbing.ts](../../src/git/gitPlumbing.ts) — new. Low-level `git` subprocess wrapper.
- [src/git/specRepo.ts](../../src/git/specRepo.ts) — new. `.specmesh/spec.git` lifecycle, sync scheduler, history.
- [src/git/repoMigration.ts](../../src/git/repoMigration.ts) — new. Migrate/Untrack logic for one repo at a time.
- [src/crawler/crawler.ts](../../src/crawler/crawler.ts) — always exclude `.specmesh/**` from glob matching.
- [src/scaffold/scaffold.ts](../../src/scaffold/scaffold.ts) — call `enableCentralTracking` at the end of scaffolding.
- [src/extension.ts](../../src/extension.ts) — register 4 new commands, hook the doc watcher into the sync scheduler.
- [package.json](../../package.json) — 4 new command contributions + submenu entries.
- [src/test/gitPlumbing.test.ts](../../src/test/gitPlumbing.test.ts) — new. Pure-logic unit tests (commit message
  formatting, exclude-merging, glob dedup).

## Approach

### Low-level git wrapper (`src/git/gitPlumbing.ts`)

- `execGit(args: string[], options?: { cwd?: string }): Promise<string>` — runs `git` via `child_process.execFile`
  (never a shell string) and resolves with trimmed stdout, or rejects with the captured stderr. Using `execFile`
  with an argument array (not `exec`) avoids shell-injection risk from any path/message that ends up in `args`.
- `isGitAvailable(): Promise<boolean>` — caches the result of `execGit(["--version"])` for the extension's
  lifetime so a missing `git` binary is only checked (and only warns) once, per FR-9.

### Central repo lifecycle (`src/git/specRepo.ts`)

- `findSpecGitRoot(): vscode.WorkspaceFolder | undefined` — scans `vscode.workspace.workspaceFolders` for the one
  containing `.specmesh/spec.git` on disk (`fs.existsSync`). This is the sole source of truth for "is central
  tracking enabled, and where" — no separate persisted setting is needed.
- `enableCentralTracking(context, outputChannel): Promise<void>`:
  1. If `findSpecGitRoot()` already returns a folder, show an info message and return (FR-1 no-op case).
  2. If exactly one workspace folder is open, use it as root; otherwise reuse the same `pickRoot`-style
     `showQuickPick` prompt already used by `scaffoldSdlc` (factored out of `scaffold.ts` into a small shared
     helper so both call sites stay in sync) to ask which folder is root.
  3. Check `isGitAvailable()`; if false, warn and stop (FR-9).
  4. `ensureDir(.specmesh)`, then `execGit(["init", "--bare", ".specmesh/spec.git"], { cwd: root.fsPath })`. If
     `.specmesh/spec.git` already exists on disk but `execGit(["--git-dir", gitDir, "rev-parse", "--git-dir"])`
     fails, ask for confirmation to delete and reinitialize it (recovers from a corrupt/partial prior attempt)
     rather than failing forever.
  5. Ensure the root folder's own `.gitignore` contains a `.specmesh/` line (append, creating the file if
     missing; skip if the line is already present) — keeps the root repo's own git from seeing `.specmesh/`
     as an untracked embedded repo.
  6. Log success to `outputChannel` and return the root folder so callers (e.g. scaffold) can proceed.
- `CentralSyncScheduler` class, constructed once in `activate()` when a spec-git root is found (or after Enable
  runs):
  - `scheduleSync(absolutePath: string, kind: "upsert" | "remove")`: records the change in an in-memory
    `Map<string, "upsert" | "remove">` keyed by absolute path (last write wins for a given path within one
    debounce window) and (re)starts a 500ms timer — the same debounce constant already used by `extension.ts`'s
    `scheduleRefresh`.
  - On timer fire, for each pending path relative to the spec-git root (`path.relative(root, absolutePath)`,
    posix-slashed):
    - `upsert`: `execGit(["hash-object", "-w", absolutePath])` → sha, then
      `execGit(["--git-dir", gitDir, "--work-tree", root, "update-index", "--add", "--cacheinfo", \`100644,${sha},${relPath}\`])`.
    - `remove`: `execGit(["--git-dir", gitDir, "--work-tree", root, "update-index", "--remove", "--", relPath])`.
  - After applying all pending changes, if the set was non-empty: `execGit(["--git-dir", gitDir, "--work-tree",
    root, "commit", "-m", formatCommitMessage(paths)])`. `formatCommitMessage` is an exported **pure** function
    (`paths.length <= 5` → newline-separated list; otherwise `"specmesh: sync N doc(s)"`) so it's unit-testable
    without a real git process — mirrors the existing `computeStatusMessage` pattern in `extension.ts`.
  - Every `execGit` call here always passes `--git-dir`/`--work-tree` explicitly (FR-11) — never relies on a
    persisted `core.worktree`.
  - Failures (e.g. `git` disappeared mid-session) surface once via `outputChannel` + a warning notification,
    then a boolean latch suppresses repeat warnings for subsequent syncs (FR-9), reset only on the next
    successful sync.
- `showCentralHistory(outputChannel): Promise<void>` — `execGit(["--git-dir", gitDir, "log", "--oneline", "-20"])`
  and print the output (or "no commits yet" / "not enabled yet") to the channel, then `outputChannel.show()`.

### Migrate / Untrack (`src/git/repoMigration.ts`)

- `pickRepoTarget(): Promise<{ label: string; absolutePath: string } | undefined>` — quickpick built from
  `crawlWorkspace()`'s root folder(s) and `repos` (declared, `present` only), reused by both commands.
- `docFilesUnder(repoAbsolutePath): Promise<{ node: DocNode; relativeToRepo: string }[]>` — calls
  `crawlWorkspace()`, filters nodes whose `absolutePath` starts with `repoAbsolutePath`, **excluding** any that
  also fall under a *different, more specific* declared repo's path (so migrating the root doesn't double-handle
  files that physically live inside a child repo, and vice versa).
- `migrateRepoToCentral(repoAbsolutePath, outputChannel)`:
  1. Confirm via `showWarningMessage(..., { modal: true }, "Migrate")` (FR-7's required confirmation).
  2. For each doc file under the repo: `execGit(["-C", repoAbsolutePath, "rm", "--cached", "-f", "--",
     relativeToRepo])`, always with `-f` so it succeeds regardless of the repo's dirty/clean state (the
     working-tree file is untouched either way — `--cached` never deletes it).
  3. Collect the distinct `def.glob` values among the migrated files' doc types, append any not already present
     (idempotency check) to that repo's `.gitignore` (creating it if missing).
  4. Log a summary to `outputChannel`.
- `untrackRepoFromCentral(repoAbsolutePath, context, outputChannel)`:
  1. Confirm via the same modal pattern.
  2. Remove this repo's previously-appended glob lines from its `.gitignore` (idempotent — no-op if absent).
  3. `execGit(["-C", repoAbsolutePath, "add", "--", ...relativePaths])` to restore the repo's own tracking.
  4. Record `repoAbsolutePath` in `context.workspaceState`'s `"specmesh.untrackedRepos"` string array (created
     if absent) — this is the persisted gate `CentralSyncScheduler` checks before scheduling a sync for a path,
     so central tracking genuinely stops for that repo going forward (FR-8's "stops... going forward") without
     touching `.specmesh/spec.git`'s already-committed history for those paths.
  4. Log a summary to `outputChannel`.
- `CentralSyncScheduler.scheduleSync` consults the same `workspaceState` list and skips paths under an untracked
  repo, so Migrate/Untrack and the scheduler share one source of truth.

### Crawler exclusion (`src/crawler/crawler.ts`)

- When building each doc type's `excludePattern`, always merge in `.specmesh/**` alongside any `def.exclude`
  (small pure helper `withSpecmeshExclude(exclude?: string[]): string[]`, unit-tested) — covers custom/broad
  user globs (e.g. `**/*.md`) that would otherwise reach into `.specmesh/spec.git`'s own working files.

### Scaffold hook (`src/scaffold/scaffold.ts`)

- After the existing per-repo loop, call `enableCentralTracking(context, outputChannel)` using the already-
  chosen `root` folder directly (skips its own root-picking step since `scaffoldSdlc` already resolved `root`).
  If `git` isn't available, this logs a line and scaffold otherwise completes normally (FR-9's graceful
  degradation applies here too — scaffolding must not fail because central tracking couldn't enable).

### Wiring (`src/extension.ts`)

- Construct one `CentralSyncScheduler` in `activate()`.
- Extend the existing `watcher.onDidChange` / `onDidCreate` handlers to also call
  `scheduler.scheduleSync(uri.fsPath, "upsert")`, and `onDidDelete` to call `scheduleSync(uri.fsPath, "remove")`
  — alongside (not instead of) the existing `scheduleRefresh()` call.
- Register `specmesh.enableCentralTracking`, `specmesh.migrateRepoDocs`, `specmesh.untrackRepoDocs`,
  `specmesh.showCentralHistory`, each a thin wrapper delegating to the modules above.

### `package.json`

- Add the 4 commands above (titles: "specmesh: Enable Cross-Repo Doc Tracking", "specmesh: Migrate Repo Docs to
  Central Tracking", "specmesh: Untrack Repo from Central Tracking", "specmesh: Show Central Doc History").
- Add them to the `specmesh.docsExplorerActions` submenu in a new `3_specmesh` group, after the existing
  `2_specmesh` (scaffold) group.

## Sequencing

1. `gitPlumbing.ts` (`execGit`, `isGitAvailable`) — no dependents yet, easy to unit-test in isolation.
2. `specRepo.ts` (enable + scheduler + history) — depends on step 1.
3. `crawler.ts` exclusion helper — independent of steps 1-2, can land any time.
4. `repoMigration.ts` — depends on step 1 and on `crawlWorkspace()`'s existing `repos`/`nodes`.
5. `scaffold.ts` hook — depends on step 2.
6. `extension.ts` wiring + `package.json` — depends on steps 2 and 4.
7. Unit tests for the pure helpers (`formatCommitMessage`, `withSpecmeshExclude`).
8. Manual verification (per Testing Approach below) — real `git` subprocess behavior isn't covered by the
   existing Mocha suite's style, so this FR is verified the same way FR-008 was: a manual Extension Development
   Host pass exercising Enable → save a doc → Show Central Doc History → Migrate → Untrack.

## Testing Approach

- Unit tests cover only the pure, side-effect-free helpers: `formatCommitMessage`, `withSpecmeshExclude`, and the
  glob-dedup logic in `migrateRepoToCentral`'s `.gitignore`-line computation (factored out as a pure function
  taking a glob list and existing `.gitignore` text, returning the lines to append).
- Actual git subprocess behavior (init, hash-object, update-index, commit, rm --cached) is verified manually in
  the Extension Development Host against this repo itself, the same way FR-008's `repos:` manifest was verified
  — introducing a temp-git-repo test harness is judged out of proportion to this FR's scope (see Risks).

## Risks / Tradeoffs

- No automated test coverage for the actual git subprocess flows (init/hash-object/update-index/commit/rm
  --cached) — only their surrounding pure logic is unit-tested. Accepted tradeoff: building a throwaway-temp-git-
  repo test harness inside the existing `@vscode/test-cli`/Mocha suite is a meaningfully larger effort than this
  FR's other work, and manual verification mirrors how FR-008 was already validated.
- `findSpecGitRoot()`'s disk-existence check runs synchronously per activation/command — negligible cost (one
  `fs.existsSync` per open folder) but worth naming as a minor tradeoff vs. caching in `workspaceState`.
- Migrate/Untrack operate on one repo at a time by design (per spec) — a user with many child repos runs the
  command once per repo; batching all repos in one action was deliberately left out to keep each action's blast
  radius small and reviewable.
- `context.workspaceState` (not `.specmesh.yml` or another on-disk file) is the source of truth for "which repos
  are untracked" — simplest option with no new file format, but it means that state doesn't travel with the
  repo itself (e.g. a teammate opening the same workspace fresh won't see prior Untrack actions reflected until
  they're re-run, or reflected implicitly by an already-empty `.gitignore` diff at the git level). Acceptable
  since Untrack's git-visible side effects (`.gitignore`, restored tracking) are the real, shared state; the
  workspaceState flag only gates *this window's* live sync scheduler.
