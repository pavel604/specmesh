# FR-003: Replace ORPHAN_CHECK_TYPES with root Metadata on DocTypeDefinition

**Revision**: 1
**Status**: Approved
**Repos**: specmesh
**Created**: 2026-09-14
**Epic**: [EPIC-002: Custom Documentation Patterns](../epics/EPIC-002-custom-documentation-patterns.md)

## User Story

As a specmesh user who declares custom doc types via `.specmesh.yml`'s `track:` list, I want orphan-checking to
work for my custom doc types without editing specmesh's source code, so that I can support documentation
patterns other than the built-in mission/epic/FR one.

## Overview

Today, `computeProblems` in [src/crawler/graph.ts](../../src/crawler/graph.ts) only orphan-checks doc types
hardcoded into a local `ORPHAN_CHECK_TYPES` allowlist (`adr`, `reference`, `fr-spec`) — any custom doc type a
user declares in `.specmesh.yml` is silently never orphan-checked, no matter how it's used. This FR moves that
rule into data: a new `root?: boolean` field on `DocTypeDefinition` marks a doc type as a legitimate root (never
flagged as an orphan), and every other doc type is orphan-checked by default.

## Functional Requirements

- **FR-1**: Add an optional `root?: boolean` field to `DocTypeDefinition`
  ([src/model/types.ts](../../src/model/types.ts)), documented with a JSDoc comment consistent with the
  existing `glob`/`exclude` fields.
- **FR-2**: `DocNode` gains a `root?: boolean` field, populated from the originating `DocTypeDefinition.root`
  at crawl time ([src/crawler/crawler.ts](../../src/crawler/crawler.ts)), the same way `type` and
  `categoryLabel` are already copied from the def onto the node.
- **FR-3**: `computeProblems` ([src/crawler/graph.ts](../../src/crawler/graph.ts)) orphan-checks every node
  unless `node.root === true`, entirely replacing the hardcoded `ORPHAN_CHECK_TYPES` set.
- **FR-4**: Preserve today's exact orphan-checking behavior for the built-in pattern by marking `root: true`
  on the doc types that are currently implicitly excluded: `fr-plan`, `fr-tasks`, `fr-walkthrough`,
  `instructions`, `skill` in `DEFAULT_DOC_TYPES` ([src/crawler/docTypes.ts](../../src/crawler/docTypes.ts)),
  and `mission`, `sdd`, `epic` in the root-only entries built by `buildSpecmeshYml`
  ([src/scaffold/scaffold.ts](../../src/scaffold/scaffold.ts)). `adr`, `reference`, `fr-spec` need no `root`
  flag (default = checked).
- **FR-5**: A repo's `.specmesh.yml` `track:` list can set `root: true` on any custom doc type entry, so
  custom/non-built-in doc types can opt out of orphan-checking the same way built-in ones do.

## Out of Scope

- A named/swappable "doc-type set" (a.k.a. pattern pack) concept — e.g. a "default" pattern vs. a named custom
  one a user can select or switch between. This FR only adds a per-entry `root` flag to individual
  `DocTypeDefinition` entries; it does not change how the overall set of tracked doc types is defined, named,
  or CRUD'd. That remains exactly as it is today: hand-editing the `.specmesh.yml` `track:` YAML list to
  add/remove/edit entries, with no naming or set-switching mechanism. Introducing named/swappable pattern packs
  is Vector 2 item 1 in [docs/roadmap.md](../roadmap.md) — a separate, larger future FR under this epic.
- `versioned?: boolean` metadata mentioned in [docs/roadmap.md](../roadmap.md) — no current consumer, deferred
  to a future FR if/when pattern-driven scaffolding needs it.
- Pattern-driven `scaffold.ts` and custom pack folders (the other two remaining parts of Vector 2) — separate
  future FRs under this same epic.
- Any Docs Explorer tree/UI changes — this FR only touches the crawl/orphan-detection data model.

## Assumptions

- Unset `root` (`undefined`) behaves identically to `root: false` — orphan-checked. This is the "everything
  except `root: true`" flip described in the roadmap.
- This is an intentional behavior change for any existing hand-written `.specmesh.yml` `track:` list that
  defines custom doc types without setting `root`: those types will newly become orphan-checkable where they
  previously never were. No migration tooling is added — the extension is young enough that this is
  acceptable, and the new behavior is the whole point of this FR.

## Open Questions

None.
