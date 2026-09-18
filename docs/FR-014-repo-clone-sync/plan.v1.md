# Implementation Plan: FR-014 Declared Repo Clone & Sync (v1)

**Status**: Approved

## Affected Files/Projects

- [src/crawler/repoConfig.ts](../../src/crawler/repoConfig.ts) — parse/validate `specRepoRemote`, extend
  `RepoConfig`; add a YAML-preserving writer for it.
- [src/git/specRepo.ts](../../src/git/specRepo.ts) — export the existing `ensureGitignoreEntry` helper for reuse.
- [src/git/repoMigration.ts](../../src/git/repoMigration.ts) — export the existing `toPosix` helper for reuse.
- [src/git/repoSync.ts](../../src/git/repoSync.ts) — **new**: manifest diffing, single-repo clone + central-doc
  restore, the `Sync/Clone Repos` command body, and the new/removed-repo prompt flows.
- [src/git/centralScm.ts](../../src/git/centralScm.ts) — after add/edit/remove-remote flows, mirror the result
  into `.specmesh.yml`'s `specRepoRemote`.
- [src/extension.ts](../../src/extension.ts) — register `specmesh.syncCloneRepos`; track the previous refresh's
  declared-repos snapshot and call the diff-driven prompts on each subsequent refresh.
- [package.json](../../package.json) — new command + "More Actions" menu entry.
- [src/test/repoConfig.test.ts](../../src/test/repoConfig.test.ts) — `specRepoRemote` parsing tests.
- [src/test/repoSync.test.ts](../../src/test/repoSync.test.ts) — **new**: diffing + remote-mirroring pure-logic
  tests (the Testing Expectations scenarios from the spec).

## Approach

### Config (`src/crawler/repoConfig.ts`)

Adds `specRepoRemote?: string` and `specRepoRemoteError?: string` to `RepoConfig`. `loadRepoConfig` validates the
raw `specRepoRemote` value the same way `repos[].remote` is validated today (non-empty string; anything else is
dropped with a message in `specRepoRemoteError`).

Adds an exported `writeSpecRepoRemote(folder: vscode.WorkspaceFolder, value: string | undefined): Promise<void>`
that reads `.specmesh.yml` with `yaml`'s `parseDocument` (not the plain `parse` used for reading), sets or
deletes the `specRepoRemote` key with `Document#set`/`Document#delete`, and writes `doc.toString()` back —
preserving the rest of the file's formatting/comments instead of a full parse-and-restringify round-trip.

### Reused helpers

- `src/git/specRepo.ts`: add `export` to `ensureGitignoreEntry` (no behavior change) so `repoSync.ts` can ensure
  `.specmesh/` is gitignored after a fresh bare clone, exactly like `enableCentralTracking` already does.
- `src/git/repoMigration.ts`: add `export` to `toPosix` (no behavior change) so `repoSync.ts` can build the
  POSIX-relative pathspec a `checkout -- <path>` restore needs.

### Manifest diffing (`src/git/repoSync.ts`)

```ts
export interface RepoDiff {
  added: DeclaredRepo[]; // newly declared, and not yet present on disk
  removed: DeclaredRepo[]; // no longer declared, but still present on disk (per their last known crawl)
}

export function diffDeclaredRepos(previous: DeclaredRepo[], current: DeclaredRepo[]): RepoDiff
```

Pure function, no vscode/git dependency — keyed by `` `${workspaceFolderName}::${path}` ``. `added` is every
current entry whose key wasn't in `previous`, filtered to `!present`. `removed` is every previous entry whose key
isn't in `current`, filtered to `present` (using that entry's own last-known `present`, not a fresh disk check —
matches the spec's "previously loaded config" framing). This one function is what makes every add/remove/mixed-
batch scenario in the spec's Testing Expectations independently testable with plain object literals.

### Single-repo clone + restore (`src/git/repoSync.ts`)

