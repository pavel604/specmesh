# FR-007: Documentation Pattern Packs

**Revision**: 1
**Status**: Approved (descoped — see Revision Note)
**Repos**: specmesh
**Created**: 2026-09-14
**Epic**: [EPIC-002: Custom Documentation Patterns](../epics/EPIC-002-custom-documentation-patterns.md)

## Revision Note (post-implementation descope)

While implementing FR-2/FR-3/FR-6 (multi-pack picker, custom pack discovery from
`.specmesh/patterns/<name>/`, and the `specmesh: Create Custom Documentation Pattern Pack…` command), the
author decided this user-facing surface needed more careful design than fit in this FR and pulled it back out.
**What actually shipped**: an internal refactor of `src/scaffold/scaffold.ts` so its doc-type/template/dir
write-out logic is driven by a `PatternPack` data structure (FR-1, FR-4, FR-5 below) instead of hardcoded
values — but there is still only ever one pack (the built-in `spec-driven-dev` one), no pattern picker, no
custom pack discovery, and no pack-authoring command. FR-2/FR-3/FR-6 are moved to Out of Scope. Revisiting
custom pattern packs as a user-facing feature is left for a future FR.

## User Story

As a pod/project adopting specmesh whose team doesn't use the built-in mission → epic → FR convention (e.g. it
prefers Google-style PRD/Design-Doc/RFC docs, or its own variant), I want to scaffold and track a documentation
pattern of my own choosing instead of specmesh's built-in one, so my team can align spec-driven development to
its existing conventions without forking the extension.

## Overview

Promote "documentation pattern" from an implicit, hardcoded convention (doc types baked into
[src/crawler/docTypes.ts](../../src/crawler/docTypes.ts) + one hardcoded `templates/` set consumed by
[src/scaffold/scaffold.ts](../../src/scaffold/scaffold.ts)) into a first-class **pattern pack** data shape:
`{doc types, scaffold templates, skill files}`. This revision ships that data shape and refactors
`scaffoldSdlc` to read it, but keeps the built-in `spec-driven-dev` pack as the only pack — see Revision Note.

## Functional Requirements

- **FR-1**: Define a pattern pack as `{id, name, description, docTypes, rootDocTypes, templates, ensureDirs,
  readTemplate}`. Ship the existing mission/epic/FR convention, unchanged in content, as the one built-in pack
  with id `spec-driven-dev`, name "Specmesh Default", and description "Mission → epic → FR/ADR/reference
  spec-driven development, with Copilot skills for drafting and implementing features."
- ~~FR-2~~ (descoped — see Revision Note): a pattern picker shown when more than one pack is available.
- ~~FR-3~~ (descoped — see Revision Note): discovering custom pattern packs from
  `.specmesh/patterns/<name>/`.
- **FR-4**: A pack manifest's doc types reuse the existing `DocTypeDefinition` shape (`type`, `label`, `glob`,
  `exclude`, `root`) unchanged, so generated `.specmesh.yml` files continue to work exactly as they do today.
- **FR-5**: Scaffold's existing "never overwrite an existing file" behavior is preserved.
- ~~FR-6~~ (descoped — see Revision Note): a `specmesh: Create Custom Documentation Pattern Pack…` command.

## Out of Scope

- A pattern picker UI (former FR-2), custom pack discovery from `.specmesh/patterns/<name>/` (former FR-3), and
  a pack-authoring command (former FR-6) — descoped mid-implementation; needs its own future FR with more
  design/planning (manifest schema stability, validation, migration, discovery caching, etc).
- Any additional built-in packs beyond `spec-driven-dev` (e.g. Google-style PRD/Design-Doc/RFC).
- Harness-neutral skill rendering or multi-harness output ("Vector 1" in [docs/roadmap.md](../roadmap.md)) —
  the pack still renders Copilot-specific files (`.github/copilot-instructions.md`, `.github/skills/...`).
- Migrating an already-scaffolded repo from one pattern to another.
- Any Docs Explorer tree/UI changes.
- `versioned?: boolean` metadata mentioned in the roadmap — still deferred, no current consumer.

## Assumptions

- Only one pack (`spec-driven-dev`) exists; `PatternPack` is kept as the data shape scaffold reads from so a
  future FR can reintroduce multiple packs without another rewrite of `scaffold.ts`.

## Open Questions

None.

