# Tasks: FR-013 Nested Doc Types in the Docs Explorer Tree (v1)

- [x] T1 — Add `children?: DocTypeDefinition[]` to `DocTypeDefinition` and `parentId?: string` to `DocNode`
      in [src/model/types.ts](../../src/model/types.ts).
- [x] T2 — Create `src/crawler/docTypeTree.ts` with `flattenDocTypes`, `buildParentTypeMap`,
      `findDuplicateTypes`.
- [x] T3 — Add `src/test/docTypeTree.test.ts` covering flatten/parent-map/duplicate-detection at 0/1/2 levels
      of nesting.
- [x] T4 — Restructure `DEFAULT_DOC_TYPES` in [src/crawler/docTypes.ts](../../src/crawler/docTypes.ts) to nest
      `fr-plan`/`fr-tasks`/`fr-walkthrough` under `fr-spec.children`; make `getBuiltinDefaultDocTypes()` deep-clone
      nested `children`.
- [x] T5 — Add `trackErrors?: string[]` to `RepoConfig` and validate/dedupe `parsed.track` with
      `findDuplicateTypes` in [src/crawler/repoConfig.ts](../../src/crawler/repoConfig.ts).
- [x] T6 — Extend [src/test/repoConfig.test.ts](../../src/test/repoConfig.test.ts) with duplicate-type cases
      (top-level dup, top-level/nested dup, no dups).
- [x] T7 — In [src/crawler/crawler.ts](../../src/crawler/crawler.ts): flatten `defs` for file discovery, add
      `attachParentIds` (directory + version-token matching), push `trackErrors` into `missingProblems` as
      `config-error`/"Config Issues", add `childTypeOrder` to `CrawlResult`.
- [x] T8 — Update [src/views/docsTreeProvider.ts](../../src/views/docsTreeProvider.ts): accept `childTypeOrder`
      in `update()`, hide matched children from top-level categories, make parent docs collapsible, add the
      `"doc"` children branch.
- [x] T9 — Thread `childTypeOrder` from `crawlWorkspace()` through to `treeProvider.update(...)` in
      [src/extension.ts](../../src/extension.ts).
- [x] T10 — Flatten doc types before the `NON_ADDABLE_TYPES` filter in
      [src/scaffold/newDoc.ts](../../src/scaffold/newDoc.ts).
- [x] T11 — Restructure [.specmesh.yml](../../.specmesh.yml) to nest `fr-plan`/`fr-tasks`/`fr-walkthrough`
      under `fr-spec.children`.
- [x] T12 — Update [README.md](../../README.md)'s `.specmesh.yml` schema example with a `children:` entry and
      a short note on the matching rule.
- [x] T13 — Run `npm test` and fix any build/lint errors.
