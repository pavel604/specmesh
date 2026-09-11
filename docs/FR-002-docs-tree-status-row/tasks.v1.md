# Tasks: FR-002 Fixed Docs Tree Status Row (v1)

- [x] T1 — Add a `formatStatusMessage(docCount, missingCount, brokenLinks, orphans)` helper in [src/extension.ts](../../src/extension.ts) that always renders all four counts (pluralizing "doc"/"broken link"/"orphan"; "missing" stays a bare count).
- [x] T2 — In `refresh()` in [src/extension.ts](../../src/extension.ts), replace the trailing `treeView.message = undefined;` with `treeView.message = formatStatusMessage(...)`, reusing the existing `nodes.length` / `missing` / `brokenLinks` / `orphans` values already computed for the output-channel log line.
- [x] T3 — Build and manually sanity-check (watch task / Extension Development Host) that the status row stays populated across the initial load and a triggered refresh.
