# Implementation Plan: FR-013 Nested Doc Types in the Docs Explorer Tree (v1)

**Status**: Approved

## Approach

### Schema — `DocTypeDefinition.children`

`DocTypeDefinition` (a `track:` entry) gains an optional `children?: DocTypeDefinition[]`: full nested
definitions, same shape as a top-level entry. `DocNode` gains an optional `parentId?: string` — the `id` of
the matched parent `DocNode`, set at crawl time.

**Files:**

- [src/model/types.ts](../../src/model/types.ts) — add `children?: DocTypeDefinition[]` to
  `DocTypeDefinition` and `parentId?: string` to `DocNode`, each with a one-line comment.

### Doc-type tree helpers (pure, tested)

A new module holds the tree-walking logic so it's usable from both `crawler.ts` (matching) and
`repoConfig.ts` (validation) without depending on `vscode`:

- `flattenDocTypes(defs): DocTypeDefinition[]` — depth-first walk of a `track:` list including all nested
  `children`, used anywhere that currently assumes a flat array (file discovery, the "Add new doc" picker).
- `buildParentTypeMap(defs): Map<string, string>` — maps a child's `type` to its declared parent's `type`,
  walking the same tree.
- `findDuplicateTypes(defs): string[]` — flattens and returns any `type` value that appears more than once
  (first occurrence wins elsewhere; this just reports the duplicates so the caller can drop/report them).

**Files:**

- `src/crawler/docTypeTree.ts` (new) — the three functions above.
- `src/test/docTypeTree.test.ts` (new) — covers: flatten with no/one/two levels of nesting, parent-type map
  for a nested tree, and duplicate detection (top-level dup, nested dup, dup across levels, no dups).

### Built-in defaults nest the FR docs

`DEFAULT_DOC_TYPES` (used for workspace folders with no `.specmesh.yml`, and to seed newly-scaffolded ones)
moves `fr-plan`/`fr-tasks`/`fr-walkthrough` from top-level entries to `fr-spec`'s `children`, matching the
shape this FR is adding.

**Files:**

- [src/crawler/docTypes.ts](../../src/crawler/docTypes.ts) — restructure `DEFAULT_DOC_TYPES`; update
  `getBuiltinDefaultDocTypes()`'s copy to deep-clone nested `children` arrays too (today's `{ ...d }` shallow
  copy would let a caller's mutation of a nested array leak back into the module-level constant).

### Repo config: validate unique `type` across the whole tree

`loadRepoConfig` currently trusts `parsed.track` as-is. It now runs `findDuplicateTypes` against it; any
duplicate is dropped (the later occurrence removed from wherever it sits, top-level or nested) and reported,
the same pattern `parseRepoManifest` already uses for `repos:` entries.

**Files:**

- [src/crawler/repoConfig.ts](../../src/crawler/repoConfig.ts) — add a `trackErrors?: string[]` field to
  `RepoConfig`; validate/dedupe `parsed.track` using `findDuplicateTypes` before returning.
- [src/test/repoConfig.test.ts](../../src/test/repoConfig.test.ts) — add cases: a duplicate top-level type is
  dropped and reported; a duplicate between a top-level type and a nested `children` type is dropped and
  reported; no duplicates leaves `track`/`trackErrors` untouched.

### Crawler: discover nested types, match children to a specific parent instance

- The file-discovery loop currently does `for (const def of defs)`; switch to
  `for (const def of flattenDocTypes(defs))` so nested `children` entries are crawled exactly like top-level
  ones (same glob/exclude/label handling — no other change needed there).
