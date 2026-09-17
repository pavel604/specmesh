# Implementation Plan: FR-008 Declarative Repo Manifest (v1)

**Status**: Approved

## Affected Files/Projects

- [src/model/types.ts](../../src/model/types.ts) — add `RepoManifestEntry` and `DeclaredRepo` interfaces.
- [src/crawler/repoConfig.ts](../../src/crawler/repoConfig.ts) — parse/validate `repos:`, extend `RepoConfig`.
- [src/crawler/crawler.ts](../../src/crawler/crawler.ts) — check each declared repo's on-disk presence, emit
  problems for invalid/missing entries, expose declared repos on `CrawlResult`.
- [src/tools/specmeshTools.ts](../../src/tools/specmeshTools.ts) — new `specmesh_list_repos` tool.
- [package.json](../../package.json) — `languageModelTools` contribution entry for the new tool.
- [src/test/repoConfig.test.ts](../../src/test/repoConfig.test.ts) — new test file for manifest parsing/validation.

## Approach

### Model (`src/model/types.ts`)

```ts
export interface RepoManifestEntry {
  name: string;
  remote: string;
  path: string; // relative to the folder containing the .specmesh.yml that declared it
}

export interface DeclaredRepo extends RepoManifestEntry {
  workspaceFolderName: string;
  present: boolean; // whether `path` currently exists on disk
}
```

### Config parsing (`src/crawler/repoConfig.ts`)

- Extend `RepoConfig` with `repos?: RepoManifestEntry[]` and `repoErrors?: string[]`.
- Add an exported pure function `parseRepoManifest(raw: unknown): { repos: RepoManifestEntry[]; errors: string[] }`:
  - No-ops (empty result) if `raw` isn't an array.
  - Per entry: `name`/`remote`/`path` must all be non-empty strings, and `path` must be relative
    (`!path.isAbsolute(p)`, using Node's `path` module) — otherwise the entry is dropped and a human-readable
    message pushed to `errors` (index + reason).
  - This mirrors the existing pattern of validating `track:` shape inline, just pulled into its own testable
    function since the validation rules are richer than `track:`'s.
- `loadRepoConfig` calls `parseRepoManifest(parsed.repos)` and folds the result into the returned `RepoConfig`,
  the same way it already handles `track:`.

### Crawler (`src/crawler/crawler.ts`)

- After loading `repoConfig` for a folder, in addition to existing `track:` handling:
  - For each `repoConfig.repoErrors` message, push a `Problem` (`kind: "missing"`, `docType: "repo-manifest"`,
    `categoryLabel: "Declared Repos"`, `workspaceFolderName: folder.name`, `absolutePath` pointing at that
    folder's `.specmesh.yml`, `message` = the error text). Reuses the existing "missing" Problem shape rather
    than introducing a new `Problem.kind`.
  - For each valid `repoConfig.repos` entry, resolve `path` against `folder.uri`, check existence with the
    existing `existsSafe()` helper, and record a `DeclaredRepo` (`present: true/false`). When `present` is
    `false`, also push a `Problem` (same `docType`/`categoryLabel` as above, `expectedPath: entry.path`,
    message: `Declared repo "<name>" not found at "<path>"`).
- Add `repos: DeclaredRepo[]` to `CrawlResult`, collected across all folders.
- No new tree-provider code needed: `docsTreeProvider.ts`'s existing category-rendering logic already handles a
  `docType` that only has `Problem` entries and zero `DocNode`s (this is exactly how a missing literal tracked
  file, e.g. a missing `docs/charter.md`, already renders today) — so "Declared Repos" appears as its own
  category with red "missing" rows for free.

### MCP tool (`src/tools/specmeshTools.ts` + `package.json`)

- New `ListReposTool` (same shape as the existing `FolderFilterInput`-based tools): calls `crawlWorkspace()`,
  filters `repos` by optional `folder`, and renders `name`, `path`, `present`/`NOT PRESENT`, and `remote` per line.
- Register as `specmesh_list_repos` in `registerSpecmeshTools`.
- Add the matching `languageModelTools` entry to `package.json` (`toolReferenceName: "specmeshRepos"`), modeled
  on the existing `specmesh_list_docs` entry.

## Sequencing

1. Model types.
2. `repoConfig.ts` parsing/validation + `repoConfig.test.ts`.
3. `crawler.ts` wiring (depends on step 2's new `RepoConfig` fields).
4. MCP tool + `package.json` contribution (depends on step 3's `CrawlResult.repos`).
5. Manual verification: add a `repos:` entry to this repo's own root `.specmesh.yml` (one present path, one
   deliberately missing path) and confirm the Docs Explorer tree, diagnostics, and `specmesh_list_repos` all
   reflect it correctly.

## Risks / Tradeoffs

- Reuses `Problem.kind: "missing"` with a synthetic `docType: "repo-manifest"` instead of adding a new `Problem`
  kind — keeps `diagnostics.ts`/`docsTreeProvider.ts` untouched, at the cost of "missing tracked doc" and
  "missing declared repo" sharing one kind. Acceptable since both already key off `docType`/`categoryLabel` for
  grouping, and this FR's scope is explicitly to reuse existing plumbing (per spec Assumptions).
- No YAML schema/IntelliSense for `repos:` — a malformed entry is only caught after save-triggered re-crawl, not
  while typing. Matches how `track:` already behaves.
- `remote` is only checked for non-emptiness, not URL format — deliberately out of scope; format-checking a git
  remote well enough to be useful is more machinery than this FR's read-only scope justifies.
