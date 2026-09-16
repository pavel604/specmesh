# Tasks: FR-008 Declarative Repo Manifest (v1)

- [x] T1 — Add `RepoManifestEntry` and `DeclaredRepo` interfaces to `src/model/types.ts`.
- [x] T2 — Add `parseRepoManifest(raw): { repos, errors }` to `src/crawler/repoConfig.ts`, extend `RepoConfig`
      with `repos?`/`repoErrors?`, and wire it into `loadRepoConfig`.
- [x] T3 — Write `src/test/repoConfig.test.ts` covering `parseRepoManifest`: valid entries, missing
      name/remote/path, and rejected absolute paths.
- [x] T4 — In `src/crawler/crawler.ts`, push `Problem`s for `repoConfig.repoErrors` and for missing declared
      repos (`docType: "repo-manifest"`, `categoryLabel: "Declared Repos"`), and collect `DeclaredRepo[]` (with
      `present` computed via `existsSafe`) onto a new `CrawlResult.repos` field.
- [x] T5 — Add `ListReposTool` (`specmesh_list_repos`) to `src/tools/specmeshTools.ts` and register it in
      `registerSpecmeshTools`.
- [x] T6 — Add the `specmesh_list_repos` entry to `package.json`'s `languageModelTools` contribution.
- [x] T7 — Manually verify: add a `repos:` list to this repo's own root `.specmesh.yml` (one present path, one
      missing path), confirm the Docs Explorer tree shows a "Declared Repos" category with a red row for the
      missing one, and confirm `specmesh_list_repos` reports both correctly. Remove the test entries afterward.
