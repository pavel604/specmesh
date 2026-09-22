# Migration Plan: FR-017 v1 → v2

**Status**: Approved

## Changes to Apply

### Store doc content on `DocNode` at crawl time

Today the crawler reads each doc's raw file text into a local `content` variable only to parse its title/
metadata/links, then discards it. To support body-content search without re-reading files on every keystroke,
`DocNode` gains an optional `content` field populated from that same already-read text.

**Files:**

- `src/model/types.ts` — add `content?: string` to `DocNode` (optional so existing test fixtures that build
  `DocNode` literals without it keep compiling; every real crawled node will have it).
- `src/crawler/crawler.ts` — include `content` in the `DocNode` object literal built in `crawlWorkspaceFolder`
  (the `content` variable is already in scope there).

### Match filter text against body content

`docMatchesFilter` gains a `content` parameter and checks it alongside title/filename.

**Files:**

- `src/views/docsTreeProvider.ts` — `docMatchesFilter(title, filename, content, filterText)`: case-insensitive
  substring check adds `content.toLowerCase().includes(needle)` to the existing title/filename checks. Update
  its one call site in `isVisible()` to pass `node.content ?? ""`.

### Docs

**Files:**

- `README.md` — the existing search-filter bullet (added by FR-017 v1) is updated to say it also matches body
  content, not just title/filename.

## Sequencing / Risks

- No performance concern: content is read once per crawl (already happening today) and kept in memory; filtering
  on keystroke is an in-memory `.includes()` over already-loaded strings, same cost class as the existing
  title/filename check.
- `content?: string` being optional means any DocNode built without it (test fixtures) falls back to `""` at the
  `isVisible()` call site via `?? ""` — no test fixtures need updating unless they want to exercise content
  matching specifically.
