# FR-002: Fixed Docs Tree Status Row

**Revision**: 1
**Status**: Approved
**Repos**: specmesh
**Created**: 2026-09-11
**Epic**: [EPIC-001: Docs Explorer Authoring](../epics/EPIC-001-docs-explorer-authoring.md)

## User Story

As a developer using the Docs Explorer, I want the status row above the tree to stay put instead of appearing
and disappearing while specmesh indexes/crawls/reloads, so the whole tree doesn't jump down and back up and
cause me to misclick a doc.

## Overview

Today `treeView.message` is only set to `"specmesh: indexing docs…"` while a crawl runs and cleared to
`undefined` immediately after, so the message row appears/disappears on every refresh and shifts every tree
item below it. This feature keeps the row always populated: a default summary message when idle, and the
in-progress message only replacing that text (never removing the row) while a crawl is running.

## Functional Requirements

- **FR-1**: The Docs Explorer tree view's status row is never empty/removed — `treeView.message` always holds
  a non-empty string, both before the first crawl, during a crawl, and after every subsequent refresh.
- **FR-2**: While a crawl is in progress (initial load or triggered refresh), the row shows the existing
  in-progress text (`"specmesh: indexing docs…"`).
- **FR-3**: Once a crawl completes, the row shows a default summary reusing the same counts already computed
  by `refresh()` for the output channel: total tracked docs, missing tracked files, broken links, and orphaned
  docs (e.g. `"12 docs · 0 missing · 2 broken links · 1 orphan"`).
- **FR-4**: The summary always lists all four counts, including zero values, so the row's content length (and
  therefore the tree's vertical offset) stays visually consistent between refreshes.
- **FR-5**: The summary is computed per workspace (all workspace folders combined), matching the existing
  single output-channel summary line, not broken out per folder.

## Out of Scope

- Tracking/showing "new" or "changed" file counts sourced from git — the mission's non-goals already rule out
  specmesh reimplementing git's change tracking; VS Code's built-in git decorations already show this on each
  doc node's icon/color.
- An action button embedded in the status row — `vscode.TreeView.message` is a plain string (no command
  links/buttons), so there's no API to attach a clickable "create new file" action to it. The existing
  per-folder "Add new…" inline toolbar action (FR-001) already covers this.
- Per-folder status rows (multiple messages) — the tree view API only exposes one `message` for the whole view.

## Assumptions

- The four counts already computed in `refresh()` (`nodes.length`, `missingProblems.length`,
  broken-link count, orphan count) are the right set to surface — they're the same ones already logged to the
  output channel, so no new computation is introduced.
- Separator/format (`" · "`, singular "1 orphan" vs "2 orphans") is a minor presentation detail I'll pick during
  implementation; not called out as a separate requirement.

## Open Questions

- None.
