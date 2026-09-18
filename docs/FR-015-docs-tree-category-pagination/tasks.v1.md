# Tasks: FR-015 Docs Tree Category Recency Sort & Pagination (v1)

- [x] T1 — Add `sortDocsReverseChronological(nodes)` to `docTypeTree.ts`: sorts by parsed `Created`/`Date`
      front-matter descending, falling back to reverse title order.
- [x] T2 — Add `MAX_VISIBLE_DOCS_PER_CATEGORY`, the `"more"` `TreeItemData` kind, `expandedCategories` state,
      and `expandCategory(folderName, type)` to `DocsTreeProvider`.
- [x] T3 — Sort/cap docs and append a `"more"` item in the `"category"` branch of `getChildren`; render `"more"`
      in `getTreeItem`.
- [x] T4 — Register `specmesh.expandCategory` in `extension.ts` and declare it in `package.json`.
- [x] T5 — Add unit tests for `sortDocsReverseChronological` in `docTypeTree.test.ts`.
- [x] T6 — `npm run compile` and `npm test` clean.
