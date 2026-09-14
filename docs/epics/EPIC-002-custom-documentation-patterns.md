# EPIC-002: Custom Documentation Patterns

**Status**: Active
**Created**: 2026-09-14

## Outcome

specmesh's engine stops assuming one hardcoded documentation pattern (mission → epic → FR → ADR/reference).
Doc-type-specific rules move from code into data on `DocTypeDefinition`, and scaffold/config become
pattern-driven — so a repo can define or select a documentation pattern that isn't specmesh's own built-in
convention, without forking the extension.

## Stories

| FR | Title | Status |
| --- | --- | --- |
| [FR-003](../FR-003-doc-type-root-metadata/spec.v1.md) | Replace ORPHAN_CHECK_TYPES with root/versioned metadata | Done |

## Dependencies

- Builds on the existing `DocTypeDefinition` model ([src/model/types.ts](../../src/model/types.ts)) and
  `.specmesh.yml` `track:` override ([src/crawler/repoConfig.ts](../../src/crawler/repoConfig.ts)).
- See [docs/roadmap.md](../roadmap.md) "Vector 2" for the full multi-part plan this epic is drawn from.

## Changelog

- 2026-09-14: Epic created.
