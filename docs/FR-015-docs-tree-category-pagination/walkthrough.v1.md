# Walkthrough: FR-015 Docs Tree Category Recency Sort & Pagination (v1)

## Files Changed

- [src/crawler/docTypeTree.ts](../../src/crawler/docTypeTree.ts) — new `sortDocsReverseChronological(nodes)`:
  parses `Created`/`Date` front-matter and sorts newest-first, falling back to reverse title order when
  neither is present or parseable (T1).
- [src/views/docsTreeProvider.ts](../../src/views/docsTreeProvider.ts) — `MAX_VISIBLE_DOCS_PER_CATEGORY = 10`;
  a `"more"` `TreeItemData` kind; `expandedCategories: Set<string>` state; `expandCategory(folderName, type)`;
  the `"category"` branch of `getChildren` now sorts via `sortDocsReverseChronological`, slices to the cap
  unless expanded, and appends a `"more"` row; `getTreeItem` renders `"more"` as an ellipsis-icon row (T2, T3).
- [src/extension.ts](../../src/extension.ts) — registers `specmesh.expandCategory`, forwarding to
  `treeProvider.expandCategory(...)` (T4).
- [package.json](../../package.json) — declares the `specmesh.expandCategory` command (T4).
- [src/test/docTypeTree.test.ts](../../src/test/docTypeTree.test.ts) — `sortDocsReverseChronological` suite:
  `Created` descending, `Date` fallback, dated-before-undated ranking, reverse-title fallback (T5).

## Build/Test Results

- `npm run compile` — clean.
- `npm test` — 84/84 passing (4 new `sortDocsReverseChronological` cases included).

## Follow-ups / Known Gaps

- None — user confirmed the tree behaves as expected (sorted newest-first, capped at 10, "Show N more…"
  expands the rest) before this documentation was written.
