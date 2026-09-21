# FR-016: Docs Dependency Graph View

**Revision**: 1
**Status**: Approved
**Repos**: specmesh
**Created**: 2026-09-18
**Epic**: [EPIC-001: Docs Explorer Authoring](../epics/EPIC-001-docs-explorer-authoring.md)

## User Story

As a specmesh user, I want to see tracked docs rendered as a dependency graph (linked docs connected by their
markdown links, unlinked docs called out as stray outliers), toggleable alongside the current tree view, so I
can visually spot how docs relate to each other and which ones are isolated — instead of only being able to
infer link structure from the flat tree and the separate "orphans" list.

## Overview

Adds a "Graph View" to the Docs Explorer that renders tracked docs as nodes connected by their resolved
markdown links, with a title-bar toggle to switch back and forth between it and the existing tree view. Docs
with no resolved links in or out render as visually separated stray/outlier nodes instead of being mixed into
the connected graph.

## Functional Requirements

- **FR-1**: The Docs Explorer view title area gains a toggle action that switches the view between "Tree View"
  (today's behavior, default) and "Graph View".
- **FR-2**: In Graph View, every tracked doc renders as a node; an edge is drawn between two nodes for every
  resolved (non-broken) markdown link between them, and for every docType parent/child nesting relationship
  (e.g. an FR spec and its plan/tasks/walkthrough, which the tree already nests together even without a
  hyperlink between them) — visually distinguished from a markdown-link edge.
- **FR-3**: Docs with no resolved link and no docType nesting relationship, in or out, render as stray/outlier
  nodes, visually separated from the connected graph area.
- **FR-4**: Docs that are linked (directly or transitively) render grouped by connected component, so unrelated
  clusters of docs are visually distinguishable from each other.
- **FR-5**: Clicking a node in Graph View opens that doc in the editor, matching today's tree click-to-open
  behavior.
- **FR-6**: Every node shows its filename as an always-visible, truncated label so titles are readable without
  hovering; hovering or focusing a node shows the doc's full title and relative path in a chat-bubble tooltip
  anchored to that node.
- **FR-7**: Graph View reflects the same live crawl data as the tree and updates on the same refresh cycle
  (file watcher, config changes, manual refresh).
- **FR-8**: Nodes are visually differentiated by doc type/category (color or icon), consistent with the type
  distinctions already shown in the tree (e.g. instructions/skill vs. plain docs).
- **FR-9**: Graph View supports zooming (mouse wheel or on-screen zoom controls) and panning (click-drag) so
  the full graph can be explored regardless of viewport size, fitting the whole graph to the view on open.

## Out of Scope

- Manual drag-to-reposition of individual nodes or saving a custom layout.
- Minimap or graph search/filtering.
- Exporting the graph (image/SVG/etc.).
- "Missing tracked file" problems are not graph nodes (no file exists to open) — same as today's tree, which
  already renders those separately.

## Assumptions

- Implemented as a second view (webview-based) in the same `specmesh` view container as the existing
  `specmesh.docsExplorer` tree, shown/hidden via a context key toggled by the title-bar action — a single VS
  Code view can't switch between a `TreeDataProvider` and a `WebviewViewProvider` dynamically.
- Layout uses a simple, deterministic algorithm — each connected component is drawn as a top-down hierarchical
  tree (rooted at its most-linked-from node, laid out so sibling branches never overlap) and components are
  tiled left-to-right — rendered as inline SVG in the webview, no new third-party graph-visualization
  dependency.
- "Stray/unlinked" is defined structurally (no resolved markdown link and no docType nesting relationship, in
  or out), independent of whether the doc's type is marked `root` — e.g. a root doc (like the charter) that
  links out to epics is not stray, but a non-root doc with neither kind of relationship is.
- The toggle defaults to Tree View on every extension activation; the chosen mode is not persisted across
  window reloads.
- No crawler/model changes are needed — `DocNode.links[].resolvedAbsolutePath` plus each node's `id`/
  `absolutePath`/`title` are sufficient to build the graph client-side from data the tree already receives.

## Open Questions

None — reasonable defaults recorded above cover the ambiguous points.
