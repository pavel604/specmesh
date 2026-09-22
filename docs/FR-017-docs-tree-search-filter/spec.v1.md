# FR-017: Docs Tree Search Filter

**Revision**: 1
**Status**: Superseded by [v2](./spec.v2.md)
**Repos**: specmesh
**Created**: 2026-09-22
**Epic**: [EPIC-001: Docs Explorer Authoring](../epics/EPIC-001-docs-explorer-authoring.md)

## User Story

As a specmesh user, I want a search bar at the top of the Docs Explorer tree, right above the summary status
row ("N docs · 0 missing · ..."), so that typing text into it narrows the tree to only the documents whose
title/filename contains that text.

## Overview

Adds a live-filtering search control to the Docs Explorer view. While a filter is active, the tree shows only
matching docs (and the folders/categories needed to reach them); the status row reflects that a filter is
narrowing the view.

## Functional Requirements

- **FR-1**: A search title-bar action (`$(search)` icon) on the Docs Explorer view opens an input box that
  filters the tree live as the user types — no need to press Enter.
- **FR-2**: While a filter is active, only doc entries whose title or filename contains the filter text
  (case-insensitive substring) remain visible. Folders, categories, the `.specmesh.yml` config entry, and
  Declared Repos/missing-file entries with no matching descendants are hidden.
- **FR-3**: A doc with nested children (e.g. an FR spec's plan/tasks/walkthrough) is shown, together with all
  of its children, if its own title/filename matches **or** any descendant's does — children are not
  individually re-filtered once their parent is shown this way.
- **FR-4**: The status row reflects the active filter (e.g. prefixing the existing summary with the filter
  text) so it's clear the tree is currently narrowed rather than empty of docs.
- **FR-5**: A second title-bar action, visible only while a filter is active, clears it and restores the full
  tree.
- **FR-6**: The active filter persists across background refreshes (file-watcher-triggered re-crawls) until
  the user clears it.
- **FR-7**: An empty/cleared filter shows the full, unfiltered tree exactly as today.

## Out of Scope

- Searching full markdown body content — matching is against doc title/filename only.
- Filtering the Docs Graph (webview) view.
- Persisting the filter across window reloads/sessions.

## Assumptions

- VS Code's `TreeView` API has no native persistent embedded input widget. The closest practical equivalent of
  an in-tree "search bar" is a title-bar search icon that opens a live-filtering input box (updates on every
  keystroke via `onDidChangeValue`), without introducing a webview-based rewrite of the tree.
- Matching is case-insensitive substring against the doc's `title` and its filename (the same two fields
  already shown per `specmesh.docLabelFormat`), not full file content.
- Filter state lives in memory only (not written to disk/settings); it resets on window reload same as other
  transient UI state (e.g. `expandedCategories`).

## Open Questions

- None.
