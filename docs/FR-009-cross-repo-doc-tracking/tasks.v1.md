# Tasks: FR-009 Cross-Repo Detached Doc Tracking (v1)

- [x] T1 — Create `src/git/gitPlumbing.ts`: `execGit(args, options?)` via `child_process.execFile` (no shell),
      and `isGitAvailable()` (cached).
- [x] T2 — Create `src/git/specRepo.ts`: `findSpecGitRoot()`, `enableCentralTracking(context, outputChannel)`
      (root picking, bare-repo init, corrupt-repo recovery prompt, root `.gitignore` update), the
      `CentralSyncScheduler` class (debounced upsert/remove batching + commit), the exported pure
      `formatCommitMessage(paths)` helper, and `showCentralHistory(outputChannel)`.
- [x] T3 — In `src/crawler/crawler.ts`, add a pure `withSpecmeshExclude(exclude?)` helper and use it wherever
      `excludePattern` is built, so `.specmesh/**` is always excluded from doc-type glob matching.
- [x] T4 — Create `src/git/repoMigration.ts`: `pickRepoTarget()`, `docFilesUnder(repoAbsolutePath)`,
      `migrateRepoToCentral(repoAbsolutePath, outputChannel)`, `untrackRepoFromCentral(repoAbsolutePath, context,
      outputChannel)`, and the pure `.gitignore`-line computation helper used by both.
- [x] T5 — Wire `CentralSyncScheduler`'s untracked-repo check to `context.workspaceState`'s
      `"specmesh.untrackedRepos"` list, shared with `untrackRepoFromCentral`'s writes to that same key.
- [x] T6 — In `src/scaffold/scaffold.ts`, call `enableCentralTracking(context, outputChannel)` with the already-
      resolved `root` folder at the end of `scaffoldSdlc`, tolerating a missing `git` binary gracefully.
- [x] T7 — In `src/extension.ts`: construct one `CentralSyncScheduler`; extend the doc watcher's
      change/create/delete handlers to also call `scheduleSync`; register `specmesh.enableCentralTracking`,
      `specmesh.migrateRepoDocs`, `specmesh.untrackRepoDocs`, `specmesh.showCentralHistory`.
- [x] T8 — Add the 4 new commands to `package.json` (`commands` + `specmesh.docsExplorerActions` submenu, new
      `3_specmesh` group).
- [x] T9 — Write `src/test/gitPlumbing.test.ts` covering `formatCommitMessage` (short list vs. count fallback)
      and `withSpecmeshExclude` (merges without duplicating).
- [x] T10 — Manually verify in the Extension Development Host, against this repo itself: Enable creates
      `.specmesh/spec.git` and adds `.specmesh/` to the root `.gitignore`; saving a tracked doc followed by a
      quiet period produces a commit visible via Show Central Doc History; Migrate on a repo `git rm --cached`s
      its doc files and updates its `.gitignore`; Untrack reverses both and further saves to that repo's docs no
      longer produce central commits. Clean up any temporary state used for verification afterward.
- [x] T11 — Fix: `docsTreeProvider.ts` never rendered a present, correctly-declared repo (only missing/erroring
      ones) — add a `"repo"` tree-item kind and render it under "Declared Repos" whenever a folder has any
      declared repos, wired from `crawlWorkspace().repos` through `extension.ts`'s `refresh()`.
