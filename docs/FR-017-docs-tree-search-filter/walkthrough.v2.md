# Walkthrough: FR-017 Docs Tree Search Filter (v1 → v2)

## What Changed & Why

v1's search filter only matched a doc's title or filename. A user searching "builder" got zero results even
though the word appeared throughout several docs' bodies — title/filename-only matching was too narrow. v2
extends matching to the doc's full raw markdown body content, read once at crawl time (no extra disk I/O per
keystroke).

## Files Changed

- `src/model/types.ts` — `DocNode` gains optional `content?: string`.
- `src/crawler/crawler.ts` — the `content` variable already read per-doc (for title/link parsing) is now also
  stored on the `DocNode`.
- `src/views/docsTreeProvider.ts` — `docMatchesFilter` takes a `content` parameter and checks it alongside
  title/filename; `isVisible()` passes `node.content ?? ""`.
- `src/test/docsTreeFilter.test.ts` — updated existing `docMatchesFilter` calls for the new parameter, added a
  content-substring match test, an "unrelated text still doesn't match" case with non-empty content, and a
  `DocsTreeProvider`-level test proving a doc matches purely via body content (title/filename don't match).
- `README.md` — search-filter bullet now says "title, filename, or body content".

## Build/Test Results

`npm test`: 108 passing, 0 failing (up from 106).

## Follow-ups / Known Gaps

- None.
