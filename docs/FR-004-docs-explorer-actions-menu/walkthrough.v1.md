# Walkthrough: FR-004 Docs Explorer Actions Menu (v1)

## Files Changed

- [package.json](../../package.json) — added a `contributes.submenus` entry (`specmesh.docsExplorerActions`,
  "More Actions", `$(ellipsis)` icon), a `view/title` menu entry that shows it as a toolbar button on the
  Docs Explorer view, and the submenu's own command list (Show Orphans, Show Missing, Refresh Docs) reusing
  the three existing commands unchanged (T1-T3).

## Build/Test Results

`npx tsc -p ./ --noEmit` completes with no errors. No source (`.ts`) changes were needed — the three commands
already existed and are only exposed through a new menu entry point.

## Follow-ups / Known Gaps

- None.
