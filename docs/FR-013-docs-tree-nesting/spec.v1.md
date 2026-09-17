# FR-013: Nested Doc Types in the Docs Explorer Tree

**Revision**: 1
**Status**: Approved
**Repos**: specmesh
**Created**: 2026-09-17
**Epics**: [EPIC-001: Docs Explorer Authoring](../epics/EPIC-001-docs-explorer-authoring.md), [EPIC-002: Custom Documentation Patterns](../epics/EPIC-002-custom-documentation-patterns.md)

## User Story

As a specmesh user with a growing number of FR folders, I want related FR docs (spec, plan, tasks,
walkthrough) to nest under their spec in the Docs Explorer tree, instead of being spread across four
same-level "FR Plans" / "FR Tasks" / "FR Walkthroughs" categories that I have to scroll through separately to
find the doc that goes with a given FR.

## Overview

Adds an optional `children` attribute to a `.specmesh.yml` `track:` entry, letting one `DocTypeDefinition`
declare nested child `DocTypeDefinition`s. A child doc instance (e.g. `plan.v2.md`) is matched to the specific
parent instance it belongs to (`spec.v2.md`, in the same FR folder) and rendered as its child in the Docs
Explorer tree, turning the flat category list into a shallow graph for FR docs specifically.

## Functional Requirements

- **FR-1**: `DocTypeDefinition` (`src/model/types.ts`) gains an optional `children?: DocTypeDefinition[]`
  field: a list of full nested doc type definitions (same shape as a top-level entry), not string references.
- **FR-2**: A child doc instance is matched to one specific parent doc instance by grouping docs that share
  the same workspace folder, the same containing directory, and the same version token parsed from the
  filename (e.g. `spec.v2.md` and `plan.v2.md` both yield version `2`). A child with no version token, or no
  sibling of the parent type sharing its directory+version, has no match.
- **FR-3**: In the Docs Explorer tree, a matched child doc renders nested under its parent doc item (which
  becomes expandable) instead of under its own top-level category row.
- **FR-4**: An unmatched child doc instance (no parent match found) still renders under its own top-level
  category, exactly as it does today — nesting never hides a doc.
- **FR-5**: A repo whose `.specmesh.yml` `track:` (or the global default doc types, for a repo without its own
  config) declares no `children` on any entry renders identically to today — this is purely additive.
- **FR-6**: `repoConfig.ts` validates `type` uniqueness across the whole declared tree (top-level entries plus
  all nested `children`, recursively) when loading a repo's `.specmesh.yml`, the same way `repos:` entries are
  validated today (drop the invalid duplicate, collect a human-readable error for the tree's "Declared Repos"
  problem list).
- **FR-7**: The specmesh built-in default doc types (`docTypes.ts`'s `DEFAULT_DOC_TYPES`, used both for
  workspace folders without their own `.specmesh.yml` and to seed newly-scaffolded ones) nest `fr-plan`,
  `fr-tasks`, and `fr-walkthrough` under `fr-spec`'s `children`.
- **FR-8**: This repo's own `.specmesh.yml` is updated to the nested shape (dogfooding FR-7's new default
  layout) instead of its current flat `fr-plan`/`fr-tasks`/`fr-walkthrough` top-level entries.
- **FR-9**: `newDoc.ts`'s "Add new doc" picker still lists nested-but-otherwise-addable doc types (i.e. it
  flattens the tree rather than only looking at top-level entries), so nesting a type never silently removes
  it from that picker.

## Out of Scope

- A child type belonging to more than one parent (the `children` shape ties a nested definition to exactly
  one parent).
- `specmesh_update_track_entry` (the MCP tool) gaining the ability to add/update an entry nested under a
  parent's `children` — it continues to only manage top-level entries; updating a nested entry's `type` via
  that tool will add a duplicate top-level entry instead of editing the nested one. Documented as a known gap.
- Nesting driven by anything other than the directory+version-token convention (e.g. markdown-link-based
  parent/child inference) — out of scope for this FR.
- Numeric-aware sorting of FR folders/specs (FR-2 vs FR-10) — a pre-existing, unrelated sort concern.

## Assumptions

- The version token is the digits captured by a `\.v(\d+)\.` pattern against the filename; docs that don't
  follow this convention simply never match as parent or child (falls back to FR-4's unmatched behavior).
- "Missing tracked file" problems are unaffected in practice: `fr-plan`/`fr-tasks`/`fr-walkthrough`/`fr-spec`
  globs all contain wildcards, so they're never flagged as `"missing"` under the existing `isLiteralGlob`
  check either before or after this change.
- Only doc types that are themselves rendered as tree items (`DocNode`s) participate in nesting; the
  `repo-manifest` synthetic category is unaffected.

## Open Questions

- None.
