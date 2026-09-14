# Implementation Plan: FR-006 Docs Tree Category Order (v1)

**Status**: Approved

## Affected Files/Projects

- [src/crawler/crawler.ts](../../src/crawler/crawler.ts) — capture each workspace folder's effective doc-type
  order (`defs.map(d => d.type)`, already computed per folder) and return it from `crawlWorkspace()`.
- [src/extension.ts](../../src/extension.ts) — pass the new ordering through to `treeProvider.update(...)`.
- [src/views/docsTreeProvider.ts](../../src/views/docsTreeProvider.ts) — store the per-folder order and use it
  to sort category rows instead of seeding order from the hardcoded global default list.

## Approach

### Front-end (Docs Explorer tree view)

- `DocsTreeProvider` gains a `categoryOrder = new Map<string, string[]>()` field, set in `update()` from a new
  parameter.
- In the `"folder"` branch of `getChildren`, after building `categoryLabels`/`presentTypes` as today, sort the
  filtered `[type, label]` entries by `categoryOrder.get(element.folderName)?.indexOf(type)` ascending (an
  entry with no match — not expected in practice, see plan's Risks — sorts after all matched ones, via a large
  fallback index) instead of relying on `categoryLabels`' Map insertion order.
- No changes to `getTreeItem`, doc/missing row rendering, or workspace-folder-row ordering (stays alphabetical).

### Back-end

- `crawlWorkspace()`'s per-folder loop already computes `const defs = repoConfig.track ?? globalDefs;` — add
  `categoryOrder.set(folder.name, defs.map((d) => d.type));` right there and include the map in the returned
  `CrawlResult`.
- `src/extension.ts`'s `refresh()` (and any other `crawlWorkspace()` call sites that feed the tree) destructure
  and forward the new field to `treeProvider.update(nodes, problems, categoryOrder)`.

### Data

- `CrawlResult` gains one field: `categoryOrder: Map<string, string[]>`. No changes to `DocNode`/`Problem` in
  [model/types.ts](../../src/model/types.ts), and no `.specmesh.yml` schema change (per spec FR-3).

## Sequencing

1. Add `categoryOrder` to `CrawlResult` and populate it in `crawlWorkspace()`.
2. Update `extension.ts` call site(s) to pass it through to `treeProvider.update(...)`.
3. Add the `categoryOrder` field + parameter to `DocsTreeProvider.update()`.
4. Sort category entries by that order in `getChildren`'s `"folder"` branch.
5. Manually verify in the Extension Development Host: reorder entries in this repo's own `.specmesh.yml`
   (e.g. move `epic` above `adr`), refresh the tree, confirm the category rows follow the new order; also
   verify a workspace folder with no `.specmesh.yml` still renders in the existing default order.

## Risks / Tradeoffs

- A category present in crawled data but absent from its folder's `categoryOrder` list isn't expected to occur
  in practice — `defs` (the source of both the crawled nodes' `type` and of `categoryOrder`) is the same list
  for a given folder — but the fallback-to-end behavior (per spec's Assumptions) is cheap insurance against it.
- Per-doc-type-definition unit tests aren't part of this plan: `crawler.ts`/`docsTreeProvider.ts` are
  vscode-coupled and, per [ADR-001](../adr/ADR-001-testing-strategy.md), aren't in the current unit-test
  priority set — verification here is manual, consistent with FR-005's approach.
