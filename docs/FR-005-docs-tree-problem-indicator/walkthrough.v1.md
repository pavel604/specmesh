# Walkthrough: FR-005 Docs Tree Problem Indicator (v1)

**Status**: Approved

## Summary

Folder and category rows in the Docs Explorer now swap their default icon for an error (red) or warning
(amber) icon when a doc underneath them has a "missing tracked file" or "broken link" problem, respectively —
missing takes precedence over broken links when both are present. A tooltip on the row summarizes the counts.
This is a pure rendering-layer change in `DocsTreeProvider`; no new crawl or refresh trigger was needed since
`update()` already receives the full problem set on every refresh.

Separately (approved earlier this session, unrelated to FR-005's scope but implemented alongside it):
`extractMarkdownLinks` now skips fenced code blocks, fixing a false-positive broken-link flag for template
link syntax shown as an example inside SKILL.md files.

## Changed Files

- [src/views/docsTreeProvider.ts](../../src/views/docsTreeProvider.ts) — added `problemsByFolder`/
  `problemsByCategory` aggregation (built in `update()`), `problemIcon`/`problemTooltip` helpers, and wired
  them into the `"folder"` and `"category"` branches of `getTreeItem`.
- [src/crawler/linkExtractor.ts](../../src/crawler/linkExtractor.ts) — `extractMarkdownLinks` now tracks fenced
  code block state and skips link extraction while inside a fence.
- [src/test/linkExtractor.test.ts](../../src/test/linkExtractor.test.ts) — added a test covering the
  fenced-code-block skip.

## Verification

- `npm run compile` — clean.
- `npm test` — 12/12 passing (11 previous + 1 new).
- Manual verification of the tree icon/tooltip behavior in the Extension Development Host is still recommended
  before merging (introduce a broken link and a missing tracked file, confirm folder/category rows pick up the
  right icon/tooltip and clear once fixed).

## Out of Scope (unchanged from spec)

- Git-status-based folder/category coloring — explicitly evaluated and dropped this session in favor of this
  smaller, doc-scoped indicator.
