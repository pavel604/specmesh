# Walkthrough: FR-007 Documentation Pattern Packs (v1)

> **Descoped mid-implementation**: this revision ended up shipping only an internal refactor — see
> spec.v1.md's Revision Note and tasks.v1.md. The multi-pack picker, custom pack discovery, and
> `createPatternPack` command (previously listed here) were implemented and then reverted.

## Files Changed

- [src/scaffold/patterns.ts](../../src/scaffold/patterns.ts) — **new**. `PatternPack`/`PatternTemplateEntry`/
  `PatternEnsureDirEntry` types, `BUILTIN_PACK_DATA` (the `spec-driven-dev` pack's data, unchanged from today's
  behavior) + `getBuiltinPack()` (T1).
- [src/scaffold/scaffold.ts](../../src/scaffold/scaffold.ts) — `scaffoldSdlc` now reads the built-in pack via
  `getBuiltinPack(context.extensionUri)` and drives its template/dir write-out generically from
  `pack.templates`/`pack.ensureDirs`/`pack.rootDocTypes`/`pack.docTypes` instead of hardcoded values.
  `buildSpecmeshYml` now takes a pack instead of hardcoding root doc types. There is no pattern picker — only
  one pack exists (T4, T5).
- [src/scaffold/newDoc.ts](../../src/scaffold/newDoc.ts) — updated its `buildSpecmeshYml` call site to pass
  `BUILTIN_PACK_DATA` (the "Add new…" seed still always uses the built-in pack, matching today's behavior).
- [src/test/patterns.test.ts](../../src/test/patterns.test.ts) — **new**. Covers `BUILTIN_PACK_DATA`'s shape
  and `buildSpecmeshYml`'s root vs. non-root output (T7).
- [docs/epics/EPIC-002-custom-documentation-patterns.md](../epics/EPIC-002-custom-documentation-patterns.md) —
  added FR-007 to the Stories table, noted as descoped to a refactor (T9).

## Build/Test Results

- `npm run compile` (`tsc -p ./`) — clean, no errors.
- `npm test` — 18/18 passing.
- `package.json` — reverted back to its pre-FR-007 contributes (no `createPatternPack` command/menu entries).

## Follow-ups / Known Gaps

- **T6 not completed**: a manual end-to-end run of `specmesh: Scaffold Spec-Driven Development Structure`
  against a real (scratch) multi-root workspace wasn't performed in this session (no interactive VS Code
  Extension Development Host available here). The scaffold refactor preserves the same template files, `dest`
  paths, and token names as before, so output should be byte-identical, but this is worth one manual F5 check
  before merging/releasing.
- Custom pattern packs as a user-facing feature (pattern picker, `.specmesh/patterns/<name>/` discovery, a
  pack-authoring command) are explicitly deferred to a future FR — this revision only kept the internal
  `PatternPack` data shape as groundwork.

