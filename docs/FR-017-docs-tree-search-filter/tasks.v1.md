# Tasks: FR-017 Docs Tree Search Filter (v1)

- [x] T1 — `src/views/docsTreeProvider.ts`: add `filterText` state, `setFilter(text)`/`getFilter()`, exported
      `docMatchesFilter(title, filename, filterText)` pure helper, and private `isVisible(node)` (matches
      directly or via any nested child from `childrenOf()`).
- [x] T2 — `src/views/docsTreeProvider.ts`: gate `getChildren()`'s root/folder/category branches on
      `isVisible`/`filterText` per plan (hide config + Declared Repos + missing entries while filtering; filter
      `sortedDocs` before the `MAX_VISIBLE_DOCS_PER_CATEGORY` pagination slice); no behavior change when
      `filterText` is empty.
- [x] T3 — `src/extension.ts`: add pure `applyFilterPrefix(baseMessage, filterText)` helper next to
      `computeStatusMessage`.
- [x] T4 — `src/extension.ts`: track `currentFilter`/`lastStatusMessage` in `activate()`; register
      `specmesh.filterDocs` (live `createInputBox` wired to `treeProvider.setFilter` + status row update) and
      `specmesh.clearDocsFilter` commands; set `specmesh.docsFilterActive` context key on every filter change.
- [x] T5 — `package.json`: add `specmesh.filterDocs` (`$(search)`) and `specmesh.clearDocsFilter`
      (`$(clear-all)`) to `contributes.commands`, and matching `view/title` entries for
      `view == specmesh.docsExplorer` (clear icon gated on `specmesh.docsFilterActive`).
- [x] T6 — `README.md`: add a bullet under "Tree appearance" documenting the search/filter title-bar action and
      that the status row reflects an active filter.
- [x] T7 — `src/test/statusMessage.test.ts`: add `applyFilterPrefix` cases (no filter passes base message
      through; active filter prefixes it; active filter with an `undefined` base message from the empty-tree
      case).
- [x] T8 — `src/test/docsTreeFilter.test.ts` (new): unit tests for `docMatchesFilter`, plus a
      `DocsTreeProvider` scenario (fixture nodes incl. one nested parent/child pair) asserting `getChildren()`
      output before/after `setFilter(...)`.
- [x] T9 — `npm test` and fix any build/lint/test errors.
- [x] T10 — Walkthrough feedback: the status row's "N docs" count didn't change while filtering (it kept
      showing the total, just with a "Filter: ..." prefix). Add `DocsTreeProvider.visibleDocCount()` (total doc
      count when no filter is active; otherwise the count of docs actually rendered under the current filter —
      visible top-level docs plus all of their unconditionally-rendered children) and use it in place of
      `nodes.length` when composing the status row in `src/extension.ts`, so "N docs" reflects what's actually
      shown while filtering.


