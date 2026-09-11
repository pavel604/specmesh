# Tasks: FR-001 Manage .specmesh.yml and Create New Docs from the Docs Tree (v1)

- [x] T1 — Export `buildSpecmeshYml` from [src/scaffold/scaffold.ts](../../src/scaffold/scaffold.ts) (no behavior change).
- [x] T2 — Create [src/scaffold/newDoc.ts](../../src/scaffold/newDoc.ts) with `openOrCreateConfig(folder)` (stat → open existing, or seed via `buildSpecmeshYml(false)`, write, open).
- [x] T3 — In `newDoc.ts`, add `addNewDoc(folder)`: resolve folder's doc types (repo config or defaults), filter out `fr-*` types, quick-pick a type, prompt for title, derive numbered/slug filename, confirm editable path, write minimal template, open file.
- [x] T4 — Extend [src/views/docsTreeProvider.ts](../../src/views/docsTreeProvider.ts): new `config` `TreeItemData` kind rendered first under each folder node (exists vs not-created states), `contextValue: "folder"` on folder items.
- [x] T5 — Register `specmesh.openOrCreateConfig` and `specmesh.addNewDoc` commands in [src/extension.ts](../../src/extension.ts), wired to the existing `refresh` callback.
- [x] T6 — Add `contributes.commands` entries and a `view/item/context` inline menu entry (icon `add`, `when: view == specmesh.docsExplorer && viewItem == folder`) in [package.json](../../package.json).
- [x] T7 — Update [README.md](../../README.md): Quick start + Tree appearance sections to mention the `.specmesh.yml` node and "Add new…" action.
- [x] T8 — Compile (`npm run compile`) and fix any errors.

## Fixes from walkthrough review

- [x] T9 — Exclude `mission` and `sdd` doc types from the "Add new…" quick-pick in [src/scaffold/newDoc.ts](../../src/scaffold/newDoc.ts) (mission is scaffold-only; SDD doc is out of scope for ad-hoc (re)creation).
- [x] T10 — Add a "Delete" context-menu action on tracked doc tree items: `contextValue: "doc"` in [src/views/docsTreeProvider.ts](../../src/views/docsTreeProvider.ts), a confirming `specmesh.deleteDoc` command in [src/extension.ts](../../src/extension.ts) that moves the file to the OS trash (`useTrash: true`), plus the `contributes.commands`/`view/item/context` entries in [package.json](../../package.json).
- [x] T11 — Compile (`npm run compile`) and fix any errors.

