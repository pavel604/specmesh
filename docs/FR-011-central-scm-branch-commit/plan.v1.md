# Implementation Plan: FR-011 Branch, Stage & Commit in the Central SCM View (v1)

**Status**: Approved

## Approach

### Two-way status split replaces the single "Tracked docs" group (`src/git/centralScm.ts`)

`refresh()` currently computes one flat list (new/pending/synced) purely from `HEAD`'s tree vs. on-disk content.
It now computes three snapshots per candidate path — `HEAD` tree (`git ls-tree -r HEAD`, existing
`parseLsTree`), the index (`git ls-files --stage`, new `parseLsFilesStage`), and on-disk content
(`hash-object`, unchanged) — and buckets every path into **Staged Changes** (index differs from `HEAD`) and/or
**Changes** (working tree differs from index), via a new pure `computeChangeGroups(headTree, indexTree,
onDiskShas, candidatePaths)` helper. A path identical across all three is dropped entirely. The existing
`classifySyncStatus`/`isPendingSync` pending-vs-synced model is removed — it's superseded by this two-group
split.

**Files:**

- `src/git/centralScm.ts` — add `parseLsFilesStage`, `computeChangeGroups`; rewrite `refresh()` to build both
  groups (`sourceControl.createResourceGroup("staged", "Staged Changes")` and `("changes", "Changes")`,
  replacing the single `"tracked"` group); remove `classifySyncStatus`/`isPendingSync` and their call sites.
  Each resource's diff command still targets the `specmesh-central:` content provider — a **Changes** entry
  diffs on-disk content against the index's blob (falling back to `HEAD`'s blob if the path isn't staged);
  a **Staged Changes** entry diffs the index's blob against `HEAD`'s blob.
- `src/test/centralScm.test.ts` — replace the `isPendingSync`/`classifySyncStatus` tests with tests for
  `parseLsFilesStage` (tab-separated `<mode> <sha> <stage>\t<path>` parsing) and `computeChangeGroups`
  (staged-only, unstaged-only, both, and untouched-path cases).

### Stage / unstage actions (`src/git/centralScm.ts`, `package.json`)

