# Tasks: FR-016 Docs Dependency Graph View (v1)

- [x] T1 — Add `GraphNode`/`GraphEdge`/`GraphModel` types and `buildGraphModel(nodes: DocNode[]): GraphModel` in
      `src/views/graphModel.ts`: build resolved-link adjacency, compute connected components (union-find/BFS),
      classify stray nodes (zero resolved links in or out), assign deterministic (x, y) positions (circular
      arrangement per component, components tiled in a grid; strays tiled in a separate row).
- [x] T2 — Add `src/test/graphModel.test.ts` covering: two linked docs form one component with an edge; a doc
      with no resolved links in/out is stray; a doc with only a broken link is still stray; transitively linked
      docs (A→B→C) share one component; a root doc that links out (but nothing links back) is not stray.
- [x] T3 — Add `src/views/graphViewProvider.ts`: `GraphViewProvider implements vscode.WebviewViewProvider`,
      holds latest `DocNode[]`, `update(nodes)` rebuilds the model and re-renders; renders nodes/edges/strays as
      inline SVG (type→icon/color mapping consistent with `docsTreeProvider.ts`'s `iconForDoc`), node `<title>`
      tooltips (title + relative path), and a script handling node clicks via `vscode.postMessage`.
- [x] T4 — Wire `onDidReceiveMessage` in `GraphViewProvider` for an `openDoc` message to
      `vscode.window.showTextDocument(vscode.Uri.file(absolutePath))`.
- [x] T5 — Update `package.json`: add the `specmesh.docsGraph` webview view (name `Docs`) alongside
      `specmesh.docsExplorer` in the `specmesh` container, each gated by a `specmesh.viewMode` (`tree`/`graph`)
      `when` clause; add `specmesh.toggleGraphView` command (with icon) to `view/title` for both views.
- [x] T6 — In `src/extension.ts`: instantiate `GraphViewProvider`, register it with
      `vscode.window.registerWebviewViewProvider`, set the initial `specmesh.viewMode` context to `tree` on
      activation, register `specmesh.toggleGraphView` to flip the context key, and call
      `graphViewProvider.update(nodes)` inside `refresh()` alongside the existing `treeProvider.update(...)` call.
- [x] T7 — Run `npm test` and fix any build/test errors.
- [x] T8 — Rework `buildGraphModel`'s layout in `src/views/graphModel.ts` from a circular arrangement to a
      top-down hierarchical tree per connected component (BFS spanning tree from a chosen root, subtree-width
      based x placement so sibling branches never overlap); components tiled left-to-right in a single row
      (no more row-wrapping grid, since pan/zoom now handles overflow); update/extend
      `src/test/graphModel.test.ts` for the new layout if needed.
- [x] T9 — Add pan (click-drag) and zoom (mouse wheel + on-screen +/−/reset buttons) to
      `src/views/graphViewProvider.ts`: wrap the SVG content in a transformable group, fit the whole graph to
      the view on initial render, clamp zoom to a sane range, and ensure the container has no native
      scrollbars (`overflow: hidden`) since panning/zooming replaces them.
- [x] T10 — Replace the native SVG `<title>` tooltip in `graphViewProvider.ts` with a custom floating HTML
      tooltip: hidden (opacity 0) by default, fully opaque on hover, semi-transparent themed background/text,
      max-width, and clamped to 3 lines with ellipsis overflow.
- [x] T11 — Update `docs/FR-016-docs-dependency-graph-view/spec.v1.md`: move pan/zoom from Out of Scope to a
      new functional requirement, and update the layout Assumption from circular to hierarchical tree.
- [x] T12 — Run `npm test` again and fix any errors.
- [x] T13 — Extend `buildGraphModel` in `src/views/graphModel.ts` to also draw an edge for each `DocNode.parentId`
      structural nesting relationship (FR-spec → plan/tasks/walkthrough, etc.), tagged `kind: "nesting"` vs.
      `kind: "link"` for markdown-link edges; nesting edges count toward the linked/non-stray classification and
      participate in the same connected-component/tree-layout computation. Extend
      `src/test/graphModel.test.ts` to cover a `parentId`-only pair (no markdown link) forming an edge/component.
- [x] T14 — Render nesting edges with a visually distinct style (e.g. thinner/dashed) from markdown-link edges
      in `src/views/graphViewProvider.ts`.
- [x] T15 — Run `npm test` again and fix any errors.
- [x] T16 — Add an always-visible compact label under each node in `src/views/graphViewProvider.ts` (truncated
      filename via a `foreignObject`/CSS ellipsis, no background chrome) so titles are readable without
      hovering.
- [x] T17 — Restyle the hover tooltip into a chat-bubble anchored to the hovered node (positioned from the
      node's own screen rect, not the cursor; a small pointer tail pointing down at the node) showing the full
      untruncated title and relative path.
- [x] T18 — Run `npm test` again and fix any errors.
