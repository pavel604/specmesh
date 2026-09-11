# Walkthrough: FR-001 Manage .specmesh.yml and Create New Docs from the Docs Tree (v1)

## Files Changed

- [src/scaffold/scaffold.ts](../../src/scaffold/scaffold.ts) — exported `buildSpecmeshYml` (T1) so it can be
  reused to seed a lone `.specmesh.yml`.
- [src/scaffold/newDoc.ts](../../src/scaffold/newDoc.ts) *(new)* — `openOrCreateConfig` (T2) opens an existing
  `.specmesh.yml` or creates + opens one seeded from `buildSpecmeshYml(false)`; `addNewDoc` (T3) quick-picks a
  folder's non-FR tracked doc types, prompts for a title, derives a numbered/slug file path (editable before
  writing), writes a minimal `# Title` + `**Status**: Draft` template, and opens it.
- [src/views/docsTreeProvider.ts](../../src/views/docsTreeProvider.ts) — new pinned `config` tree-item kind
  rendered first under every workspace-folder node (T4), showing "not created" + a dimmed icon when the file
  doesn't exist yet; `contextValue: "folder"` added to folder items so `package.json` can target the inline
  menu.
- [src/extension.ts](../../src/extension.ts) — registered `specmesh.openOrCreateConfig` and
  `specmesh.addNewDoc` (T5), both re-running the existing `refresh()` afterward; `refresh()` now also computes
  a per-folder `.specmesh.yml` existence map for the tree.
- [package.json](../../package.json) — new command contributions plus a `view/item/context` inline menu entry
  (`$(add)` icon) scoped to folder tree items (T6).
- [README.md](../../README.md) — documented the pinned config node and "Add new…" action in Quick start and
  Tree appearance (T7).

## Review Fixes

- [src/scaffold/newDoc.ts](../../src/scaffold/newDoc.ts) — "Add new…" now also excludes `mission` and `sdd`
  (T9): mission is created only by the scaffold command, and the SDD doc is a hand-authored singleton, not an
  ad-hoc-creatable type.
- [src/views/docsTreeProvider.ts](../../src/views/docsTreeProvider.ts) / [src/extension.ts](../../src/extension.ts) / [package.json](../../package.json) — added a "Delete Doc" context-menu action on any
  tracked doc tree item (T10): confirms via a modal, then moves the file to the OS trash
  (`vscode.workspace.fs.delete(..., { useTrash: true })`) rather than deleting permanently, and refreshes the
  tree afterward.

## Second Review Fix

Symptoms reported (`docs/test-doc*/*.md` path, "SDD" still offered) exactly match the pre-fix behavior
(`fr-spec`'s doubly-wildcarded glob `docs/FR-*/spec.v*.md`, and `sdd` not yet excluded) — the running
Extension Development Host was almost certainly still on the build from before T9/T10. **Reload that window**
(`Developer: Reload Window`, or relaunch F5) to pick up the compiled changes, then retest.

Also hardened [src/scaffold/newDoc.ts](../../src/scaffold/newDoc.ts)'s `globToPath` regardless: it now
replaces **every** `*` in a glob (`/\*/g`), not just the first, so even a custom third-party `.specmesh.yml`
type with more than one wildcard can't leave a literal `*` in the written path.

## Build/Test Results

`npm run compile` succeeds with no errors (T8, re-verified after T9-T11 and the `globToPath` hardening). No
automated test suite exists in this repo to run beyond the TypeScript compile.

## Follow-ups / Known Gaps

- Not manually exercised inside a running Extension Development Host (F5) — worth clicking through the new
  `.specmesh.yml` node, "Add new…", and "Delete Doc" flows once to confirm the UX feels right.
- The numbering heuristic (`-` immediately before the glob's wildcard) only covers this repo's current
  conventions (ADR/EPIC/FR); an unusual custom `.specmesh.yml` glob could get a wrong default number, though
  the confirm-path step lets you fix it before anything is written.
- Delete is scoped to tracked doc entries only (not the pinned `.specmesh.yml` node or missing/expected
  entries) — deleting a repo's config file still has to go through the normal file explorer.

