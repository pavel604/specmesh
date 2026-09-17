# FR-012: Remote Add/Remove/Edit, Push, Pull & Fetch in the Central SCM View — Implementation Plan

**Revision**: 1
**Status**: Draft

## Remote parsing & shared helpers (`src/git/centralScm.ts`)

Adds pure, unit-testable parsing plus small shared helpers used by all four new actions.

- `parseRemoteList(output: string): { name: string; url: string }[]` — parses `git remote -v` output (two lines
  per remote, `(fetch)`/`(push)`); dedupes by name, keeping the `(fetch)` URL.
- `parseUpstream(output: string): { remote: string; branch: string } | undefined` — parses the single-line
  output of `for-each-ref --format=%(upstream:short) refs/heads/<branch>` (e.g. `origin/main` →
  `{ remote: "origin", branch: "main" }`); empty output means "no upstream configured".
- `currentBranchName(gitDir): Promise<string | undefined>` — reuses the existing `parseBranchList`/`branch
  --list` call and returns the entry marked `current`.
- `pickOrAddRemote(gitDir): Promise<string | undefined>` — shared by push/pull/fetch when no upstream is
  configured yet: 0 remotes → runs the add-remote flow inline; 1 remote → returns it directly; 2+ → `QuickPick`.

Files:

- [src/git/centralScm.ts](../../src/git/centralScm.ts)

## Manage Remotes (add / edit URL / remove)

`manageCentralRemotes(outputChannel)`:

1. `QuickPick` built from `parseRemoteList` (`$(link) name` label, URL as description) plus a trailing
   `$(add) Add remote…` item.
2. Picking an existing remote opens a second `QuickPick` with `Edit URL…` / `Remove`.
   - `Edit URL…`: `showInputBox` pre-filled with the current URL, runs `remote set-url <name> <url>`.
   - `Remove`: modal confirmation (`showWarningMessage(..., { modal: true }, "Remove")`), then
     `remote remove <name>`.
3. Picking `Add remote…`: `showInputBox` for a name (defaults to `origin` if left blank and no `origin`
   remote exists yet) then a required `showInputBox` for the URL, runs `remote add <name> <url>`.
4. Each successful mutation shows a brief `showInformationMessage` (e.g. `specmesh: added remote "origin".`);
   failures log the full git message to `outputChannel` and show it in a `showWarningMessage`, matching FR-7.

Files:

- [src/git/centralScm.ts](../../src/git/centralScm.ts)

## Push / Pull / Fetch

Three thin actions, all following the same shape: resolve the current branch → resolve its upstream (if any)
via `parseUpstream` → if no upstream, resolve a remote via `pickOrAddRemote` → run the git command with
`--git-dir`/`--work-tree` (matching every other central-repo git call) → on success, a short
`showInformationMessage`; on failure, log + `showWarningMessage` with git's own message (FR-7).

- `pushCentral(outputChannel)`: no upstream → `push -u <remote> <branch>`; upstream present → plain `push`.
- `pullCentral(outputChannel)`: no upstream → prompts for a remote (via `pickOrAddRemote`) then a branch name
  (`showInputBox`), runs `pull <remote> <branch>` and (on success) records that as the upstream via
  `branch --set-upstream-to`; upstream present → plain `pull`. On failure, `refresh()` is still called
  afterward so any partially-merged file changes show up in the view (mirrors how checkout conflicts are
  handled today).
- `fetchCentral(outputChannel)`: no upstream → resolves a remote via `pickOrAddRemote`, runs
  `fetch <remote>`; upstream present → plain `fetch`. Always calls `refresh()` after (remote-tracking refs
  changing doesn't affect working-tree files, but keeps behavior consistent/cheap).

Files:

- [src/git/centralScm.ts](../../src/git/centralScm.ts)

## Command & menu wiring

- New commands: `specmesh.manageCentralRemotes` ("Manage Remotes…"), `specmesh.pushCentral` ("Push"),
  `specmesh.pullCentral` ("Pull"), `specmesh.fetchCentral` ("Fetch") — no `specmesh:` prefix, since these only
  ever appear inside the central SCM view's own "…" submenu, where the provider is already obvious.
- While touching that submenu, also drop the redundant `specmesh:` prefix from the titles of the four existing
  commands already in it: `specmesh.switchCentralBranch` ("Switch Central Branch…"),
  `specmesh.refreshCentralScm` ("Refresh Central Doc Status"), `specmesh.showCentralHistory` ("Show Central Doc
  History"), `specmesh.uncommitCentral` ("Undo Last Commit"). (`specmesh.commitCentral`, the one command that
  sits directly on the SCM toolbar rather than inside the submenu, is left as-is — out of the scope of "that
  menu".)
- Registered in `extension.ts` alongside the other central-SCM commands, each disposed via
  `context.subscriptions`.
- Added to the `specmesh.centralScmActions` "…" submenu (introduced in FR-011) as a new `3_specmesh` group,
  after the existing `1_specmesh` (branch/refresh/history) and `2_specmesh` (undo commit) groups: Manage
  Remotes…, Push, Pull, Fetch, in that order.

Files:

- [package.json](../../package.json)
- [src/extension.ts](../../src/extension.ts)

## Tests

- Unit tests for the new pure helpers (`parseRemoteList`, `parseUpstream`) in
  [src/test/centralScm.test.ts](../../src/test/centralScm.test.ts), following the existing
  `parseBranchList`/`parseCheckoutConflictFiles` test style (no live git/network calls).
- No new integration/live-git tests — push/pull/fetch against a real remote can't be exercised in the
  `@vscode/test-cli` sandbox without network access and a disposable GitHub repo; manual verification is
  called out in the walkthrough instead (same approach FR-011 used for branch-checkout/commit flows).

## Sequencing

1. Shared helpers + unit tests (`parseRemoteList`, `parseUpstream`, `currentBranchName`, `pickOrAddRemote`).
2. Manage Remotes flow.
3. Push, then Pull, then Fetch (each reuses the prior step's upstream-resolution helper).
4. `package.json` + `extension.ts` wiring.
5. Build/test verification, then manual smoke test against a real (throwaway) GitHub repo.

## Risks / Tradeoffs

- **Auth failures are opaque to specmesh.** Since credential handling is entirely git's own (per the spec's
  Out of Scope), an HTTPS remote with no cached credential helper will hang waiting for terminal input that the
  user can't see/answer from inside the extension host. Mitigation: document in the walkthrough that SSH
  remotes (or an HTTPS remote with a working credential manager) are the supported path; a hung push/pull/fetch
  is a known limitation, not a bug to chase in this FR.
- **No ahead/behind indicator** means the user has no at-a-glance signal that a push/pull is needed — accepted
  per the spec's Out of Scope; can be a follow-up FR if it turns out to matter in practice.
