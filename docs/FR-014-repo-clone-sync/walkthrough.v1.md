# Walkthrough: FR-014 Declared Repo Clone & Sync (v1)

## Files Changed

- [src/crawler/repoConfig.ts](../../src/crawler/repoConfig.ts) — `specRepoRemote`/`specRepoRemoteError` on
  `RepoConfig`, `parseSpecRepoRemote()`, and `writeSpecRepoRemote()` (CST-preserving YAML write via `yaml`'s
  `parseDocument`). (T1)
- [src/test/repoConfig.test.ts](../../src/test/repoConfig.test.ts) — `parseSpecRepoRemote` unit tests. (T2)
- [src/git/specRepo.ts](../../src/git/specRepo.ts) — exported `ensureGitignoreEntry` for reuse. (T3)
- [src/git/repoMigration.ts](../../src/git/repoMigration.ts) — exported `toPosix` for reuse. (T3)
- [src/git/repoSync.ts](../../src/git/repoSync.ts) — **new**: `diffDeclaredRepos`, `pickMirroredRemoteUrl`,
  `cloneDeclaredRepo`, `syncCloneRepos`, `promptForNewRepos`, `promptForRemovedRepos`. (T4, T6, T7, T8)
  `promptForRemovedRepos` now catches and reports a per-repo delete failure instead of letting it abort the
  remaining prompts (T13 fix).
- [src/test/repoSync.test.ts](../../src/test/repoSync.test.ts) — **new**: covers every scenario from the spec's
  Testing Expectations (single/multiple add, single/multiple remove, mixed batches, already-present no-ops,
  0/1/2+ remote mirroring). (T5)
- [src/git/centralScm.ts](../../src/git/centralScm.ts) — `mirrorSpecRepoRemote()` plus call sites in
  `addRemoteFlow`, and the "Edit URL…"/"Remove" branches of `manageCentralRemotes`, so `specRepoRemote` follows
  the central repo's remote automatically. `addRemoteFlow`/`pickOrAddRemote` now take a `root` parameter. (T9)
- [src/extension.ts](../../src/extension.ts) — registers `specmesh.syncCloneRepos`; tracks `previousRepos` across
  refreshes and fires `promptForNewRepos`/`promptForRemovedRepos` per affected workspace folder when
  `.specmesh.yml`'s `repos:` list changes. `previousRepos` is now advanced immediately after each crawl (not
  after the prompts), so a prompt-loop failure can no longer leave it permanently stale (T13 fix). (T10)
- [package.json](../../package.json) — `specmesh.syncCloneRepos` command + "More Actions" menu entry. (T11)

## Build/Test Results

- `npm run compile`: succeeded, no TypeScript errors.
- `npm test`: 80 passing, 0 failing (includes the new `repoConfig`/`repoSync` suites).

## Follow-ups / Known Gaps

- **T13 fix applied**: your report ("removed two repos, only one prompt appeared, both folders still there")
  pointed to `promptForRemovedRepos`'s delete call having no error handling -- a failed delete aborted the loop
  before the second prompt, and `extension.ts` never advanced its `previousRepos` baseline since that
  assignment ran after the aborted loop. Both are fixed: delete failures are now caught/reported per-repo
  without aborting the loop, and `previousRepos` advances right after the crawl.
- **T14 fix applied**: after T13, both prompts fired correctly, but the approved deletes still silently left
  both folders on disk with no visible error -- `vscode.workspace.fs.delete(..., { useTrash: true })` is
  unreliable for large git-repo folders on Windows (the recycle-bin API can fail or no-op on deep
  `.git/objects` trees). Deletion now goes through Node's `fs.promises.rm(absolutePath, { recursive: true,
  force: true })` instead (same approach `specRepo.ts` already uses to remove `.specmesh/spec.git`), and every
  delete now logs a success or failure line to the specmesh output channel, forcing it visible on failure.
  **Please retry removing both entries again** -- you should now see either the folders actually gone, or a
  clearly visible warning + output-channel entry naming the folder and the underlying OS error.
- Per the approved spec, seeding a newly-cloned *empty* child repo with scaffolded doc types, and any
  remote-reachability/"out of sync" diagnostics, are explicitly out of scope for this FR (see spec.v1.md).
