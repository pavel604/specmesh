# Tasks: FR-014 Declared Repo Clone & Sync (v1)

- [x] T1 — `src/crawler/repoConfig.ts`: add `specRepoRemote?`/`specRepoRemoteError?` to `RepoConfig`, validate in
      `loadRepoConfig`, and add `writeSpecRepoRemote()` using `yaml`'s `parseDocument`/`Document#set`/`#delete`.
- [x] T2 — `src/test/repoConfig.test.ts`: tests for `specRepoRemote` present/absent/malformed parsing.
- [x] T3 — `src/git/specRepo.ts`: export `ensureGitignoreEntry`. `src/git/repoMigration.ts`: export `toPosix`.
- [x] T4 — `src/git/repoSync.ts` (new): `diffDeclaredRepos()` and `pickMirroredRemoteUrl()` pure functions.
- [x] T5 — `src/test/repoSync.test.ts` (new): cover the spec's Testing Expectations for `diffDeclaredRepos`
      (single/multiple add, single/multiple remove, mixed batches) and `pickMirroredRemoteUrl` (0/1/2+ remotes).
- [x] T6 — `src/git/repoSync.ts`: `cloneDeclaredRepo()` (clone + best-effort central-doc restore + failure
      reporting with "Copy Terminal Command").
- [x] T7 — `src/git/repoSync.ts`: `syncCloneRepos()` (bare spec-repo clone step + missing-repo loop + summary).
- [x] T8 — `src/git/repoSync.ts`: `promptForNewRepos()` / `promptForRemovedRepos()`.
- [x] T9 — `src/git/centralScm.ts`: call `pickMirroredRemoteUrl` + `writeSpecRepoRemote` at the end of
      `addRemoteFlow` and the "Edit URL…"/"Remove" branches in `manageCentralRemotes`.
- [x] T10 — `src/extension.ts`: register `specmesh.syncCloneRepos`; add `previousRepos` tracking + diff-driven
      prompt calls in `refresh()`.
- [x] T11 — `package.json`: add the `specmesh.syncCloneRepos` command and its "More Actions" menu entry.
- [ ] T12 — Manual verification per the plan's Sequencing step 8; fix any issues found.
- [x] T13 — Bug found in T12: removing multiple `repos:` entries at once only prompted for one, and the
      approved deletion left both folders on disk. Root cause #1: `promptForRemovedRepos`'s
      `vscode.workspace.fs.delete` call had no error handling, so a failed delete (e.g. Windows Recycle Bin
      rejecting a large/locked `.git` folder) aborted the loop before the next repo's prompt, and
      `extension.ts` never advanced `previousRepos` since that assignment ran after the aborted loop. Fix: catch
      and report delete failures per-repo instead of letting them abort the loop, and advance `previousRepos`
      unconditionally right after the crawl instead of after the prompts.
- [x] T14 — Bug found after T13: both prompts now fire correctly, but the approved deletes still silently left
      both folders on disk with no visible error. Root cause: `vscode.workspace.fs.delete(..., { useTrash: true
      })` is unreliable for large git-repo folders on Windows (recycle-bin API can fail/no-op on deep
      `.git/objects` trees) and the failure wasn't reaching the user reliably. Fix: delete via Node's
      `fs.promises.rm(absolutePath, { recursive: true, force: true })` instead (matches the existing precedent
      in `specRepo.ts` for removing `.specmesh/spec.git`), and always log a success/failure line to the output
      channel, forcing it visible (`outputChannel.show()`) on failure.
