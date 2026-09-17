# Walkthrough: FR-011 Branch, Stage & Commit in the Central SCM View (v1)

## Files Changed

- [src/git/centralScm.ts](../../src/git/centralScm.ts) — replaced the single "Tracked docs" group with
  **Staged Changes** (index vs. `HEAD`, via new `parseLsFilesStage` + `computeChangeGroups`) and **Changes**
  (working tree vs. index); removed the old `classifySyncStatus`/`isPendingSync` model. Added
  `stageCentralChange`/`unstageCentralChange`/`stageAllCentralChanges`/`unstageAllCentralChanges` (staging via
  batched `git hash-object -w --stdin-paths` + `git update-index --add --index-info`, unstaging via batched
  `git reset HEAD --`, one `refresh()` per action instead of one per file), `commitCentral`
  (wired as both the "Commit" title command and `SourceControl.acceptInputCommand`), and `switchCentralBranch`
  (QuickPick of `parseBranchList`'d branches + "Create new branch…", with `parseCheckoutConflictFiles` turning
  git's own overwrite-conflict stderr into a named warning). `refresh()` runs its independent git spawns
  (`ls-tree`, `ls-files --stage`, `rev-parse --abbrev-ref HEAD`) and the workspace crawl concurrently via
  `Promise.all`, hashes on-disk content for every candidate path via one batched `git hash-object --stdin-paths`
  call, and caches the last crawl's nodes so stage/unstage/commit refreshes reuse them instead of re-crawling
  (a branch switch still forces a fresh crawl, since checkout can change which files exist). The current branch
  is shown via `sourceControl.statusBarCommands` (the sole branch-switch entry point — no separate `scm/title`
  icon). Also added `uncommitCentral` ("Undo Last Commit": `git reset --soft HEAD~1`, landing the undone
  commit's changes back in **Staged Changes**; warns instead of resetting if there's no parent commit).
- [src/git/gitPlumbing.ts](../../src/git/gitPlumbing.ts) — added an `input` option to `execGit` so it can pipe
  data to a git subprocess's stdin (needed for the batched `hash-object --stdin-paths` call).
- [src/git/specRepo.ts](../../src/git/specRepo.ts) — deleted `CentralSyncScheduler`, `formatCommitMessage`,
  and the `SyncKind` type (and the now-unused `toPosix`/`SYNC_DEBOUNCE_MS`), removing FR-009's
  debounced auto-commit-on-save entirely. `gitDirFor`, `findSpecGitRoot`, `enableCentralTracking`,
  `isUnderPath`, `isPathUntracked`, `setRepoUntracked`, and `showCentralHistory` are unchanged.
- [src/extension.ts](../../src/extension.ts) — dropped the `CentralSyncScheduler` instantiation and its
  `scheduleSync(...)` calls from the doc watcher (which still calls `scheduleRefresh()`, so the **Changes**
  group keeps picking up on-disk edits within the existing 500ms debounce); registered the six new commands.
  The doc watcher's own `refresh()` now passes its already-crawled nodes into `refreshCentralScm(nodes)`
  instead of triggering a second, redundant `crawlWorkspace()`; the manual "Refresh Central Doc Status" command
  still forces its own fresh crawl.
- [package.json](../../package.json) — the `scm/title` entries now use explicit `navigation@1`/`navigation@2`
  ordinals so "Commit" always renders before the "..." submenu (their relative order wasn't guaranteed by
  declaration order alone).
- [package.json](../../package.json) — added `specmesh.stageCentralChange`, `specmesh.unstageCentralChange`,
  `specmesh.stageAllCentralChanges`, `specmesh.unstageAllCentralChanges`, `specmesh.commitCentral`,
  `specmesh.uncommitCentral`, and `specmesh.switchCentralBranch`, plus `scm/resourceGroup/context` and
  `scm/resourceState/context` menu wiring scoped to `specmeshCentral`'s `changes`/`staged` groups. `scm/title`
  shows only the "Commit" icon directly; branch switch/refresh/show-history/undo-last-commit moved into a new
  `specmesh.centralScmActions` "$(ellipsis)" submenu (matching the built-in Git view's Commit-icon-plus-"..."-
  menu layout) so the branch action isn't duplicated alongside the status-bar branch button.
- [src/test/centralScm.test.ts](../../src/test/centralScm.test.ts) — replaced the
  `isPendingSync`/`classifySyncStatus` suites with tests for `parseLsFilesStage`, `computeChangeGroups`,
  `parseBranchList`, and `parseCheckoutConflictFiles`.
- [src/test/gitPlumbing.test.ts](../../src/test/gitPlumbing.test.ts) — removed the now-obsolete
  `formatCommitMessage` suite.
- [docs/FR-010-central-doc-history-scm-view/spec.v1.md](../FR-010-central-doc-history-scm-view/spec.v1.md) —
  noted that the postponed stage/commit/branch UI is picked up here.
- [docs/epics/EPIC-003-multi-repo-doc-tracking.md](../epics/EPIC-003-multi-repo-doc-tracking.md) — added FR-011
  to the Stories table and changelog.

## Build/Test Results

- `npx tsc -p ./ --noEmit`: clean.
- `npm test`: 44 passing, reconfirmed clean after the performance and menu fixes below.

## Fixes from the first review pass

- **Slow staging**: staging a file (or "stage all") took roughly a second per file. Root cause: every
  stage/unstage call triggered a full `refresh()`, which itself hashed every on-disk candidate path in its own
  `git hash-object` subprocess, and "stage all"/"unstage all" ran that per file in a loop instead of once.
  Fixed by batching on-disk hashing into a single `git hash-object --stdin-paths` call in `refresh()`, and by
  replacing the per-file staging/unstaging git calls with single batched `git add -- <paths...>` /
  `git reset HEAD -- <paths...>` calls (one `refresh()` per stage-all/unstage-all action, not one per file).
- **Duplicate branch icon**: the view showed two icons that both opened the same branch-switch QuickPick (the
  `scm/title` "Switch Central Branch" icon and the status-bar branch button). Removed the redundant `scm/title`
  icon — the status-bar button is now the only direct branch entry point — and moved it (plus Refresh/Show
  History) into a new "$(ellipsis)" submenu, so the view now matches the built-in Git view's convention: a
  single "Commit" icon plus a "..." menu for everything else.
- **Still slower than the built-in Git view (second pass)**: after the batching fix above, refresh() was
  still noticeably slower than the built-in Git view. Root cause: every refresh (a) ran four separate git
  subprocess spawns one after another, and (b) re-ran a full `crawlWorkspace()` (a whole-workspace
  `vscode.workspace.findFiles` walk) even for actions like stage/unstage/commit that can't change which files
  exist on disk. Fixed by (a) parallelizing the independent `ls-tree`/`ls-files --stage`/
  `rev-parse --abbrev-ref HEAD` calls (and the crawl) via `Promise.all`, and (b) caching the last crawl's
  nodes in `refresh()` and reusing them for stage/unstage/commit refreshes instead of re-crawling; a branch
  switch still forces a fresh crawl since checkout can add/remove/change files. The doc watcher's own refresh
  in `extension.ts` also now passes its already-crawled nodes into `refreshCentralScm(nodes)` instead of
  triggering a second, redundant crawl on every markdown edit.

## Addition after the second review pass

- **Undo Last Commit (FR-10)**: added on request, before final sign-off, since a small "uncommit" action was
  judged worth doing now rather than deferring to a follow-up FR. Soft-resets to the parent commit so the
  undone commit's changes reappear in **Staged Changes** rather than being discarded; shows a warning instead
  of erroring when there's no parent to reset to (e.g. right after the initial commit).

## Fix discovered while trying the addition above

- **Child-repo docs silently not staged**: "Stage All" (and single-file stage) only staged root-workspace
  docs — docs living inside a child repo declared via `.specmesh.yml` `repos:` (which has its own nested
  `.git`) were skipped, with no error. Root cause: the first-review-pass batching fix switched staging to
  plain `git add -- <paths...>`, and `git add` treats any path under a nested repo's own `.git` as a submodule
  boundary and silently skips it — confirmed by reproducing it in a scratch bare-repo + nested-child-repo
  setup. Fixed by reverting `stagePaths` to low-level plumbing (which has no such boundary check) while
  keeping it batched: one `git hash-object -w --stdin-paths` call over all paths, then one
  `git update-index --add --index-info` call for all of them. `unstagePaths`'s `git reset HEAD --` needed no
  change — `reset` doesn't have `add`'s submodule-boundary restriction (confirmed by the user's "unstage all"
  already having worked correctly across all 23 files, including child-repo ones).

## Manual Verification

This workspace doesn't currently have `.specmesh/spec.git` enabled, so — mirroring FR-010's own verification
approach — a scratch bare-repo + work-tree was used to confirm the exact git output/behavior
`centralScm.ts` depends on:

- `git ls-files --stage` output is tab-separated (`<mode> <sha> <stage>\t<path>`), matching
  `parseLsFilesStage`'s parsing exactly, and stays pointed at the last-staged blob after an on-disk-only edit
  (confirming the index is a stable "staged" snapshot independent of working-tree changes).
- `git branch --list` marks the current branch with a leading `* `, matching `parseBranchList`.
- `git checkout -b <name>` from the current `HEAD` never conflicts (same tree content), but checking out an
  *existing* branch whose committed content actually differs from an unstaged local edit fails with:
  `error: Your local changes to the following files would be overwritten by checkout:` followed by the
  indented file path(s) and a `Please commit...`/`Aborting` trailer — confirming `parseCheckoutConflictFiles`'s
  filtering (drop `error:`/`Please`/`Aborting` lines, keep the path lines) extracts exactly the right file list.

## Follow-ups / Known Gaps

- Live verification inside a real Extension Development Host (clicking Stage/Unstage/Commit/Switch Branch in
  the actual "specmesh (central)" view) hasn't been done yet — please run through it after enabling central
  tracking in a workspace, per tasks.v1.md's T11.
