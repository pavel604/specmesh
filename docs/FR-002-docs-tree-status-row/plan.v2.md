# Migration Plan: FR-002 v1 → v2

**Status**: Approved

## Changes to Apply

- FR-1 — `refresh()` in [src/extension.ts](../../src/extension.ts) always sets `treeView.message` to a non-empty
  status string after a completed crawl → it clears the message (`undefined`) when the crawl found zero tracked
  docs and zero missing-tracked-file problems across all workspace folders, so `viewsWelcome` renders instead.

## Affected Files

- [src/extension.ts](../../src/extension.ts) — rename `formatStatusMessage` to `computeStatusMessage`, change its
  return type to `string | undefined`, return `undefined` when `docCount === 0 && missingCount === 0`; export it
  for unit testing; update the call site in `refresh()` (no other logic changes).
- `src/test/statusMessage.test.ts` (new) — Mocha unit test covering `computeStatusMessage`: returns `undefined`
  for zero docs/zero missing, and returns the existing formatted string otherwise (including the zero-broken-
  links/zero-orphans case, to guard the FR-002 v1 "never blank during real activity" behavior).

## Sequencing / Risks

- No risk to the "row never disappears while docs exist" behavior (FR-002 v1's original intent) — the cleared
  branch only fires when `docCount === 0 && missingCount === 0`, which is exactly the case `DocsTreeProvider.
  getChildren()` already treats as an empty root (no nodes, no missing entries), so `viewsWelcome`'s own
  "no children" condition is also satisfied at the same time.
- No package.json changes needed — the existing `viewsWelcome` contribution for `specmesh.docsExplorer` is
  untouched.
