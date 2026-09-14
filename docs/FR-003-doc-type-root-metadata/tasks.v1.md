# Tasks: FR-003 Replace ORPHAN_CHECK_TYPES with root Metadata (v1)

- [x] T1 — Add `root?: boolean` to `DocTypeDefinition` and `DocNode` in [src/model/types.ts](../../src/model/types.ts)
- [x] T2 — Copy `def.root` onto each `DocNode` in [src/crawler/crawler.ts](../../src/crawler/crawler.ts)
- [x] T3 — Replace `ORPHAN_CHECK_TYPES` with `!node.root` check in [src/crawler/graph.ts](../../src/crawler/graph.ts)
- [x] T4 — Add `root: true` to `fr-plan`, `fr-tasks`, `fr-walkthrough`, `instructions`, `skill` in [src/crawler/docTypes.ts](../../src/crawler/docTypes.ts)
- [x] T5 — Add `root: true` to `mission`, `sdd`, `epic` entries in `buildSpecmeshYml` in [src/scaffold/scaffold.ts](../../src/scaffold/scaffold.ts)
- [x] T6 — Build and check for compile errors; fix any type errors from the new fields
