# Walkthrough: FR-002 Fixed Docs Tree Status Row (v1 → v2)

## What Changed & Why

FR-002 v1 required `treeView.message` to always hold a non-empty string once a crawl completed. VS Code only
renders a view's `viewsWelcome` content when the tree has zero children **and** no `TreeView.message` set —
so the always-populated status row was silently hiding the "Scaffold Spec-Driven Development Structure" welcome
button for a genuinely empty workspace folder (no tracked docs, no `.specmesh.yml`). `refresh()` now clears the
status row (`treeView.message = undefined`) specifically in that empty case, letting the welcome content render
again, while still keeping the row populated for every other state (loading, or any docs/missing files present).

## Files Changed

- [src/extension.ts](../../src/extension.ts) — renamed `formatStatusMessage` to `computeStatusMessage`, changed
  its return type to `string | undefined`, made it return `undefined` when `docCount === 0 && missingCount ===
  0`, exported it for unit testing, and updated the `refresh()` call site.
- `src/test/statusMessage.test.ts` (new) — unit tests for `computeStatusMessage`: undefined on zero docs/zero
  missing, formatted string when docs exist (even with zero broken links/orphans), and formatted string when
  only missing-tracked-file problems exist (zero docs).

## Build/Test Results

`npm test` — 15 passing, 0 failing (3 new for `computeStatusMessage`, 12 pre-existing). No compile errors.

## Follow-ups / Known Gaps

- None.
