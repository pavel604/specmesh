# FR-015: Docs Tree Category Recency Sort & Pagination

**Revision**: 1
**Status**: Approved
**Repos**: specmesh
**Created**: 2026-09-18
**Epic**: [EPIC-001: Docs Explorer Authoring](../epics/EPIC-001-docs-explorer-authoring.md)

## User Story

As a developer using the Docs Explorer, I want a category's docs (FR Specs, ADRs, etc.) sorted newest-first
and capped to a short visible list, so I'm not stuck scrolling past every doc since the first-ever feature just
to see recent work — with an easy way to see the rest when I actually need to.

## Overview

Category doc lists currently sort alphabetically by title and show every match, with no limit. This feature
sorts each category's top-level docs newest-first (by `Created`/`Date` front-matter, falling back to reverse
title order for undated types) and caps the visible list at 10, adding a "Show N more…" row that reveals the
rest on demand.

## Functional Requirements

- **FR-1**: A category's top-level docs (e.g. FR Specs, ADRs) render newest-first, using the parsed
  `Created`/`Date` front-matter field when present.
- **FR-2**: Docs with no parseable `Created`/`Date` (e.g. Instructions, Skills) fall back to reverse title
  order, which still resolves to newest-first for sequentially-numbered types like ADR-* that don't declare
  either field.
- **FR-3**: A category shows at most 10 docs by default. If more exist, a trailing "Show N more…" row appears
  in place of the rest.
- **FR-4**: Clicking "Show N more…" reveals the category's full doc list; once expanded, that category stays
  expanded across tree refreshes (until the extension reloads).
- **FR-5**: The sort/cap applies only to a category's top-level docs. Nested child docs (e.g. an FR's plan/
  tasks/walkthrough rendered under its spec) keep their existing declared child order, and the "Declared Repos"
  category is unaffected.

## Out of Scope

- Making the cap (10) user-configurable.
- A way to re-collapse a category after expanding it (short of reloading the extension).
- Reusing this recency logic for anything outside the Docs Explorer tree.

## Assumptions

- `Created` (used by FR/epic docs) and `Date` (used by ADR docs) are the only two front-matter keys worth
  checking for a creation date; other doc types (Instructions, Skills, Reference) don't declare either and are
  expected to fall back to the reverse-title ordering.

## Open Questions

- None.
