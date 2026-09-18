# Implementation Plan: FR-015 Docs Tree Category Recency Sort & Pagination (v1)

**Status**: Approved

## Approach

### Reverse-chronological doc sort (vscode-free, unit-tested)

Adds a pure sort helper alongside the other `docTypeTree.ts` doc-ordering utilities (child-type order, parent
matching), so it stays covered by plain Node unit tests per [ADR-001](../adr/ADR-001-testing-strategy.md)
instead of living inline in the vscode-coupled tree provider.

**Files:**

- [src/crawler/docTypeTree.ts](../../src/crawler/docTypeTree.ts) — add `sortDocsReverseChronological(nodes)`:
  sorts by the first parseable `Created`/`Date` front-matter field (descending), falling back to reverse title
  order when neither is present or parseable.

### Category pagination + expand affordance

**Files:**

- [src/views/docsTreeProvider.ts](../../src/views/docsTreeProvider.ts) — a `MAX_VISIBLE_DOCS_PER_CATEGORY = 10`
  constant; a new `"more"` `TreeItemData` kind (`folderName`, `type`, `remaining`); an `expandedCategories: Set<string>`
  field keyed `` `${folderName}::${type}` ``; a public `expandCategory(folderName, type)` method that adds the
  key and fires a tree refresh. The `"category"` branch of `getChildren` now sorts docs via
  `sortDocsReverseChronological`, slices to the cap unless the category is expanded, and appends a `"more"` item
  when docs remain hidden. `getTreeItem` renders `"more"` as an ellipsis-icon row wired to a new command.
- [src/extension.ts](../../src/extension.ts) — register `specmesh.expandCategory`, forwarding its
  `(folderName, type)` args to `treeProvider.expandCategory(...)`.
- [package.json](../../package.json) — declare the `specmesh.expandCategory` command (title only, no menu
  contribution — it's only ever invoked as a tree item's command).

### Tests

**Files:**

- [src/test/docTypeTree.test.ts](../../src/test/docTypeTree.test.ts) — a `sortDocsReverseChronological` suite:
  sorts by `Created` descending; falls back to `Date` when `Created` is absent; ranks dated docs above undated
  ones; falls back to reverse title order when neither is present.

## Sequencing

1. Add `sortDocsReverseChronological` to `docTypeTree.ts`.
2. Wire it into `DocsTreeProvider`'s category branch, replacing the alphabetical sort.
3. Add the cap, `"more"` item, `expandedCategories` state, and `expandCategory()` method.
4. Register/declare the `specmesh.expandCategory` command.
5. Add unit tests for the new sort helper.
6. `npm run compile` and `npm test` to confirm no regressions.

## Risks / Tradeoffs

- `docsTreeProvider.ts` itself stays untested (thin `vscode`-API wrapper, out of scope per ADR-001) — only the
  extracted pure sort logic is unit-tested; the cap/expand behavior was verified manually.
- Different doc types use different date keys (`Created` vs `Date`) with no shared convention; the two-key
  fallback handles today's known types but a new doc type using a third key name would silently fall back to
  reverse-title order instead of being flagged.
- `expandedCategories` state lives only in memory (not persisted across window reloads), which is expected —
  it's a transient "I'm currently looking at all of these" toggle, not a saved preference.
