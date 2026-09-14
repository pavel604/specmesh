# Implementation Plan: FR-004 Docs Explorer Actions Menu (v1)

**Status**: Approved

## Affected Files/Projects

- [package.json](../../package.json) — add a `contributes.submenus` entry for the new dropdown, add a
  `view/title` menu contribution that shows the submenu button, and add the submenu's own command list
  (Show Orphans / Show Missing / Refresh Docs, reusing the three existing command ids).

## Approach

### Front-end (if applicable)

No source code changes needed — `specmesh.refresh`, `specmesh.showOrphans`, `specmesh.showMissing` already
exist and are already registered in [src/extension.ts](../../src/extension.ts). This is purely a
`package.json` contribution-points change:

1. Add a submenu id (e.g. `specmesh.docsExplorerActions`) under `contributes.submenus`, with a title
   ("More Actions") and the `$(ellipsis)` icon.
2. Add one entry to `contributes.menus["view/title"]` that references the submenu id, scoped
   `"when": "view == specmesh.docsExplorer"`, placed in the `navigation` group so it renders as a title-bar
   icon button (kept separate from the existing per-item inline `Add new…`/`Delete` actions, which live in
   `view/item/context`, not `view/title`).
3. Add a `contributes.menus["specmesh.docsExplorerActions"]` array listing the three existing commands in
   the order: `specmesh.showOrphans`, `specmesh.showMissing`, `specmesh.refresh`, each with no extra
   `when` clause (always available once the Docs Explorer view exists).

### Back-end (if applicable)

Not applicable — no command logic changes.

### Data

Not applicable — no model/contract changes.

## Sequencing

Single self-contained `package.json` edit; no dependency ordering needed.

## Risks / Tradeoffs

- VS Code renders `view/title` `navigation`-group submenu buttons as a single icon; if it ends up crowding
  the title bar next to any other view-level actions, they can be split between the primary and overflow
  (`"1_actions"` vs default) groups — low risk given there are currently no other `view/title` entries.
