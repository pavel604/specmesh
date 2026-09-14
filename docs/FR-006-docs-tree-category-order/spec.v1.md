# FR-006: Docs Tree Category Order

**Revision**: 1
**Status**: Approved
**Repos**: specmesh
**Created**: 2026-09-14
**Epic**: [EPIC-001: Docs Explorer Authoring](../epics/EPIC-001-docs-explorer-authoring.md)

## User Story

As a developer using the Docs Explorer, I want category rows (Mission, Epics, FR Specs, ADRs, etc.) to appear
in a predictable, controllable order, so I don't have to hunt for Mission/Epics buried below less important
categories.

## Overview

Category row order inside a workspace-folder is currently seeded from the hardcoded built-in doc-type list
(`DEFAULT_DOC_TYPES` in [docTypes.ts](../../src/crawler/docTypes.ts)), then anything else (e.g. `mission`,
`epic`) is appended in whatever order the crawler happens to encounter it in — ignoring the order those types
are already listed in the repo's own `.specmesh.yml` `track:` list. This feature makes the tree honor that
existing list order instead, with no new config keys.

## Functional Requirements

- **FR-1**: Category rows under a workspace-folder render in the same order their `type:` entries appear in
  that folder's `.specmesh.yml` `track:` list.
- **FR-2**: A workspace folder with no `.specmesh.yml` (or one with an empty/missing `track:` list) keeps
  today's fallback order — the built-in `DEFAULT_DOC_TYPES` order (or the `specmesh.docTypes` VS Code setting's
  order, when configured) — unchanged.
- **FR-3**: No new `.specmesh.yml` schema keys are introduced. Reordering categories is just reordering the
  `track:` list entries in the file.
- **FR-4**: The tree picks up a reordered `track:` list the same way it already picks up any other
  `.specmesh.yml` edit (existing refresh mechanism) — no new refresh trigger needed.

## Out of Scope

- Any new `order:`/`categoryOrder:` config key (considered and dropped this session in favor of honoring
  existing list order).
- Reordering the top-level workspace-folder rows themselves — those stay alphabetical.
- Reordering individual doc rows within a category — those stay sorted by title.

## Assumptions

- If a repo's crawl ever produces a category that isn't present in that repo's own `track:` list (not expected
  in normal use, since `track:` replaces rather than merges with the defaults), it renders after all
  explicitly-ordered categories rather than being hidden.

## Open Questions

- None.
