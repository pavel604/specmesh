# Walkthrough: FR-009 Cross-Repo Detached Doc Tracking (v1)

## Files Changed

- [src/git/gitPlumbing.ts](../../src/git/gitPlumbing.ts) — new. `execGit` (`child_process.execFile`, no shell)
  and cached `isGitAvailable()`.
- [src/git/specRepo.ts](../../src/git/specRepo.ts) — new. `findSpecGitRoot`, `enableCentralTracking`,
  `CentralSyncScheduler` (debounced upsert/remove batching + commit), `formatCommitMessage`,
  `showCentralHistory`, `setRepoUntracked`/`isUnderPath` helpers.
- [src/git/repoMigration.ts](../../src/git/repoMigration.ts) — new. `pickRepoTarget`, `migrateRepoToCentral`,
  `untrackRepoFromCentral`, and the pure `computeGitignoreAdditions`/`computeGitignoreRemovals` helpers.
- [src/crawler/crawler.ts](../../src/crawler/crawler.ts) — new `withSpecmeshExclude` helper; always merges
  `.specmesh/**` into the exclude pattern used for doc-type glob matching.
- [src/scaffold/scaffold.ts](../../src/scaffold/scaffold.ts) — calls `enableCentralTracking` with the resolved
  `root` folder at the end of `scaffoldSdlc`.
- [src/extension.ts](../../src/extension.ts) — constructs one `CentralSyncScheduler`; the doc watcher's
  change/create/delete handlers also call `scheduleSync`; registers `specmesh.enableCentralTracking`,
  `specmesh.migrateRepoDocs`, `specmesh.untrackRepoDocs`, `specmesh.showCentralHistory`; passes `repos` through
  to `treeProvider.update()`.
- [src/views/docsTreeProvider.ts](../../src/views/docsTreeProvider.ts) — new `"repo"` tree-item kind so a
  **present**, correctly-declared repo renders under "Declared Repos" too, not just missing/erroring ones (see
  Found-and-Fixed During Review below).
- [package.json](../../package.json) — the 4 new commands + a `3_specmesh` submenu group.
- [src/test/gitPlumbing.test.ts](../../src/test/gitPlumbing.test.ts) — new tests for `formatCommitMessage`,
  `withSpecmeshExclude`, `computeGitignoreAdditions`, `computeGitignoreRemovals`.

## Found and Fixed During Review

You reported that "Declared Repos" only ever appeared in the Docs Explorer when something was wrong (a missing
path or a malformed manifest entry) — a correctly-declared, present repo never showed up at all, making it
impossible to visually confirm a `repos:` entry was recognized before running Migrate/Untrack. This was a
pre-existing gap from FR-008: the tree only ever rendered `DeclaredRepo`s indirectly, through `Problem`s, and a
present/valid repo produces no `Problem` and no `DocNode`. Fixed by giving `DeclaredRepo` its own `"repo"`
tree-item kind, rendered under "Declared Repos" whenever a folder has any declared repos at all (present ones
show as plain rows; missing/erroring ones still render exactly as before via the existing `"missing"` kind).

## Implementation Note: Deviation from the Plan

The plan described appending the matched doc-type **glob** pattern(s) to a migrated repo's `.gitignore`.
Implemented instead with the migrated files' own **literal relative paths** — `DocNode` doesn't carry its
originating glob string, and re-deriving it per file would need re-resolving that folder's doc-type config a
second time. Literal paths are unambiguous, always precise, and satisfy the same underlying intent (stop that
repo's own git from tracking exactly the files central tracking now owns). `Untrack` reverses the same literal
paths, keeping the two commands symmetric.

## Build/Test Results

- `npm test`: 32 passing (28 previous + 4 new).
- `tsc --noEmit`: no errors.

## Manual Verification

Real git-subprocess behavior can't be exercised by the existing Mocha suite (per the plan's Testing Approach),
so the actual command sequences used by the code were verified directly against a scratch temp directory
(outside this repo) via three rounds of terminal-based checks:

- **Found and fixed a real bug during verification**: the first pass showed `git hash-object -w <path>` (without
  an explicit `--git-dir`) writes the blob into whichever git repository is nearest to the process's *cwd* —
  not necessarily `.specmesh/spec.git`. In a nested-repo layout this silently wrote blobs into the wrong repo's
  object store. Fixed by always passing `--git-dir` to `hash-object` too, confirmed by a second round showing
  the blob now lands in `.specmesh/spec.git`'s own object store and the root repo's own git correctly still
  shows the doc file as untracked.
- Confirmed the "no-op" resave case: git's "nothing added to commit" message is emitted on **stdout**, not
  stderr, with exit code 1 — `execGit` was updated to fold stdout into the rejected error's message so the
  scheduler's no-op detection regex actually has something to match; verified the real message text
  (`"nothing added to commit but untracked files present (use \"git add\" to track)"`) matches it.
- Confirmed a real content change commits successfully, and a removal (`update-index --remove` + commit)
  correctly drops the path from `git ls-tree -r HEAD`.
- Confirmed corrupt-central-repo detection: `git --git-dir=<path> rev-parse --git-dir` exits 0 for a valid bare
  repo and exits 128 once its `HEAD` file is removed, matching `enableCentralTracking`'s reinit-detection branch.
- Confirmed the child-repo migrate/untrack round trip: `git rm --cached -f` succeeds even against a file with
  uncommitted local modifications and leaves the modified working-tree content untouched (shows as untracked
  afterward); `git add` afterward successfully restores tracking.

Not exercised: the actual VS Code commands (`specmesh.enableCentralTracking`, `.migrateRepoDocs`,
`.untrackRepoDocs`, `.showCentralHistory`) end-to-end inside a running Extension Development Host — that
requires an interactive F5 session, the same way FR-008's tree/tool behavior was ultimately confirmed by you
rather than by me directly. Suggest running each of the 4 new commands (via the Command Palette or the Docs
Explorer's "More Actions" menu) against this repo itself once, the same way FR-008 was verified.

## Follow-ups / Known Gaps

- `.gitignore`-based literal paths (see deviation note above) mean a later rename of a migrated doc file leaves
  a stale line in the repo's `.gitignore` until the next Migrate run re-adds the new path — harmless (an unused
  ignore line), not cleaned up automatically.
- None outstanding beyond the interactive command verification noted above.
