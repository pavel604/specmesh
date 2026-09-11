# Implementation Plan: FR-001 Manage .specmesh.yml and Create New Docs from the Docs Tree (v1)

**Status**: Approved

## Affected Files/Projects

- [src/scaffold/scaffold.ts](../../src/scaffold/scaffold.ts) — export the existing `buildSpecmeshYml` so it can
  be reused to seed a single newly-created `.specmesh.yml` (non-root shape), without duplicating its content.
- [src/scaffold/newDoc.ts](../../src/scaffold/newDoc.ts) *(new)* — the "Add new…" quick-pick flow and the
  open-or-create logic for a folder's `.specmesh.yml`.
- [src/views/docsTreeProvider.ts](../../src/views/docsTreeProvider.ts) — add a pinned `config` tree-item kind
  under each workspace-folder node; set a `contextValue` on the folder node for the inline menu.
- [src/extension.ts](../../src/extension.ts) — register the two new commands and wire tree refresh after each.
- [package.json](../../package.json) — new `contributes.commands` entries + a `view/item/context` inline menu
  entry scoped to the Docs tree's folder items.
- [README.md](../../README.md) — document the new tree affordances (Quick start, Tree appearance sections).

## Approach

### Tree (`docsTreeProvider.ts`)

- Add a new `TreeItemData` variant: `{ kind: "config"; folderName: string; exists: boolean }`.
- In `getChildren` for a `folder` element, prepend one `config` item (computed via
  `vscode.workspace.fs.stat` on `<folder>/.specmesh.yml`) before the existing category list, so it always
  renders first and is visually distinct from doc-type categories.
- In `getTreeItem`: label `.specmesh.yml`; icon `gear` (existing) vs a dimmed `gear` + description `"not
  created"` (missing); `resourceUri` set when it exists (git decorations, consistent with doc nodes); `command`
  is always `specmesh.openOrCreateConfig` with the folder name as argument — the command itself checks
  existence at invocation time (avoids relying on possibly-stale tree state).
- Set `contextValue: "folder"` on the existing `folder` TreeItem so `package.json` can target it with a menu
  `when` clause without affecting `category`/`doc`/`missing` items.

### Commands (`newDoc.ts`, `extension.ts`)

- `specmesh.openOrCreateConfig(folderName: string)`:
  - Resolve the `vscode.WorkspaceFolder` by name, `stat` `.specmesh.yml`.
  - If it exists, `vscode.window.showTextDocument` it.
  - If not, write it using `buildSpecmeshYml(false)` (the existing non-root seed — same content
    `scaffoldSdlc` already writes for a non-root repo), open it, then trigger the tree refresh callback
    already passed around in `extension.ts`.
- `specmesh.addNewDoc(folderName: string)`:
  - Resolve the folder, load its resolved doc types the same way the crawler does: `loadRepoConfig(folder).track
    ?? getDocTypeDefinitions()`.
  - Filter out `fr-spec`/`fr-plan`/`fr-tasks`/`fr-walkthrough` (FR-7). No extra filtering is needed for
    "Epic only on the root folder" (FR-5) — a non-root folder's resolved list never contains an `epic` entry
    in the first place, since `mission`/`epic` are opt-in per-repo already (see `docTypes.ts`).
  - `showQuickPick` the remaining types by label.
  - `showInputBox` for a **Title** (used for the `# <Title>` heading and to derive a filename slug —
    lowercase, non-alphanumeric runs collapsed to `-`).
  - Derive the file's numeric prefix when the chosen type's glob has a wildcard immediately preceded by `-`
    (e.g. `ADR-*.md`, `EPIC-*.md`): `findFiles` that glob in the folder, extract the longest digit run from
    each matched basename, take `max + 1` zero-padded to 3 digits; default to `001` if none match. Globs whose
    wildcard isn't `-`-prefixed (e.g. `docs/reference/*.md`) skip numbering and just use the slug.
  - Show the computed relative path in a second, **pre-filled and editable** `showInputBox` ("Confirm file
    path") before writing — keeps the numbering heuristic safe even if it ever guesses wrong for an unusual
    custom glob, without adding a separate rename/undo flow.
  - Write the file with a minimal template (`# <Title>\n\n**Status**: Draft\n`), open it, then call the shared
    refresh callback.

### Data

No changes to `DocNode`/`Problem`/`DocTypeDefinition` in [src/model/types.ts](../../src/model/types.ts) — this
feature only adds new tree-item kinds and commands, it doesn't change what the crawler produces.

## Sequencing

1. Export `buildSpecmeshYml` from `scaffold.ts` (no behavior change).
2. Add `newDoc.ts` with the open-or-create-config and add-new-doc logic.
3. Extend `docsTreeProvider.ts` with the `config` item kind + `folder` `contextValue`.
4. Register the two commands in `extension.ts`, reusing the existing `refresh` closure.
5. Add `package.json` commands + the inline `view/item/context` menu entry.
6. Update `README.md`.
7. Compile (`npm run compile`) and fix any errors.

## Risks / Tradeoffs

- The "numbered if wildcard is `-`-prefixed" heuristic is a convention match for today's built-in types
  (ADR/EPIC/FR) and this repo's own custom types — it may guess wrong for an unusual third-party `.specmesh.yml`
  glob. Mitigated by always showing the computed path in an editable confirmation box before writing, rather
  than writing silently.
- A newly-created `.specmesh.yml` always uses the non-root (`getBuiltinDefaultDocTypes()`) seed, never the
  root/mission+epic variant — matches the spec's Assumption; a user wanting the root shape still uses the full
  `specmesh: Scaffold Spec-Driven Development Structure` command.
- Inline icon uses a built-in codicon (`add`); no new media assets needed.
