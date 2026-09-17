# FR-012: Remote Add/Remove/Edit, Push, Pull & Fetch in the Central SCM View — Walkthrough

**Revision**: 1

## Summary

Adds remote management (add / edit URL / remove) plus Push, Pull, and Fetch actions to the "specmesh
(central)" Source Control view's "…" submenu, so `.specmesh/spec.git`'s history can be synced to a remote such
as GitHub.

## Files Changed

- [src/git/centralScm.ts](../../src/git/centralScm.ts) — `parseRemoteList`, `parseUpstream` (pure, tested);
  `currentBranchName`, `upstreamFor`, `addRemoteFlow`, `pickOrAddRemote` (shared helpers); `manageCentralRemotes`,
  `pushCentral`, `pullCentral`, `fetchCentral` (the four new actions).
- [src/test/centralScm.test.ts](../../src/test/centralScm.test.ts) — unit tests for `parseRemoteList` and
  `parseUpstream`.
- [src/extension.ts](../../src/extension.ts) — registers `specmesh.manageCentralRemotes`,
  `specmesh.pushCentral`, `specmesh.pullCentral`, `specmesh.fetchCentral`.
- [package.json](../../package.json) — adds the 4 new commands (no `specmesh:` title prefix, since they only
  ever appear inside the central SCM view's own "…" submenu) as a new `3_specmesh` group in
  `specmesh.centralScmActions`; also drops the redundant `specmesh:` prefix from the 4 pre-existing commands in
  that same submenu (`switchCentralBranch`, `refreshCentralScm`, `showCentralHistory`, `uncommitCentral`) — the
  toolbar's own `commitCentral` icon is untouched, since it isn't part of that submenu.

## Behavior

- **Manage Remotes…**: `QuickPick` of existing remotes (name + URL) plus "$(add) Add remote…". Picking a
  remote opens "Edit URL…" / "Remove" (with a modal confirmation). Picking "Add remote…" prompts for a name
  (defaults to `origin` if left blank and unused) and a URL.
- **Push**: pushes the current branch. If it already has an upstream, plain `push`; otherwise resolves a
  remote (auto-picks the only one, prompts among several, or runs the add flow if there are none) and pushes
  with `-u` to set that as the upstream going forward.
- **Pull**: same upstream-resolution as Push; if there's no upstream yet, also prompts for the remote branch
  name to pull from, and records the new upstream once the pull succeeds. Always refreshes the view afterward
  (a pull can change working-tree files, like a checkout) — even on failure, so a partial merge still shows up.
- **Fetch**: same upstream-resolution; doesn't touch working-tree files, so it does a lightweight refresh
  reusing the last crawl.
- All four surface git's own error message via a warning notification on failure (auth failure, no network,
  rejected non-fast-forward push, merge conflicts on pull, etc.), in addition to logging the full message to
  the specmesh output channel.

## Build/Test Results

- `npx tsc -p ./ --noEmit`: clean.
- `npm test`: 50/50 passing (6 new: `parseRemoteList` ×3, `parseUpstream` ×3).

## Manual Verification

Live GitHub push/pull/fetch (real network + auth) isn't exercisable inside the `@vscode/test-cli` sandbox, so
the exact command sequences each action runs were smoke-tested against a scratch local bare repo standing in
for "GitHub" (a second bare repo used as the push/pull/fetch target):

- `remote add` → `push -u origin <branch>` → correctly created the branch on the "remote" and set upstream
  tracking (confirmed via `for-each-ref --format=%(upstream:short)` returning `origin/master`).
- `remote set-url` → correctly updated the URL shown by `remote -v`.
- `fetch origin` and a plain `pull` (upstream already configured, nothing new) → both succeeded with no errors
  (`Already up to date.`).
- `remote remove origin` → correctly removed the remote (`remote -v` returned nothing afterward).

## Follow-ups / Known Gaps

- Trying this against a real GitHub remote (e.g. an actual `git@github.com:...` SSH URL) from inside the
  running extension is still worth doing once, to confirm the credential-helper/SSH-agent path works
  end-to-end — flagged as a manual step for the user rather than something this agent can do (creating/pushing
  to a real GitHub repo is outside what should happen without direct user action).
- Per the plan's noted risk: an HTTPS remote with no cached credential helper will hang waiting for terminal
  input the extension can't surface. This is a known limitation (documented, not fixed) — SSH remotes or an
  HTTPS remote with a working credential manager are the supported path.

## Fix from the review pass

Live-testing against a real GitHub remote (per the follow-up above) immediately surfaced the risk the plan had
flagged, but for SSH too, not just HTTPS: a passphrase-protected SSH key with no already-unlocked agent fails
with `Permission denied (publickey)`, because push/pull/fetch run in a non-interactive `child_process` with no
TTY for git/ssh to prompt on — even though the *exact same command* succeeds when run in a real terminal (git
prompts for the passphrase there, and it works).

Fixed by adding a "Copy Terminal Command" button to the push/pull/fetch failure warning (`reportSyncFailure` +
`syncCommandString` in `centralScm.ts`): on failure, the user can click it to copy the exact equivalent
`git --git-dir=... --work-tree=... <command>` onto their clipboard, paste it into a real terminal, and answer
whatever interactive prompt (passphrase, 2FA, etc.) git needs there — confirmed working via the same manual
GitHub-remote test that first surfaced the bug.
