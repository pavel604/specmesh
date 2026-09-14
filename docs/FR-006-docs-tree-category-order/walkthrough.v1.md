# Walkthrough: FR-006 Docs Tree Category Order (v1)

## Files Changed

- [src/crawler/crawler.ts](../../src/crawler/crawler.ts) — `CrawlResult` gains `categoryOrder: Map<string,
  string[]>`, populated per folder from the `defs` list already used to search for that folder's docs (T1).
- [src/extension.ts](../../src/extension.ts) — `refresh()` destructures `categoryOrder` from `crawlWorkspace()`
  and passes it to `treeProvider.update(...)` (T2).
- [src/views/docsTreeProvider.ts](../../src/views/docsTreeProvider.ts) — `update()` takes and stores
  `categoryOrder`; a new `categoryIndex(folderName, type)` helper looks up a type's position in that folder's
  order (falling back to "sort last" if absent); the `"folder"` branch of `getChildren` sorts category entries
  by that index instead of by `categoryLabels`' insertion order (T3, T4).

## Build/Test Results

- `npm run compile` — clean.
- `npm test` — 12/12 passing (unchanged; this feature has no vscode-free unit-testable logic per ADR-001's
  scope, consistent with FR-005).

## Follow-ups / Known Gaps

- T5 (manual verification in the Extension Development Host) is not yet done — please reorder this repo's own
  `.specmesh.yml` `track:` list (e.g. move `epic` above `adr`), refresh the Docs Explorer, and confirm the
  category rows follow the new order.
