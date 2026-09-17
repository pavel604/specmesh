# FR-012: Remote Add/Remove/Edit, Push, Pull & Fetch in the Central SCM View — Tasks

- [x] T1: Add `parseRemoteList(output)` and `parseUpstream(output)` pure helpers to `src/git/centralScm.ts`.
- [x] T2: Unit tests for `parseRemoteList`/`parseUpstream` in `src/test/centralScm.test.ts`.
- [x] T3: Add `currentBranchName(gitDir)` and `pickOrAddRemote(gitDir)` shared helpers.
- [x] T4: Implement `manageCentralRemotes(outputChannel)` (list → edit URL / remove / add flows).
- [x] T5: Implement `pushCentral(outputChannel)`.
- [x] T6: Implement `pullCentral(outputChannel)`.
- [x] T7: Implement `fetchCentral(outputChannel)`.
- [x] T8: Register the 4 new commands in `src/extension.ts`.
- [x] T9: Add the 4 new commands to `package.json`'s `commands` array (no `specmesh:` prefix) and to the
      `specmesh.centralScmActions` submenu as a new `3_specmesh` group.
- [x] T10: Drop the `specmesh:` prefix from the titles of `switchCentralBranch`, `refreshCentralScm`,
      `showCentralHistory`, `uncommitCentral` in `package.json`.
- [x] T11: `npx tsc -p ./ --noEmit` and `npm test` both clean.
- [x] T12: Manual smoke test against a scratch local bare repo standing in for GitHub (add remote, push -u,
      edit URL, fetch, pull, remove remote) -- live GitHub push/pull left for the user to try (see walkthrough).
- [x] T13: Write `walkthrough.v1.md` and present for review.
- [x] T14: Found during walkthrough review -- an SSH remote with a passphrase-protected key (no already-unlocked
      agent) fails with `Permission denied (publickey)` because push/pull/fetch run in a non-interactive child
      process with no TTY for git to prompt on. Fixed by adding a "Copy Terminal Command" button to the
      push/pull/fetch failure warning, so the user can paste the exact equivalent `--git-dir`/`--work-tree`
      command into a real terminal and answer the passphrase prompt there.