Adds four exported functions, each re-running `refresh()` on completion: `stageCentralChange(root, relPath)`
and `unstageCentralChange(root, relPath)` (single path, invoked from a resource's inline icon), plus
`stageAllCentralChanges(root)` and `unstageAllCentralChanges(root)` (invoked from the resource group's inline
icon). Staging a path runs `hash-object -w` + `update-index --add --cacheinfo` (same primitive FR-009's
scheduler used); unstaging resets that path's index entry back to `HEAD`'s blob, or removes it from the index
entirely if `HEAD` has no such blob yet (new, never-committed file).

**Files:**

- `src/git/centralScm.ts` — the four functions above; each resolves `root`/`gitDir` the same way
  `ensureCentralScmProvider` already does.
- `src/extension.ts` — register `specmesh.stageCentralChange`, `specmesh.unstageCentralChange`,
  `specmesh.stageAllCentralChanges`, `specmesh.unstageAllCentralChanges`, each passed the resource
  URI(s)/group VS Code supplies to a resource-state or resource-group context-menu command.
- `package.json` — four new commands (icons `$(add)` / `$(remove)`); `scm/resourceState/context` entries
  (group `inline`, `when: scmProvider == specmeshCentral && scmResourceGroup == changes` for stage,
  `== staged` for unstage) and matching `scm/resourceGroup/context` entries for the "stage all"/"unstage all"
  group-level icons.

### Commit (`src/git/centralScm.ts`, `package.json`)

`commitCentral(root)`: reads `sourceControl.inputBox.value`; warns (via `showWarningMessage`, no commit) if
the message is blank or **Staged Changes** is empty; otherwise runs `git commit -m <message>` against the
index, clears the input box, and calls `refresh()`. Wired as both the `scm/title` "Commit" command and the
`SourceControl.acceptInputCommand` (so the input box's own built-in accept affordance works too).

**Files:**

- `src/git/centralScm.ts` — `commitCentral`; set `sourceControl.acceptInputCommand` in
  `ensureCentralScmProvider`.
- `src/extension.ts` — register `specmesh.commitCentral`.
- `package.json` — `specmesh.commitCentral` command (icon `$(check)`) plus a `scm/title` entry
  (`when: scmProvider == specmeshCentral`, group `navigation`).

### Branch switching (`src/git/centralScm.ts`, `package.json`)

`switchCentralBranch(root, outputChannel)`: runs `git branch --list` (parsed by a new pure
`parseBranchList(output)` into `{ name, current }[]`), shows a `QuickPick` of branch names (current one
annotated) plus a "Create new branch…" entry. Picking a branch runs `git checkout <name>`; picking "Create new
branch…" prompts for a name via `showInputBox` then runs `git checkout -b <name>`. On success, calls
`refresh()` and updates the status-bar branch label (below). If checkout fails because local modifications
would be overwritten, a new pure `parseCheckoutConflictFiles(stderr)` extracts the listed file paths from
git's own error text, and the failure is surfaced via `showWarningMessage` naming those files instead of only
being logged to the output channel.

`ensureCentralScmProvider` sets `sourceControl.statusBarCommands = [{ command:
"specmesh.switchCentralBranch", title: "$(git-branch) <branch>", tooltip: "specmesh: Switch Central Branch" }]`,
refreshed alongside `refresh()` (current branch via `git rev-parse --abbrev-ref HEAD`), satisfying both the
switch action and the always-visible current-branch label in one place.

**Files:**

- `src/git/centralScm.ts` — `parseBranchList`, `parseCheckoutConflictFiles`, `switchCentralBranch`; branch
  label maintained inside `refresh()`.
- `src/test/centralScm.test.ts` — tests for `parseBranchList` and `parseCheckoutConflictFiles`.
- `src/extension.ts` — register `specmesh.switchCentralBranch`.
- `package.json` — `specmesh.switchCentralBranch` command (icon `$(git-branch)`).

### Remove FR-009's auto-commit-on-save (`src/git/specRepo.ts`, `src/extension.ts`)

`CentralSyncScheduler` (debounced auto `hash-object`/`update-index`/`commit` on every save, plus its
`onDidSync` event) is deleted outright — central sync is manual from here on, so nothing should stage or
commit without the user acting through the view. The doc file watcher keeps calling `scheduleRefresh()` as
before; since `refresh()` already ends with `await refreshCentralScm()`, the **Changes** group still picks up
on-disk edits within the existing 500ms debounce — no separate scheduling mechanism is needed to replace it.
`gitDirFor`, `findSpecGitRoot`, `enableCentralTracking`, `isUnderPath`, `isPathUntracked`, `setRepoUntracked`,
and `showCentralHistory` are untouched.

**Files:**

- `src/git/specRepo.ts` — remove `CentralSyncScheduler`, `formatCommitMessage`, and the `SyncKind` type (no
  longer referenced anywhere once the scheduler is gone).
- `src/extension.ts` — remove the `CentralSyncScheduler` import/instantiation and the
  `syncScheduler.scheduleSync(...)` calls in the `**/*.md` watcher's `onDidChange`/`onDidCreate`/`onDidDelete`
  handlers (their `scheduleRefresh()` calls stay); drop the now-unused `syncScheduler` argument from both
  `ensureCentralScmProvider(...)` call sites.
- `src/git/centralScm.ts` — drop the `syncScheduler` parameter from `ensureCentralScmProvider`'s signature and
  the `onDidSync` subscription it registered.

## Sequencing

1. `specRepo.ts`: delete `CentralSyncScheduler`/`formatCommitMessage` first, so the compiler immediately flags
   every call site that still needs updating.
2. `centralScm.ts`: new pure helpers (`parseLsFilesStage`, `computeChangeGroups`, `parseBranchList`,
   `parseCheckoutConflictFiles`) plus their tests, before touching `refresh()`'s glue code.
3. `centralScm.ts`: rewrite `refresh()` for the two-group split and branch status-bar label; add
   stage/unstage/commit/switch-branch functions.
4. `extension.ts` + `package.json`: command registration and menu wiring.
5. Manual verification against this repo's own `.specmesh/spec.git`: edit a doc → appears under **Changes**;
   stage it → moves to **Staged Changes**; commit → both groups empty again and `git log` shows the new
   commit; switch to a new branch and back; attempt a checkout with an unstaged edit present to confirm the
   conflict warning.

## Risks / Tradeoffs

- Deleting `CentralSyncScheduler` is a behavior change to FR-009's shipped auto-commit, not just an addition —
  called out explicitly in FR-011's spec and the EPIC-003 changelog rather than silently dropped.
- `git checkout` operates directly against the real work-tree (the actual repo(s) on disk, not a sandboxed
  copy), so a successful branch switch will overwrite on-disk doc content with the target branch's committed
  versions; git's own refusal-on-conflict behavior (surfaced per FR-5) is the only safety net — there's no
  additional confirmation prompt before a *conflict-free* checkout.
- No hunk/partial staging — stage/unstage always acts on a whole file, matching FR-1's assumption.
