# FR-004: Docs Explorer Actions Menu

**Revision**: 1
**Status**: Approved
**Repos**: specmesh
**Created**: 2026-09-14
**Epic**: [EPIC-001: Docs Explorer Authoring](../epics/EPIC-001-docs-explorer-authoring.md)

## User Story

As a developer using the Docs Explorer, I want a menu button near the status row that lets me run "Show
Orphans", "Show Missing" and "Refresh Docs" directly, so I don't have to open the Command Palette to run
these existing specmesh commands.

## Overview

Adds a "more actions" toolbar menu button to the Docs Explorer view's title bar, grouping the three existing
commands (`specmesh.showOrphans`, `specmesh.showMissing`, `specmesh.refresh`) into one dropdown so they're
reachable with a couple of clicks instead of the Command Palette.

## Functional Requirements

- **FR-1**: The Docs Explorer view's title bar shows a single "more actions" toolbar button (ellipsis-style
  icon), distinct from the existing per-item inline actions (Add new…, Delete).
- **FR-2**: Clicking the button opens a dropdown menu with exactly three entries, in this order: "Show
  Orphans", "Show Missing", "Refresh Docs".
- **FR-3**: "Show Orphans" runs the existing `specmesh.showOrphans` command unchanged.
- **FR-4**: "Show Missing" runs the existing `specmesh.showMissing` command unchanged.
- **FR-5**: "Refresh Docs" runs the existing `specmesh.refresh` command unchanged.
- **FR-6**: No new commands or business logic are introduced — this feature only adds a discoverable menu
  entry point to commands that already exist and are already registered in the Command Palette.

## Out of Scope

- Embedding a clickable button inside the status row text itself — `vscode.TreeView.message` is a plain
  string with no button API (already called out as not possible in FR-002's Out of Scope); the menu button
  lives in the view's title bar instead, directly above the status row.
- Changing what "Show Orphans" / "Show Missing" output (still the output channel), or changing
  `specmesh.refresh`'s behavior.
- Removing the three commands from the Command Palette — they remain available there too.

## Assumptions

- "Menu button" is implemented as a VS Code view-title toolbar button with a submenu (`contributes.submenus`
  + `menus["view/title"]`), the standard VS Code pattern for a single icon that expands into multiple actions
  in a title bar — since no button can attach to the status row text itself.
- The menu button uses the standard "ellipsis" (`$(ellipsis)`) icon, VS Code's usual convention for a
  "more actions" menu, placed in the title bar's secondary (overflow) group so it doesn't crowd the existing
  "Add new…" inline actions.
- Menu entry order follows the order given in the user story (Show Orphans, Show Missing, Refresh Docs)
  rather than reordering by frequency of use.

## Open Questions

- None.
