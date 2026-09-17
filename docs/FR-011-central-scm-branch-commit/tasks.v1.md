# Tasks: FR-011 Branch, Stage & Commit in the Central SCM View (v1)

- [x] T1 — In `src/git/specRepo.ts`, delete `CentralSyncScheduler`, `formatCommitMessage`, and the `SyncKind`
      type.
- [x] T2 — In `src/git/centralScm.ts`, add pure helpers `parseLsFilesStage(output)`, `computeChangeGroups(headTree,
      indexTree, onDiskShas, candidatePaths)`, `parseBranchList(output)`, and `parseCheckoutConflictFiles(stderr)`;
      remove `classifySyncStatus`/`isPendingSync`.
- [x] T3 — In `src/test/centralScm.test.ts`, replace the `isPendingSync`/`classifySyncStatus` suites with tests
      for `parseLsFilesStage`, `computeChangeGroups`, `parseBranchList`, and `parseCheckoutConflictFiles`.
- [x] T4 — In `src/git/centralScm.ts`, rewrite `refresh()` to build the `"staged"`/`"Staged Changes"` and
      `"changes"`/`"Changes"` resource groups via `computeChangeGroups`, replacing the single `"tracked"` group;
      wire each resource's diff command per group (Changes: on-disk vs. index-or-HEAD; Staged: index vs. HEAD).
- [x] T5 — In `src/git/centralScm.ts`, drop the `syncScheduler` parameter from `ensureCentralScmProvider` and
      remove the `onDidSync` subscription.
- [x] T6 — In `src/git/centralScm.ts`, add `stageCentralChange`, `unstageCentralChange`,
      `stageAllCentralChanges`, `unstageAllCentralChanges`, each re-running `refresh()` on completion.
- [x] T7 — In `src/git/centralScm.ts`, add `commitCentral` (reads/validates the input box, commits staged
      changes, clears the input box, refreshes); set `sourceControl.acceptInputCommand` to it in
      `ensureCentralScmProvider`.
- [x] T8 — In `src/git/centralScm.ts`, add `switchCentralBranch` (QuickPick of branches + "Create new
      branch…", checkout, conflict-warning handling) and maintain `sourceControl.statusBarCommands` with the
      current branch label inside `refresh()`.
- [x] T9 — In `src/extension.ts`, remove the `CentralSyncScheduler` import/instantiation and the
      `syncScheduler.scheduleSync(...)` calls in the doc watcher; drop the `syncScheduler` argument from both
      `ensureCentralScmProvider(...)` call sites; register `specmesh.stageCentralChange`,
      `specmesh.unstageCentralChange`, `specmesh.stageAllCentralChanges`, `specmesh.unstageAllCentralChanges`,
      `specmesh.commitCentral`, and `specmesh.switchCentralBranch`.
- [x] T10 — In `package.json`, add the six new commands (with icons) and their `scm/title`,
      `scm/resourceState/context`, and `scm/resourceGroup/context` menu entries scoped to
      `scmProvider == specmeshCentral` (and `scmResourceGroup == changes`/`staged` where applicable).
- [ ] T11 — Manually verify against this repo's own `.specmesh/spec.git`: editing a doc shows it under
      **Changes**; staging moves it to **Staged Changes**; committing clears both groups and appears in `git
      log`; branch switch works for an existing branch and for "Create new branch…"; a checkout attempted with
      an unstaged edit present surfaces the conflict warning instead of silently failing.
- [x] T12 — Fix: staging was ridiculously slow (~1s per file, one-by-one for "stage all") because
      `stageCentralChange`/`unstageCentralChange` each ran a full `refresh()` (which itself hashed every
      on-disk candidate path in its own subprocess call), and `stageAllCentralChanges`/`unstageAllCentralChanges`
      called those per-file in a loop. In `src/git/gitPlumbing.ts`, added an `input` option to `execGit` so it
      can pipe stdin to `git`. In `src/git/centralScm.ts`, batched on-disk hashing in `refresh()` into one
      `git hash-object --stdin-paths` call, and replaced the old per-file `hash-object -w` +
      `update-index --cacheinfo` staging / `reset`-or-`force-remove` unstaging with single batched
      `git add -- <paths...>` / `git reset HEAD -- <paths...>` calls (one `refresh()` per stage-all/unstage-all
      action instead of one per file).
- [x] T13 — Fix: the view showed two branch-switching entry points (the `scm/title` "Switch Central Branch"
      icon and the status-bar branch button), both opening the same picker. Removed the direct `scm/title` icon
      for `specmesh.switchCentralBranch` (kept only as the `sourceControl.statusBarCommands` branch button) and
      moved it — alongside `specmesh.refreshCentralScm`/`specmesh.showCentralHistory` — into a new
      `specmesh.centralScmActions` "$(ellipsis)" submenu, matching the built-in Git view's convention of a
      direct Commit icon plus a "..." menu for everything else.
- [x] T14 — Fix: after batching the git calls, refresh() was still noticeably slower than the built-in Git
      view because every refresh (a) ran its four git spawns sequentially and (b) re-ran a full
      `crawlWorkspace()` (which walks the whole workspace via `vscode.workspace.findFiles`) even for actions
      that don't change which files exist on disk. In `src/git/centralScm.ts`: (a) parallelized the
      independent `ls-tree`/`ls-files --stage`/`rev-parse --abbrev-ref HEAD` git calls (and the crawl) via
      `Promise.all`; (b) `refresh()` now accepts an optional `freshNodes` param and caches the last crawl's
      nodes, reusing the cache for stage/unstage/commit refreshes (which can't change the file list) instead
      of re-crawling; a branch switch forces a genuinely fresh crawl (checkout can add/remove/change files).
      In `src/extension.ts`, the doc-watcher's `refresh()` now passes its own already-crawled `nodes` into
      `refreshCentralScm(nodes)` instead of triggering a second, redundant crawl; the manual "Refresh Central
      Doc Status" command still forces its own fresh crawl.
- [x] T15 — Fix: the "..." submenu rendered before the "Commit" icon in the SCM title bar instead of after it.
      In `package.json`, gave the `scm/title` entries explicit `navigation@1`/`navigation@2` ordinals
      (`specmesh.commitCentral` then the `specmesh.centralScmActions` submenu) so Commit always renders first
      and the "..." menu last, regardless of declaration-order ambiguity.
- [x] T16 — Addition: added "Undo Last Commit" (FR-10). In `src/git/centralScm.ts`, added `uncommitCentral`
      (`git reset --soft HEAD~1`, warns instead of resetting if there's no parent commit). Registered
      `specmesh.uncommitCentral` in `src/extension.ts` and added it to the `specmesh.centralScmActions`
      submenu in `package.json` (its own `2_specmesh` group, separated from branch/refresh/history).
- [x] T17 — Fix: "Stage All" (and single-file stage) silently skipped docs living inside a child repo declared
      via `.specmesh.yml` `repos:` (a nested `.git` directory under the tracked work-tree) — only root-level
      docs got staged. Root cause: T12's `stagePaths` used plain `git add -- <paths...>`, and `git add` treats
      any path under a nested repo's own `.git` as a submodule boundary and silently skips it (confirmed via a
      scratch bare-repo + nested-child-repo reproduction). Fixed by reverting `stagePaths` to low-level
      plumbing that doesn't have that restriction, while keeping it batched: one `git hash-object -w
      --stdin-paths` call over all paths, then one `git update-index --add --index-info` call for all of
      them (`unstagePaths`'s `git reset HEAD --` was unaffected — `reset` doesn't have `add`'s submodule-
      boundary check, confirmed by the user's unstage-all having worked correctly on all 23 files).

