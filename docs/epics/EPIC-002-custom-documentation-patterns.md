# EPIC-002: Custom Documentation Patterns

**Status**: Active
**Created**: 2026-09-14

## Outcome

specmesh's engine stops assuming one hardcoded documentation pattern (charter → epic → FR → ADR/reference).
Doc-type-specific rules move from code into data on `DocTypeDefinition`, and scaffold/config become
pattern-driven — so a repo can define or select a documentation pattern that isn't specmesh's own built-in
convention, without forking the extension.

## Stories

| FR | Title | Status |
| --- | --- | --- |
| [FR-003](../FR-003-doc-type-root-metadata/spec.v1.md) | Replace ORPHAN_CHECK_TYPES with root/versioned metadata | Done |
| [FR-007](../FR-007-doc-pattern-packs/spec.v1.md) | Documentation Pattern Packs | Done (descoped to internal refactor — see spec's Revision Note) |

## Dependencies

- Builds on the existing `DocTypeDefinition` model ([src/model/types.ts](../../src/model/types.ts)) and
  `.specmesh.yml` `track:` override ([src/crawler/repoConfig.ts](../../src/crawler/repoConfig.ts)).
- See [docs/roadmap.md](../roadmap.md) "Vector 2" for the full multi-part plan this epic is drawn from.

## Changelog

- 2026-09-14: Epic created.
- FR-007 shipped only its internal `PatternPack` refactor of `scaffold.ts`; the user-facing custom-pack
  picker/discovery/authoring command were implemented then reverted as needing more design. Revisiting custom
  pattern packs as a user-facing feature is left for a future FR.

