# Implementation Plan: FR-002 Fixed Docs Tree Status Row (v1)

**Status**: Approved

## Affected Files/Projects

- [src/extension.ts](../../src/extension.ts) — `refresh()` currently clears `treeView.message` to `undefined`
  after a crawl; change it to always hold a non-empty string (in-progress text, then a summary), and add a
  small formatting helper for the summary text.

## Approach

### Front-end (Docs Explorer tree view)

- Keep the existing `treeView.message = "specmesh: indexing docs…";` line at the top of `refresh()` unchanged
  (FR-2) — it already runs before the `await crawlWorkspace()` call, so it's set as soon as a refresh starts.
- Replace the trailing `treeView.message = undefined;` with `treeView.message = <summary>;`, computed from the
  same `brokenLinks` / `orphans` / `missing` values already derived for the output-channel log line (FR-3,
  FR-5) — reuse those existing consts instead of recomputing.
- Add a small local helper (e.g. `formatStatusMessage(docCount, missingCount, brokenLinks, orphans)`) in
  `extension.ts` that always renders all four counts, pluralizing "doc"/"broken link"/"orphan" but leaving
  "missing" as a bare count (matches the spec's example format), so the string's shape stays consistent whether
  counts are zero or not (FR-4).
- No changes needed to `DocsTreeProvider` — `treeView.message` is independent of the tree's `TreeItem`s, so
  this is fully contained in `extension.ts`.

### Back-end

- N/A — no backend/service layer in this extension.

### Data

- N/A — no new models; reuses existing `Problem[]` / `DocNode[]` already computed in `refresh()`.

## Sequencing

1. Add the `formatStatusMessage` helper.
2. Swap the final `treeView.message = undefined;` for the computed summary, reusing existing counts.
3. Manually verify (via the watch task / Extension Development Host) that the row never disappears across the
   initial load and a triggered refresh (e.g. editing a tracked doc).

## Risks / Tradeoffs

- None significant — this is a small, localized change to one function; no new dependencies or async logic.
