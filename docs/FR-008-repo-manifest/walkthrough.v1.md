# Walkthrough: FR-008 Declarative Repo Manifest (v1)

## Files Changed

- [src/model/types.ts](../../src/model/types.ts) — added `RepoManifestEntry` and `DeclaredRepo`.
- [src/crawler/repoConfig.ts](../../src/crawler/repoConfig.ts) — added `parseRepoManifest` (validates
  name/remote/path, rejects absolute paths) and wired `repos`/`repoErrors` into `RepoConfig`/`loadRepoConfig`.
- [src/test/repoConfig.test.ts](../../src/test/repoConfig.test.ts) — new tests for `parseRepoManifest`.
- [src/crawler/crawler.ts](../../src/crawler/crawler.ts) — for each folder, turns `repoErrors` into `Problem`s,
  checks each declared repo's `path` on disk (`existsSafe`), records a `Problem` for missing ones, and returns
  all declared repos on the new `CrawlResult.repos` field.
- [src/tools/specmeshTools.ts](../../src/tools/specmeshTools.ts) — new `ListReposTool`, registered as
  `specmesh_list_repos`.
- [package.json](../../package.json) — `languageModelTools` contribution entry for `specmesh_list_repos`.
- [.specmesh.yml](../../.specmesh.yml) — temporary `repos:` test entries added for manual verification (one
  present path `./docs`, one missing path `./web`) — to be removed once verified.

## Build/Test Results

- `npm test`: 23 passing, including the 4 new `parseRepoManifest` tests.
- `tsc --noEmit`: no errors.

## Follow-ups / Known Gaps

- Manually verified in the Extension Development Host: "Declared Repos" category rendered correctly with a red
  row for the missing path, and `specmesh_list_repos` reported both entries correctly. Temporary `repos:` test
  entries have been removed from `.specmesh.yml`.
- None outstanding.
