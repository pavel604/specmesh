# Implementation Plan: FR-003 Replace ORPHAN_CHECK_TYPES with root Metadata (v1)

**Status**: Approved

## Affected Files/Projects

- [src/model/types.ts](../../src/model/types.ts) — add `root?: boolean` to `DocTypeDefinition`; add
  `root?: boolean` to `DocNode`.
- [src/crawler/crawler.ts](../../src/crawler/crawler.ts) — copy `def.root` onto each `DocNode` at crawl time.
- [src/crawler/graph.ts](../../src/crawler/graph.ts) — remove `ORPHAN_CHECK_TYPES`; `computeProblems` checks
  `!node.root` instead.
- [src/crawler/docTypes.ts](../../src/crawler/docTypes.ts) — add `root: true` to `fr-plan`, `fr-tasks`,
  `fr-walkthrough`, `instructions`, `skill` in `DEFAULT_DOC_TYPES`.
- [src/scaffold/scaffold.ts](../../src/scaffold/scaffold.ts) — add `root: true` to the `mission`, `sdd`,
  `epic` entries built in `buildSpecmeshYml`.
- `README.md` (if it documents `DocTypeDefinition`/`.specmesh.yml` schema) — check and update if it lists
  fields.

## Approach

### Data model

Add `root?: boolean` to `DocTypeDefinition` with a JSDoc comment matching the style of `exclude`:
"when true, docs of this type are never flagged as orphans (e.g. mission/epic/instructions/skill docs that
are legitimate roots, not expected to be linked from elsewhere)." Add the same field to `DocNode`, documented
as "copied from the originating `DocTypeDefinition.root` at crawl time."

### Crawl (crawler.ts)

In the loop that builds each `DocNode` (where `type: def.type` and `categoryLabel: def.label` are already
set), add `root: def.root` alongside them. No other crawler logic changes.

### Orphan detection (graph.ts)

Delete the `ORPHAN_CHECK_TYPES` constant and its import-time comment. In `computeProblems`, change the orphan
loop condition from `ORPHAN_CHECK_TYPES.has(node.type) && !linkedAbsolutePaths.has(node.absolutePath)` to
`!node.root && !linkedAbsolutePaths.has(node.absolutePath)`.

### Built-in data (docTypes.ts, scaffold.ts)

Add `root: true` to the five `DEFAULT_DOC_TYPES` entries (`fr-plan`, `fr-tasks`, `fr-walkthrough`,
`instructions`, `skill`) and the three root-only entries in `buildSpecmeshYml` (`mission`, `sdd`, `epic`).
`adr`, `reference`, `fr-spec` are left unchanged (no `root` field — defaults to checked). This exactly
preserves today's orphan-checking behavior for the built-in pattern.

## Sequencing

1. Model changes (`types.ts`) first — everything else depends on the new fields existing.
2. Crawler change (copy `root` onto `DocNode`).
3. Graph change (use `node.root` instead of `ORPHAN_CHECK_TYPES`).
4. Built-in data updates (`docTypes.ts`, `scaffold.ts`) to preserve current behavior — do this before/alongside
   step 3 so there's no window where behavior visibly regresses.
5. Build and manually sanity-check: run the extension, confirm the Problems/tree view still shows the same
   orphan warnings as before for this repo's own docs (e.g. `docs/adr/*`, `docs/reference/*` still flagged if
   unlinked; `docs/FR-*/plan.v1.md` etc. still not flagged).

## Risks / Tradeoffs

- Behavior change for any existing `.specmesh.yml` with a custom `track:` list that doesn't set `root` on its
  own entries: those custom types become orphan-checkable where they previously never were. This is the
  intended effect of the FR (see spec's Assumptions) and no repos are known to depend on the old silent
  behavior yet.
- No automated tests currently exist for `computeProblems`/orphan detection in this codebase (checked: no
  `test/`/`*.test.ts` files found) — verification here is manual (build + visual check), consistent with the
  rest of the codebase's current practice.
