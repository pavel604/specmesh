# Walkthrough: FR-010 Central Doc History as a Source Control View (v1)

## Files Changed

- [src/git/centralScm.ts](../../src/git/centralScm.ts) — new. Pure `parseLsTree`/`isPendingSync`/`classifySyncStatus`
  helpers, plus `ensureCentralScmProvider` (registers the "specmesh (central)" `vscode.scm` Source Control, one
  "Tracked docs" resource group, a `specmesh-central:` `TextDocumentContentProvider` serving blob content via
  `git show`, and a `refresh()` — wrapped in try/catch with output-channel logging — that unions `HEAD`'s tree
  with every currently-tracked doc and flags each as not-yet-synced/pending/synced) and `refreshCentralScm()`.
- [src/git/specRepo.ts](../../src/git/specRepo.ts) — exported `gitDirFor` (was module-private); added
  `CentralSyncScheduler.onDidSync`, fired right after a successful commit in `flush()` (not on the "nothing to
  commit" no-op path), so the new SCM view refreshes without polling.
- [src/extension.ts](../../src/extension.ts) — calls `ensureCentralScmProvider` at activation (if central
  tracking was already enabled in a previous session) and again right after `enableCentralTracking` succeeds
  inside the existing command handler; registers `specmesh.refreshCentralScm`.
- [package.json](../../package.json) — added the `specmesh.refreshCentralScm` command and a `scm/title` menu
  section (refresh + the existing `specmesh: Show Central Doc History`), both scoped to
  `when: scmProvider == specmeshCentral`.
- [src/test/centralScm.test.ts](../../src/test/centralScm.test.ts) — new tests for `parseLsTree`, `isPendingSync`,
  and `classifySyncStatus` (tab-separated `ls-tree` line parsing, blank/malformed lines, new/pending/synced
  classification).

## Build/Test Results

- `npx tsc -p ./ --noEmit`: clean.
- `npm test`: 41 passing (32 previous + 9 new), reconfirmed clean after every subsequent fix.

## Manual Verification

Ran a scratch-directory reproduction (bare repo + `hash-object`/`ls-tree`, mirroring FR-009's earlier
verification approach) to confirm the exact git output shapes `centralScm.ts` depends on:

- `git ls-tree -r HEAD` output is tab-separated (`100644 blob <sha>\t<path>`) — matches `parseLsTree`'s
  tab-split parsing exactly.
- `git hash-object <path>` (no `-w`) returns the *same* SHA as an earlier `hash-object -w` for unchanged
  content, and does not write a new object — confirms it's safe to call on every refresh purely for comparison.
- Editing the file and re-running `hash-object` returns a *different* SHA — confirms the "pending sync" flag
  would correctly flip for a real edit.

Live verification in a real Extension Development Host (the `../7` workspace) was done directly by the user
across several review rounds, confirming: the "specmesh (central)" entry appears and lists tracked docs across
repos, edits flag as pending/synced correctly, the diff command works, the entry now appears immediately on
launch, and the read-only scope (no stage/commit/branch UI) is accepted as final.