```ts
export async function cloneDeclaredRepo(
  repo: DeclaredRepo,
  root: vscode.WorkspaceFolder,
  outputChannel: vscode.OutputChannel
): Promise<boolean> // true on success
```

- Resolves the absolute target (`path.join(root.uri.fsPath, repo.path)`), runs
  `execGit(["clone", repo.remote, absolutePath])`.
- On failure: logs to `outputChannel`, shows a warning with the git error and a "Copy Terminal Command" button
  (mirrors `centralScm.ts`'s `reportSyncFailure` shape — a small dedicated copy in this file rather than
  exporting/reusing that one, since it's private and scoped to push/pull/fetch wording there); returns `false`.
- On success: if `findSpecGitRoot()` resolves to the same `root`, best-effort restores any central-tracked docs
  under this repo — `execGit(["--git-dir", gitDir, "--work-tree", root.uri.fsPath, "checkout", "HEAD", "--", toPosix(repo.path)])`
  wrapped in try/catch that only logs to the output channel on failure (a clean "no commits touched this path
  yet" is the common case, not a user-facing warning); returns `true` regardless of the restore step's outcome.

### `Sync/Clone Repos` command body (`src/git/repoSync.ts`)

```ts
export async function syncCloneRepos(
  context: vscode.ExtensionContext,
  outputChannel: vscode.OutputChannel
): Promise<void>
```

Per workspace folder with a `.specmesh.yml`:

1. If `.specmesh/spec.git` isn't present (`!findSpecGitRoot()` for this folder) and `repoConfig.specRepoRemote` is
   set, creates `.specmesh/`, runs `execGit(["clone", "--bare", specRepoRemote, gitDir])`, and calls the existing
   `ensureGitignoreEntry(root, ".specmesh/")`. A failure here is reported the same "Copy Terminal Command" way as
   a child-repo clone failure, and does not stop child-repo cloning below.
2. Calls `crawlWorkspace()` for the current `repos:` list, filters to `!present`, and calls
   `cloneDeclaredRepo` for each (sequentially, so output-channel ordering is deterministic).
3. Appends a one-line cloned/skipped/failed summary to `outputChannel` and calls `outputChannel.show()`.

Registered as `specmesh.syncCloneRepos` in `extension.ts`, calling `refresh()` afterward (same convention as
`migrateRepoDocs`/`enableCentralTracking`) so the tree/diagnostics reflect newly-cloned repos, and re-running
`ensureCentralScmProvider` if step 1 freshly created `.specmesh/spec.git`.

### New/removed-repo prompts (`src/git/repoSync.ts` + `src/extension.ts`)

```ts
export async function promptForNewRepos(added: DeclaredRepo[], root: vscode.WorkspaceFolder, outputChannel): Promise<void>
export async function promptForRemovedRepos(removed: DeclaredRepo[], root: vscode.WorkspaceFolder, outputChannel): Promise<void>
```

- `promptForNewRepos`: for each entry in order, `showInformationMessage('New repo "<name>" declared in
  .specmesh.yml. Clone it now?', "Clone Now", "Not Now")`; `Clone Now` calls `cloneDeclaredRepo`.
- `promptForRemovedRepos`: for each entry in order, a **modal** `showWarningMessage('Repo "<name>" was removed
  from .specmesh.yml. Delete its local folder at "<path>"? This can't be undone.', { modal: true }, "Delete
  Folder", "Keep Folder")`; `Delete Folder` runs `fs.promises.rm(absolutePath, { recursive: true, force: true
  })` (Node's `fs`, not `vscode.workspace.fs.delete`/`useTrash` — the OS recycle-bin API is unreliable for large
  git-repo folders on Windows, matching the precedent in `specRepo.ts` for removing `.specmesh/spec.git`). A
  failed delete is caught, logged + shown via `outputChannel`, and reported to the user without aborting the
  remaining prompts. Dismissing (including "Keep Folder") does nothing further.

`extension.ts`'s `refresh()` keeps a closure-scoped `let previousRepos: DeclaredRepo[] | undefined`. After each
crawl, if `previousRepos` is defined, calls `diffDeclaredRepos(previousRepos, repos)` and, when non-empty,
awaits `promptForNewRepos`/`promptForRemovedRepos` grouped by `workspaceFolderName` (resolving each folder via
`vscode.workspace.workspaceFolders`). Then sets `previousRepos = repos` unconditionally (including on the very
first call, which is how "no prompt on initial load" falls out naturally — the first call's diff is skipped
entirely rather than computed against an empty baseline).

### Mirroring the central remote into `.specmesh.yml` (`src/git/centralScm.ts` + `src/git/repoSync.ts`)

```ts
export function pickMirroredRemoteUrl(remotes: { name: string; url: string }[]): string | undefined
```

Pure: 0 remotes → `undefined` (clear), exactly 1 → that remote's URL (always mirror the sole remote), 2+ →
`undefined` meaning "leave whatever is already there — don't guess which one is canonical." `centralScm.ts` calls
`writeSpecRepoRemote(root, pickMirroredRemoteUrl(remotesAfter))` at the end of `addRemoteFlow`, and after the
"Edit URL…"/"Remove" branches in `manageCentralRemotes` — three small call sites, no restructuring of the
existing flows.

## Sequencing

1. `repoConfig.ts`: `specRepoRemote` parsing + `writeSpecRepoRemote`, plus its tests.
2. Export `ensureGitignoreEntry` / `toPosix` (one-line changes, no behavior change).
3. `repoSync.ts`: `diffDeclaredRepos` + `pickMirroredRemoteUrl` first (pure, fully unit-testable), then
   `cloneDeclaredRepo` / `syncCloneRepos` / the two prompt functions on top.
4. Wire `centralScm.ts`'s three remote-mutating call sites to `pickMirroredRemoteUrl` + `writeSpecRepoRemote`.
5. `extension.ts`: register `specmesh.syncCloneRepos`, add the `previousRepos` diff tracking in `refresh()`.
6. `package.json`: command + menu entry.
7. `repoSync.test.ts`: cover every Testing Expectations scenario against `diffDeclaredRepos` and
   `pickMirroredRemoteUrl` with plain object literals (no git/vscode needed).
8. Manual verification: declare a new `repos:` entry, confirm the clone prompt; remove it, confirm the delete
   prompt; run `Sync/Clone Repos` against an entry with a deliberately bad `remote` alongside a good one and
   confirm the bad one fails gracefully without blocking the good one; add/edit/remove a central remote and
   confirm `specRepoRemote` follows it in `.specmesh.yml`.

## Risks / Tradeoffs

- `writeSpecRepoRemote` uses `yaml`'s `parseDocument`/CST editing instead of parse-then-restringify specifically
  to avoid clobbering the user's existing comments/formatting in `.specmesh.yml` — slightly more code than a
  naive round-trip, but avoids a real usability foot-gun (auto-rewriting a hand-edited config file).
- `pickMirroredRemoteUrl`'s 2+-remotes case is deliberately a no-op rather than prompting the user which one is
  canonical — keeps FR-2 simple/rigid per the spec's intent, at the cost of not auto-mirroring in that (uncommon)
  case; the user can still hand-edit `specRepoRemote` in `.specmesh.yml` directly.
- The central-doc restore checkout in `cloneDeclaredRepo` is best-effort and silent on the (common) case of "no
  central history touches this path yet" — only a real git-plumbing error is worth surfacing; distinguishing the
  two relies on `execGit`'s error message shape rather than a distinct exit code, matching how `switchCentralBranch`
  already special-cases its own checkout-conflict message today.
- No new `Problem`/tree-item UI beyond the existing "Declared Repos" category from FR-008 — `Sync/Clone Repos`
  and the two prompts are the only new UI surfaces, keeping this FR's UI footprint small per its "simplest and
  most rigid" framing.
