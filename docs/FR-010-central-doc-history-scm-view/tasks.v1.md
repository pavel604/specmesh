# Tasks: FR-010 Central Doc History as a Source Control View (v1)

- [x] T1 — In `src/git/specRepo.ts`, export `gitDirFor` (add the `export` keyword; no behavior change).
- [x] T2 — In `src/git/specRepo.ts`, add `onDidSync` to `CentralSyncScheduler`: a
      `vscode.EventEmitter<void>`/`.event` pair, fired right after the existing successful-commit
      `outputChannel.appendLine(...)` call in `flush()`.
- [x] T3 — Create `src/git/centralScm.ts` with pure, exported helpers: `parseLsTree(output: string): Map<string,
      string>` (parses `<mode> blob <sha>\t<path>` lines) and `isPendingSync(onDiskSha: string, committedSha:
      string): boolean`.
- [x] T4 — In `centralScm.ts`, add `ensureCentralScmProvider(root, context, outputChannel, syncScheduler)`:
      idempotent creation of the `vscode.scm` `SourceControl` + one resource group, a `refresh()` that runs
      `ls-tree`/`hash-object`, builds resource states (pending vs. synced), sets `count`, and registers the
      `specmesh-central:` `TextDocumentContentProvider` (serving blob content via `git show <sha>`). Treat an
      unborn-`HEAD` `ls-tree` failure as zero tracked docs, not an error.
- [x] T5 — Wire each resource's `command` to `vscode.diff` against the `specmesh-central:` virtual document.
- [x] T6 — In `src/extension.ts`: call `ensureCentralScmProvider` at activation if `findSpecGitRoot()` already
      returns a root, and again after a successful `enableCentralTracking()` inside the existing
      `specmesh.enableCentralTracking` command handler. Register `specmesh.refreshCentralScm`.
- [x] T7 — Add `specmesh.refreshCentralScm` to `package.json`'s `commands`, plus a `scm/title` menu section with
      it and `specmesh.showCentralHistory`, both `when: scmProvider == specmeshCentral`.
- [x] T8 — Write `src/test/centralScm.test.ts` covering `parseLsTree` and `isPendingSync`.
- [x] T9 — Manually verify against this repo's own already-enabled `.specmesh/spec.git`: the "specmesh
      (central)" entry appears in the Source Control view listing currently tracked docs; editing a tracked doc
      shows it flagged "pending" until the debounce commits, then clears; the diff command opens a working diff
      between the last central commit and the on-disk file.
- [x] T10 — Fix: the resource list only ever showed docs already present in `HEAD`'s tree, so a doc that had
      never once been synced (e.g. never resaved since Enable) was invisible instead of showing as "not yet
      synced". Broadened `refresh()` to union `crawlWorkspace()`'s tracked docs with `HEAD`'s tree, added the
      pure `classifySyncStatus` helper (`new`/`pending`/`synced`), and excluded docs under an untracked repo.
- [x] T11 — Fix: the view only refreshed on registration, a successful central commit, or a manual command —
      newly-discovered tracked docs required a manual "Refresh" click. Wired `refreshCentralScm()` into
      `extension.ts`'s existing debounced `refresh()` cycle so it updates on the same cadence as the Docs tree.
- [x] T12 — Fix: `package.json` had no `activationEvents` at all, so specmesh only activated lazily on first
      view/command use; the "specmesh (central)" entry could be missing until the user interacted with some
      other specmesh UI first. Added `"activationEvents": ["onStartupFinished"]`.
- [x] T13 — Hardening: wrapped `centralScm.ts`'s entire `refresh()` body in try/catch, logging any unexpected
      failure to the `specmesh` output channel instead of letting it fail silently (previously only the
      `ls-tree` call itself was guarded). Confirmed with the user that the remaining "list takes a moment to
      populate after launch" behavior is expected crawl latency, not a bug — no further action needed.
