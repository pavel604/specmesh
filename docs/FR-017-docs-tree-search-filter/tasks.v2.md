# FR-017 v1 → v2 Migration Tasks

- [x] T1: Add `content?: string` to `DocNode` in `src/model/types.ts`.
- [x] T2: Populate `content` on the `DocNode` literal in `crawlWorkspaceFolder` (`src/crawler/crawler.ts`).
- [x] T3: Add a `content` parameter to `docMatchesFilter` (`src/views/docsTreeProvider.ts`); check it alongside
      title/filename.
- [x] T4: Update `isVisible()`'s call site to pass `node.content ?? ""`.
- [x] T5: Update `docMatchesFilter` tests + add body-content-match test cases in `src/test/docsTreeFilter.test.ts`.
- [x] T6: Update the search-filter bullet in `README.md` to mention body-content matching.
- [x] T7: Run `npm test`, confirm all passing, no regressions.
