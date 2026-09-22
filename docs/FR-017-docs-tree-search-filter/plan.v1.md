# Implementation Plan: FR-017 Docs Tree Search Filter (v1)

**Status**: Approved

## Approach

### Filter state + status row composition (`src/extension.ts`)

Adds a small pure helper, alongside the existing `computeStatusMessage`, that prefixes the status row with the
active filter text (or passes the base message through unchanged when no filter is set) — kept pure so it's
unit-testable the same way `computeStatusMessage` already is. `activate()` tracks the current filter string and
the last-computed base status message, and recomputes `treeView.message` (via this helper) both after every
crawl and whenever the filter changes. Two new commands are registered: `specmesh.filterDocs` (opens a live
`vscode.window.createInputBox()` seeded with the current filter; every `onDidChangeValue` immediately re-applies
the filter to the tree and status row, no Enter/confirm needed) and `specmesh.clearDocsFilter` (resets the filter
to empty). A `specmesh.docsFilterActive` context key (set the same way `specmesh.viewMode` already is) tracks
whether a filter is currently active, so the "clear filter" title-bar icon only shows up while there's something
to clear.

**Files:**

- [src/extension.ts](../../src/extension.ts) — add `applyFilterPrefix(baseMessage, filterText)` pure helper;
  track `currentFilter`/`lastStatusMessage` state in `activate()`; register `specmesh.filterDocs` and
  `specmesh.clearDocsFilter` commands; set the `specmesh.docsFilterActive` context key on every filter change;
  recompute `treeView.message` through the new helper in `refresh()` and the filter-change handler.

### Tree filtering (`src/views/docsTreeProvider.ts`)

`DocsTreeProvider` gains filter state (`filterText`) and a `setFilter(text)`/`getFilter()` pair. A small pure,
exported `docMatchesFilter(title, filename, filterText)` helper does the case-insensitive substring check (title
or filename) so it can be unit tested directly. A private `isVisible(node)` walks a doc node's nested children
(via the existing `childrenOf()`) so a doc is visible if it matches directly **or** any descendant matches (FR-3)
— once a node is visible this way, `getChildren()` still returns *all* of its children unfiltered, exactly as it
does today, satisfying "children are not individually re-filtered".

When `filterText` is non-empty, `getChildren()` is adjusted at each level to only descend into branches that
lead to at least one visible doc:

- **Root**: a workspace folder is only listed if it has ≥1 visible top-level doc.
- **Folder**: the `.specmesh.yml` config entry and the Declared Repos category (repos + missing-repo entries)
  are omitted entirely — they aren't docs, so they have nothing to match. A doc-type category is only listed if
  it has ≥1 visible top-level doc.
- **Category**: `sortedDocs` is filtered down to visible docs *before* the existing
  `MAX_VISIBLE_DOCS_PER_CATEGORY` pagination slice is applied (so "Show N more…" counts reflect the filtered
  set); missing-tracked-file entries are omitted while a filter is active (they aren't matchable docs either).

With an empty filter, every code path above falls back to exactly today's unfiltered behavior (FR-7) — the new
logic is additive, gated on `filterText !== ""`.

**Files:**

- [src/views/docsTreeProvider.ts](../../src/views/docsTreeProvider.ts) — add `filterText` state,
  `setFilter`/`getFilter`, exported `docMatchesFilter` helper, private `isVisible`, and gate the root/folder/
  category branches of `getChildren()` on filter visibility as described above.

### Title-bar contributions (`package.json`)

Adds the two new commands (`specmesh.filterDocs` with a `$(search)` icon, `specmesh.clearDocsFilter` with a
`$(clear-all)` icon) to `contributes.commands`, and wires both into the existing `view/title` menu for
`specmesh.docsExplorer` — `filterDocs` always shown, `clearDocsFilter` gated on the new
`specmesh.docsFilterActive` context key so it only appears once a filter is active. Placed after the existing
`toggleGraphView`/`docsExplorerActions` entries so existing icon order/groups are untouched.

**Files:**

- [package.json](../../package.json) — add `specmesh.filterDocs`/`specmesh.clearDocsFilter` to
  `contributes.commands`, and two new `view/title` entries scoped to `view == specmesh.docsExplorer`.

### Docs

Short mention of the new filter action in the README's "Tree appearance" section, since that's where other
tree-only UI behavior (status row, problem icons, pinned config entry) is already documented.

**Files:**

- [README.md](../../README.md) — add a bullet under "Tree appearance" describing the search/filter title-bar
  action and that the status row reflects an active filter.

## Sequencing

1. `docsTreeProvider.ts` — filter state, `docMatchesFilter`, `isVisible`, and the `getChildren()` gating (the
   core behavior; testable in isolation).
2. `extension.ts` — `applyFilterPrefix`, filter state, the two commands, and the `specmesh.docsFilterActive`
   context key (wires the UI trigger to the tree provider from step 1).
3. `package.json` — command + menu contributions (makes step 2's commands reachable from the title bar).
4. `README.md` — doc update.
5. Tests: extend `src/test/statusMessage.test.ts` with `applyFilterPrefix` cases; add a new
   `src/test/docsTreeFilter.test.ts` covering `docMatchesFilter` and a `DocsTreeProvider.getChildren()` filtering
   scenario (fixture nodes with one nested parent/child pair) per ADR-001's "covered opportunistically" guidance
   for `views/*`.

## Risks / Tradeoffs

- VS Code's `TreeView` API has no native persistent embedded search box (see spec Assumptions) — this plan's
  title-bar input box is the closest practical equivalent, not a literal widget pinned inside the tree body.
- Filtering re-derives visibility on every `getChildren()` call rather than caching a precomputed visible-id set;
  acceptable at today's doc-graph sizes (same cost class as the existing per-render `sortDocsReverseChronological`
  and problem-count lookups), but worth revisiting if crawl sizes grow much larger.
