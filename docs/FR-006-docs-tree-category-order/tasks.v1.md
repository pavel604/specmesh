# Tasks: FR-006 Docs Tree Category Order (v1)

- [x] T1 — Add `categoryOrder: Map<string, string[]>` to `CrawlResult` in `crawler.ts`, populated per folder
      from the already-computed `defs` list.
- [x] T2 — Update `extension.ts`'s `crawlWorkspace()` call site(s) that feed the tree to pass `categoryOrder`
      through to `treeProvider.update(...)`.
- [x] T3 — Add the `categoryOrder` field + `update()` parameter to `DocsTreeProvider`.
- [x] T4 — Sort category rows in the `"folder"` branch of `getChildren` by the folder's `categoryOrder` index.
- [x] T5 — Manually verify: reorder `.specmesh.yml`'s `track:` list, refresh, confirm the tree follows; confirm
      a folder without `.specmesh.yml` still uses the existing default order.
