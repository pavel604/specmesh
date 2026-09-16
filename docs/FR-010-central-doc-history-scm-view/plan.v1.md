# Implementation Plan: FR-010 Central Doc History as a Source Control View (v1)

**Status**: Approved

## Affected Files/Projects

- `src/git/centralScm.ts` (new) — the `vscode.scm` provider: registration, resource-group population,
  pending-sync detection, diff wiring, refresh.
- `src/git/specRepo.ts` — export `gitDirFor` (currently module-private) for reuse; add an `onDidSync` event to
  `CentralSyncScheduler`, fired at the end of a successful `flush()` commit.
- `src/extension.ts` — wire up the provider at activation (if central tracking is already enabled) and right
  after `enableCentralTracking` succeeds; dispose it with the rest of `context.subscriptions`.
- `package.json` — add a `specmesh.refreshCentralScm` command plus two `scm/title` menu entries (refresh, and
  the existing `specmesh.showCentralHistory` for full-log), both scoped to `when: scmProvider == specmeshCentral`.
- `src/test/centralScm.test.ts` (new) — unit tests for the pure `ls-tree` output parser and the pending-sync
  comparison helper.

## Approach

### Central SCM provider (`src/git/centralScm.ts`)

- `ensureCentralScmProvider(root, context, outputChannel, syncScheduler)`: idempotent (module-level guard);
  no-ops if already registered for this session. Creates `vscode.scm.createSourceControl("specmeshCentral",
  "specmesh (central)")`, one resource group (id `"tracked"`, label `"Tracked docs"`), and disables the input box
  workflow by leaving `acceptInputCommand` unset and setting `inputBox.placeholder` to a short explanatory
  string (central sync is automatic).
- `refresh()`: runs `git --git-dir <gitDir> ls-tree -r HEAD` (via `execGit`), parses `<mode> blob <sha>\t<path>`
  lines into a `Map<relPath, sha>`. An "unborn HEAD" failure (no commits yet, right after `init --bare`) is
  treated as an empty map, not an error. For each entry, runs `git hash-object <absolutePath>` (no `-w`, so
  nothing is written) and compares against the recorded SHA to flag "pending sync" (skip files no longer on
  disk — treat as pending until the next remove-sync catches up). Builds one `SourceControlResourceState` per
  path: `resourceUri` = the file's own `file://` URI; pending ones get a `decorations.tooltip`/`strikeThrough`-
  free "Pending sync" label via `decorations.faded = false` and a letter badge (`M`)-equivalent using
  `decorations.iconPath`/`tooltip` (VS Code renders resource group state via `SourceControlResourceDecorations`);
  each resource's `command` opens a diff (see below). Sets `resourceGroup.resourceStates` and
  `sourceControl.count = entries.length`.
- Diff wiring: register one `vscode.workspace.registerTextDocumentContentProvider("specmesh-central", provider)`
  where `provideTextDocumentContent(uri)` extracts `sha` from the URI query and runs
  `git --git-dir <gitDir> show <sha>`. Each resource's `command` is `vscode.diff` with args
  `[Uri.parse("specmesh-central:<relPath>?<sha>"), Uri.file(absolutePath), "<relPath> (central ⟷ working tree)"]`.
- Refresh triggers: `syncScheduler.onDidSync(() => provider.refresh())`, plus the new
  `specmesh.refreshCentralScm` command calling the same `refresh()`.
- Return a disposable bundling the `SourceControl`, the content-provider registration, and the `onDidSync`
  subscription, for `context.subscriptions`.

### `src/git/specRepo.ts` changes

- Export `gitDirFor` (drop the missing `export` keyword) so `centralScm.ts` can compute the same path without
  duplicating `path.join(root.uri.fsPath, ".specmesh", "spec.git")`.
- Add `private readonly _onDidSync = new vscode.EventEmitter<void>(); readonly onDidSync = this._onDidSync.event;`
  to `CentralSyncScheduler`; fire `_onDidSync.fire()` right after the existing successful-commit
  `outputChannel.appendLine(...)` call in `flush()`. No change to the no-op ("nothing to commit") path.

### `src/extension.ts` changes

- After constructing `syncScheduler`, call `await ensureCentralScmProvider(findSpecGitRoot(), context,
  outputChannel, syncScheduler)` if a root already exists (central tracking enabled from a previous session).
- Inside the existing `specmesh.enableCentralTracking` command handler, after `enableCentralTracking(...)`
  returns a root, also call `ensureCentralScmProvider(root, ...)` so the view appears immediately without
  reloading the window.
- Register `specmesh.refreshCentralScm` calling the active provider's `refresh()` (no-op if not yet created).

### `package.json` changes

```json
{ "command": "specmesh.refreshCentralScm", "title": "specmesh: Refresh Central Doc Status", "icon": "$(refresh)" }
```

```json
"scm/title": [
  { "command": "specmesh.refreshCentralScm", "when": "scmProvider == specmeshCentral", "group": "navigation" },
  { "command": "specmesh.showCentralHistory", "when": "scmProvider == specmeshCentral", "group": "navigation" }
]
```

### Data

No new persisted state. The provider is purely a live read-view over `.specmesh/spec.git`'s `HEAD` tree plus
on-disk file content — nothing new to store in `workspaceState`.

## Sequencing

1. `specRepo.ts`: export `gitDirFor`, add `onDidSync`.
2. `centralScm.ts`: `ls-tree`/pending-sync parsing as pure, unit-testable helpers first, then the
   `vscode.scm` registration/refresh glue around them.
3. `extension.ts` + `package.json` wiring.
4. Manual verification against this repo's own `.specmesh/spec.git` (already enabled) — confirm the "specmesh
   (central)" entry appears in the Source Control view with the currently tracked docs, saving a tracked doc
   shows it as "pending" until the debounce commits, and the diff command opens a working diff.

## Risks / Tradeoffs

- `git hash-object <path>` re-reads and hashes every tracked file's content on each `refresh()` — fine at
  specmesh's doc-count scale (dozens, not thousands, of files), but would need batching/caching if that ever
  changes materially.
- VS Code's `SourceControlResourceDecorations` badge/tooltip styling for "pending sync" is more constrained than
  a custom tree view's icon control — the exact visual (e.g. a letter badge like git's `M`) is decided at
  implementation time based on what the API cleanly supports, not prescribed further here.
- No teardown: once created, the provider stays registered for the rest of the session even if
  `.specmesh/spec.git` were somehow removed mid-session (matches FR-009's existing lack of a teardown flow).