- After all `nodes` are collected, run a new `attachParentIds(nodes, defs)` step: build the parent-type map
  via `buildParentTypeMap`, then for each node whose `type` has a mapped parent type, look for a sibling node
  with the same `workspaceFolderName`, the same containing directory, the same version token (digits matched
  by `/\.v(\d+)\.[^./]+$/` against the file name — both sides must have a token, or there's no match), and
  `type` equal to the mapped parent type. When found, set that node's `parentId` to the parent's `id`.
- Push `repoConfig.trackErrors` into `missingProblems` the same way `repoErrors` already are today (`docType:
  "config-error"`, `categoryLabel: "Config Issues"`) — the tree's existing generic "any problem `docType` not
  already in `categoryLabels` gets its own category" logic picks this up with no further UI changes.
- `CrawlResult` gains `childTypeOrder: Map<string, string[]>`, keyed `` `${folderName}::${parentType}` ``,
  recording each parent type's declared `children` order (per folder, since `track:` can differ per repo) —
  used later to sort a parent doc's nested children in the tree instead of relying on alphabetical luck.
- `categoryOrder` (the existing per-folder top-level order) is unaffected — it's still built from `defs`
  (top-level only), which is exactly what should still drive top-level category ordering.

**Files:**

- [src/crawler/crawler.ts](../../src/crawler/crawler.ts) — the changes above.

### Tree view: render matched children nested under their parent doc

- `DocsTreeProvider.update()` gains a `childTypeOrder: Map<string, string[]>` parameter, stored as a field.
- A folder's visible top-level categories are now only those with at least one *unmatched* doc (`!node.parentId`)
  or a missing/problem entry for that type — a category whose every instance matched a parent no longer shows
  as a top-level row (FR-3/FR-4). The `"category"` children listing filters docs the same way
  (`n.type === element.type && !n.parentId`).
- `getTreeItem` for a `"doc"` element: `CollapsibleState.Collapsed` when any node has `parentId === node.id`,
  else `None` (unchanged).
- `getChildren` gains a `"doc"` branch: returns the matching nodes (`n.parentId === element.node.id`) as
  `"doc"` items, sorted by `childTypeOrder`'s declared order (fallback: `type` then `title`).

**Files:**

- [src/views/docsTreeProvider.ts](../../src/views/docsTreeProvider.ts) — the changes above.
- [src/extension.ts](../../src/extension.ts) — thread `childTypeOrder` from `crawlWorkspace()`'s result
  through to `treeProvider.update(...)`.

### `newDoc.ts`: keep the "Add new doc" picker correct under nesting

`addNewDoc` filters `repoConfig.track ?? getDocTypeDefinitions()` directly, which would only see top-level
entries once nesting is used elsewhere. Flatten first so a nested-but-addable type still appears (FR-9);
`fr-plan`/`fr-tasks`/`fr-walkthrough` stay excluded exactly as today via `NON_ADDABLE_TYPES`.

**Files:**

- [src/scaffold/newDoc.ts](../../src/scaffold/newDoc.ts) — `flattenDocTypes(repoConfig.track ??
  getDocTypeDefinitions())` before the `NON_ADDABLE_TYPES` filter.

### Dogfooding and docs

- This repo's own `.specmesh.yml` moves `fr-plan`/`fr-tasks`/`fr-walkthrough` under `fr-spec`'s `children`,
  matching the new default shape.
- `README.md`'s `.specmesh.yml` schema example gets one `children:` line showing a nested entry, plus a short
  sentence explaining the matching rule (same directory + version number).

**Files:**

- [.specmesh.yml](../../.specmesh.yml) — restructure as described.
- [README.md](../../README.md) — extend the existing schema example.

## Sequencing

1. `types.ts` schema fields (no behavior change yet).
2. `docTypeTree.ts` + its tests (pure, independently verifiable).
3. `docTypes.ts` default restructure.
4. `repoConfig.ts` validation + tests.
5. `crawler.ts` matching/flattening/`childTypeOrder`.
6. `docsTreeProvider.ts` + `extension.ts` wiring.
7. `newDoc.ts` flatten fix.
8. Dogfood `.specmesh.yml` + `README.md` last, once the engine actually renders nesting, so it can be
   eyeballed in the Extension Development Host before committing to the new layout.

## Risks / Tradeoffs

- The directory+version matching rule is specific to the `FR-*/​{spec,plan,tasks,walkthrough}.vN.md`
  convention; a repo with a different nested-doc naming scheme gets no matches (falls back to today's flat
  rendering per FR-4/FR-5 — never a broken or hidden doc, just no nesting).
- `specmesh_update_track_entry` (MCP tool) still only edits top-level `track:` entries — editing a nested
  entry's `type` through that tool adds a top-level duplicate instead (caught and reported by the new
  `trackErrors` validation, not silently wrong). Documented as a known gap in the spec; not fixed by this FR.
- One level of nesting is what's exercised end-to-end (fr-spec → plan/tasks/walkthrough), though
  `flattenDocTypes`/`buildParentTypeMap`/matching are written generically over arbitrary depth.
