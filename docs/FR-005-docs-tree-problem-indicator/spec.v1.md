# FR-005: Docs Tree Problem Indicator

**Revision**: 1
**Status**: Approved
**Repos**: specmesh
**Created**: 2026-09-14
**Epic**: [EPIC-001: Docs Explorer Authoring](../epics/EPIC-001-docs-explorer-authoring.md)

## User Story

As a developer using the Docs Explorer, I want a folder or category row (e.g. "ADRs", "FR Specs") to visibly
show when a doc underneath it has a broken link or a missing tracked file, so I don't have to expand every
folder/category to find where a problem is hiding.

## Overview

Individual doc rows already show a warning icon when they have broken links, and missing tracked files already
render as their own red-icon row. This feature rolls that same signal up one level: the workspace-folder row and
each category row (ADRs, FR Specs, etc.) swap their default icon for a warning/error icon when a problem exists
anywhere underneath them, so a problem is visible without expanding the tree.

## Functional Requirements

- **FR-1**: A workspace-folder tree row (`kind: "folder"`) shows an error icon (`list.errorForeground`) instead
  of its default icon when any tracked doc in that folder has a "missing" problem underneath it.
- **FR-2**: A workspace-folder row shows a warning icon (`list.warningForeground`) instead of its default icon
  when it has no "missing" problem but at least one doc underneath it has a broken link.
- **FR-3**: A category tree row (`kind: "category"`, e.g. "ADRs") follows the same two rules (FR-1/FR-2), scoped
  to just that folder+type combination instead of the whole workspace folder.
- **FR-4**: When neither condition applies, the row keeps its current default icon (`repo` for folder, `folder`
  for category) — this feature never changes the label text or its color.
- **FR-5**: A flagged folder/category row's tooltip summarizes the count(s) below it, e.g. "1 missing file",
  "2 broken links", or "1 missing file, 2 broken links" when both apply.
- **FR-6**: This uses the same `Problem[]` / broken-link data already computed by the existing crawl in
  `update()` — no new crawl, no new refresh trigger; the indicator updates whenever the tree already refreshes.

## Out of Scope

- Git-status-based coloring (new/changed files) — considered and explicitly deferred; see this session's
  discussion. VS Code's built-in git decorations continue to be the only source of that signal, unchanged.
- A badge/count overlay (e.g. "3") on the icon — a plain icon swap is enough to draw the eye; exact counts are
  in the tooltip instead (FR-5).
- Coloring the row's label text — icon-only, per the user story.

## Assumptions

- Severity precedence when a folder/category has both problem kinds: missing (error/red) wins over broken-link
  (warning/amber) — this mirrors the severity already used for the individual "missing" tree item vs. a doc's own
  broken-link icon, just applied one level up.
- No live-update wiring beyond what already exists: `DocsTreeProvider.update()` already receives the full
  `Problem[]` on every crawl/refresh and fires `onDidChangeTreeData`, so this is a pure rendering-layer change.

## Open Questions

- None.
