# Implementation Plan: FR-016 Docs Dependency Graph View (v1)

**Status**: Approved

## Approach

### Graph model builder

Introduces a pure function that turns the crawled `DocNode[]` into a renderable graph: nodes, directed edges
(from resolved, existing links between two tracked docs), connected components (for grouping/spacing), and a
stray/outlier classification (zero resolved links in or out). Also assigns each node a deterministic (x, y)
position — a circular arrangement per connected component, laid out left-to-right/wrapped across the canvas,
with stray nodes placed in a separate row below the connected components.

**Files:**

- `src/views/graphModel.ts` (new) — `buildGraphModel(nodes: DocNode[]): GraphModel` computing nodes (id, title,
  relativePath, type, categoryLabel, x, y, stray flag), edges (source id, target id), grouped by connected
  component via union-find/BFS over the resolved-link adjacency; positions computed with a simple deterministic
  circular-per-component + grid-of-components layout, strays laid out in their own grid row.
- `src/test/graphModel.test.ts` (new) — unit tests: two linked docs form one component with an edge; a doc with
  no resolved links in/out is marked stray; a doc that only has a broken (non-existent) link is still stray;
  transitively linked docs (A→B→C) group into the same component; a root doc that links out is not stray even
  though nothing links back to it.

### Graph webview view + toggle

Adds a second view (`specmesh.docsGraph`, `WebviewViewProvider`-based) in the same `specmesh` activity-bar
container, shown/hidden opposite the existing tree view via a `specmesh.viewMode` context key toggled by a
new title-bar action. The webview renders the graph model as inline SVG: nodes as circles/icons colored by doc
type, edges as lines, stray nodes visually separated (e.g. a dashed divider and distinct row) from the
connected graph. Clicking a node posts a message back to the extension to open that doc; hovering shows a
native SVG `<title>` tooltip with the doc's title and relative path.

**Files:**

- `src/views/graphViewProvider.ts` (new) — `GraphViewProvider implements vscode.WebviewViewProvider`; holds the
  latest `DocNode[]`, rebuilds the `GraphModel` via `buildGraphModel` on `update()`, renders it to HTML/inline
  SVG (own small render function, no new dependency), wires `webview.onDidReceiveMessage` for `openDoc` (calls
  `vscode.window.showTextDocument`) and reuses the same type→icon/color mapping style already used in
  `docsTreeProvider.ts`'s `iconForDoc`.
- `package.json` — add `views.specmesh` entry for `specmesh.docsGraph` (type `webview`, name `Docs`), each of
  the two views' `when` clause keyed off `specmesh.viewMode` (`== 'tree'` / `== 'graph'`, default `tree`); add
  command `specmesh.toggleGraphView` (with a toggle icon) in the `view/title` menu for both views, alongside
  the existing `docsExplorerActions` submenu entry so it's visible in both modes.
- `src/extension.ts` — instantiate `GraphViewProvider`, register it via `vscode.window.registerWebviewViewProvider`,
  register `specmesh.toggleGraphView` (flips and `setContext`s `specmesh.viewMode`, defaulting to `tree` on
  activation), and call `graphViewProvider.update(nodes)` alongside the existing `treeProvider.update(...)` call
  inside `refresh()` so both views share the same crawl/refresh cycle.

## Sequencing

1. `graphModel.ts` + its unit tests first — establishes the data shape everything else consumes.
2. `graphViewProvider.ts` next, built against that model.
3. `package.json` view/command/menu wiring and `extension.ts` registration last, once the provider exists to
   register.

## Risks / Tradeoffs

- Hand-rolled SVG layout (per Assumptions) is simple/deterministic but won't look as polished as a real graph
  layout library for large, densely-linked doc sets — acceptable per the spec's "no new dependency" assumption.
- Two sibling views toggled by a context key (rather than one view with an internal mode) is the only way to
  switch between a `TreeDataProvider` and a `WebviewViewProvider`; this means both views' icons show in the
  container's view list, distinguished only by the `when` clause hiding the inactive one.
