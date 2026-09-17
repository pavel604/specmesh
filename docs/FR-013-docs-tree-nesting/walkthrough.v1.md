# Walkthrough: FR-013 Nested Doc Types in the Docs Explorer Tree (v1)

## Files Changed

- [src/model/types.ts](../../src/model/types.ts) — added `children?: DocTypeDefinition[]` to
  `DocTypeDefinition` and `parentId?: string` to `DocNode` (T1).
- [src/crawler/docTypeTree.ts](../../src/crawler/docTypeTree.ts) — new module: `flattenDocTypes`,
  `buildParentTypeMap`, `findDuplicateTypes`, `buildChildTypeOrder`, and `attachParentIds` (directory +
  version-token matching, e.g. `plan.v2.md` → `spec.v2.md` in the same FR folder) (T2, T7).
- [src/test/docTypeTree.test.ts](../../src/test/docTypeTree.test.ts) — new, covers all five functions
  above at 0/1/2 levels of nesting (T3).
- [src/crawler/docTypes.ts](../../src/crawler/docTypes.ts) — `DEFAULT_DOC_TYPES` now nests
  `fr-plan`/`fr-tasks`/`fr-walkthrough` under `fr-spec.children`; `getBuiltinDefaultDocTypes()` deep-clones
  nested `children` instead of a shallow copy (T4).
- [src/crawler/repoConfig.ts](../../src/crawler/repoConfig.ts) — `RepoConfig` gains `trackErrors?: string[]`;
  `loadRepoConfig` now drops later duplicate `type`s (top-level or nested) via the new exported
  `dropLaterDuplicates`, reporting each drop (T5).
- [src/test/repoConfig.test.ts](../../src/test/repoConfig.test.ts) — added `dropLaterDuplicates` cases: no
  duplicates, a top-level duplicate, and a duplicate between a top-level entry and a nested child (T6).
- [src/crawler/crawler.ts](../../src/crawler/crawler.ts) — file discovery now walks `flattenDocTypes(defs)`;
  after crawling a folder's docs, `attachParentIds` sets `parentId` on matched children; `trackErrors` surface
  as `missingProblems` (`docType: "config-error"`, label "Config Issues"); `CrawlResult` gains
  `childTypeOrder: Map<string, string[]>` (T7).
- [src/views/docsTreeProvider.ts](../../src/views/docsTreeProvider.ts) — `update()` takes a `childTypeOrder`
  parameter; a folder's top-level categories now only include *unmatched* doc instances (matched children no
  longer double-list); a parent doc item is `Collapsed` when other docs point at it via `parentId`, and its
  children render via a new `"doc"`-kind branch in `getChildren`, ordered by `childTypeOrder` (T8).
- [src/extension.ts](../../src/extension.ts) — threads `childTypeOrder` from `crawlWorkspace()` through to
  `treeProvider.update(...)` (T9).
- [src/scaffold/newDoc.ts](../../src/scaffold/newDoc.ts) — `addNewDoc`'s type picker now flattens the tree
  before filtering `NON_ADDABLE_TYPES`, so a nested-but-addable type would still be offered (T10).
- [.specmesh.yml](../../.specmesh.yml) — this repo's own config restructured to nest
  `fr-plan`/`fr-tasks`/`fr-walkthrough` under `fr-spec.children`, dogfooding the new default shape (T11).
- [README.md](../../README.md) — `.specmesh.yml` schema example extended with a `children:` entry and a note
  on the directory+version matching rule (T12).

## Build/Test Results

`npm test` — 65 passing, 0 failing, no compile errors.

## Follow-ups / Known Gaps

- `specmesh_update_track_entry` (MCP tool) still only edits top-level `track:` entries — updating a nested
  entry's `type` through that tool adds a top-level duplicate instead of editing the nested one (caught by the
  new `trackErrors` validation, not silently wrong, but not auto-fixed either). Documented as out of scope in
  the spec.
- Only one level of nesting is exercised end-to-end (fr-spec → plan/tasks/walkthrough); the helpers support
  arbitrary depth but that's untested beyond the unit tests in `docTypeTree.test.ts`.
