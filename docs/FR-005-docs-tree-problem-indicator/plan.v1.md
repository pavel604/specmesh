# Implementation Plan: FR-005 Docs Tree Problem Indicator (v1)

**Status**: Approved

## Affected Files/Projects

- [src/views/docsTreeProvider.ts](../../src/views/docsTreeProvider.ts) — the only file that needs to change;
  everything this feature needs (`Problem[]`, per-doc broken-link counts) is already computed in `update()`.

## Approach

### Front-end (Docs Explorer tree view)

- In `update(nodes, problems)`, alongside the existing `brokenLinkCounts` computation, build two new instance
  maps keyed by folder and by `${folderName}::${type}` (category), each holding `{ missing: number; brokenLinks:
  number }`:
  - Walk `this.missing` (already-filtered `kind === "missing"` problems) and increment the `missing` count for
    that problem's `workspaceFolderName` and `${workspaceFolderName}::${docType}`.
  - Walk `nodes` once; for any node whose `absolutePath` has a nonzero `brokenLinkCounts` entry, increment the
    `brokenLinks` count for that node's `workspaceFolderName` and `${workspaceFolderName}::${type}`.
- Add two small private helpers on `DocsTreeProvider`:
  - `problemIcon(counts)` → `vscode.ThemeIcon("error", list.errorForeground)` if `missing > 0`, else
    `vscode.ThemeIcon("warning", list.warningForeground)` if `brokenLinks > 0`, else `undefined` (FR-1/FR-2/FR-4,
    Assumptions' stated precedence).
  - `problemTooltip(counts)` → pluralized summary string, e.g. `"1 missing file"`, `"2 broken links"`, or both
    joined with `", "` (FR-5).
- In `getTreeItem`, for the `"folder"` branch: look up the folder's counts, and if `problemIcon(...)` returns a
  value, overwrite `item.iconPath` and set `item.tooltip` to the summary; otherwise leave the existing `repo`
  icon and no tooltip.
- For the `"category"` branch: same lookup keyed by `` `${element.folderName}::${element.type}` ``, overwriting
  the default `folder` icon/tooltip the same way.
- No changes to `getChildren`, to the `"doc"`/`"missing"` item rendering, or to `label`/`description` anywhere —
  icon + tooltip only, per FR-4's "never changes the label text or its color".

### Back-end

- N/A.

### Data

- No new model types — reuses the existing `Problem[]` and the already-computed `brokenLinkCounts` map; the two
  new aggregation maps are private view-layer state, not part of `model/types.ts`.

## Sequencing

1. Add the two aggregation maps and populate them in `update()`.
2. Add `problemIcon`/`problemTooltip` helpers.
3. Wire them into the `"folder"` branch of `getTreeItem`.
4. Wire them into the `"category"` branch of `getTreeItem`.
5. Manually verify via the watch task / Extension Development Host: introduce a broken link and a missing
   tracked file and confirm the folder/category rows pick up the right icon/tooltip, and clear back to default
   once fixed.

## Risks / Tradeoffs

- None significant — pure rendering-layer aggregation over data the provider already holds; no new async work,
  dependencies, or refresh triggers.
