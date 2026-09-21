# Walkthrough: FR-016 Docs Dependency Graph View (v1)

## Files Changed

- [src/views/graphModel.ts](../../src/views/graphModel.ts) — new: `buildGraphModel(nodes)` builds directed
  edges from resolved (existing) markdown links **and** from `DocNode.parentId` docType nesting relationships
  (e.g. an FR spec and its plan/tasks/walkthrough, which don't hyperlink each other but are structurally
  related), tagging each edge `kind: "link"` or `"nesting"`; connected components via BFS over an undirected
  adjacency view of both edge kinds; stray classification (no resolved link and no nesting relationship, in or
  out); a deterministic top-down tree layout per component (BFS spanning tree from the highest-out-degree node,
  subtree-width x placement so sibling branches never overlap, components tiled left-to-right); strays get
  their own grid row below.
- [src/test/graphModel.test.ts](../../src/test/graphModel.test.ts) — new: 6 unit tests for the model builder
  (linked pair forms an edge, unlinked doc is stray, broken-link-only doc is still stray, transitive A→B→C
  chain shares one component, a root doc that links out is not stray, a `parentId`-only pair forms a
  `"nesting"` edge and is not stray).
- [src/views/docIcon.ts](../../src/views/docIcon.ts) — new: extracted `iconForDoc`/added `docIconKind` (shared
  instructions/skill/doc classification) so the tree's icon and the graph's node color stay consistent.
- [src/views/docsTreeProvider.ts](../../src/views/docsTreeProvider.ts) — now imports `iconForDoc` from
  `docIcon.ts` instead of defining it locally; no behavior change.
- [src/views/graphViewProvider.ts](../../src/views/graphViewProvider.ts) — new: `GraphViewProvider` (a
  `WebviewViewProvider`) renders `buildGraphModel`'s output as inline SVG inside a pannable/zoomable viewport
  — nodes colored by instructions/skill/doc, dashed stroke + a divider/"Unlinked" label separating stray
  nodes, directed edges with arrowheads (nesting edges rendered thinner/dashed vs. solid markdown-link edges),
  mouse-wheel zoom + on-screen zoom in/out/reset controls + click-drag panning (fit-to-view on open, no native
  scrollbars), an always-visible truncated filename label under each node, a chat-bubble tooltip anchored to
  the hovered/focused node (pointer tail, full untruncated title + relative path, 3-line clamp on the title),
  and click/Enter-to-open wired through `postMessage` → `vscode.open`.
- [package.json](../../package.json) — added the `specmesh.docsGraph` webview view alongside
  `specmesh.docsExplorer` (both gated by a `specmesh.viewMode` context key, tree shown by default), the
  `specmesh.toggleGraphView` command (with a toggle icon) in `view/title` for both views.
- [src/extension.ts](../../src/extension.ts) — instantiates and registers `GraphViewProvider`, initializes
  `specmesh.viewMode` to `"tree"` on activation, registers `specmesh.toggleGraphView` to flip that context key,
  and calls `graphViewProvider.update(nodes)` inside `refresh()` alongside the existing tree update so both
  views share the same crawl/refresh cycle.

## Build/Test Results

`npm test` (tsc compile + full VS Code extension test suite): **90 passing**, 0 failing — includes the 6
`buildGraphModel` tests alongside all pre-existing suites.

## Follow-ups / Known Gaps

- The toggle's on/off icon is currently the same static codicon in both modes (no visual state change between
  "go to graph" and "go to tree") — cosmetic only, works functionally via the `specmesh.viewMode` context key.
- Per the approved spec, view-mode choice is not persisted across window reloads (always resets to Tree View).
- Cross-component edges can still visually cross each other in dense graphs (only sibling branches within the
  same tree are guaranteed non-overlapping) — acceptable per the spec's "no new dependency" constraint.
