# FR-018: `${workspaceFolder}` Markdown Link Resolution

**Revision**: 1
**Status**: Approved
**Repos**: specmesh
**Created**: 2026-09-22
**Epic**: [EPIC-001: Docs Explorer Authoring](../epics/EPIC-001-docs-explorer-authoring.md)

## User Story

As a specmesh user, I want a markdown link written as `${workspaceFolder}/docs/some-file.md` to resolve
against the root of the workspace folder that contains the linking document, so it isn't wrongly flagged as a
broken link (squiggly + Problems panel entry) when the target file actually exists.

## Overview

Fixes link resolution (`resolveLinkTarget` in the crawler) so it recognizes VS Code's own `${workspaceFolder}`
variable syntax at the start of a link target and resolves it against that document's containing workspace
folder root, instead of treating the literal string `${workspaceFolder}` as a relative subfolder name next to
the linking file (today's bug — it never exists on disk, so the link is always flagged broken/missing even
when the real target file is present).

## Functional Requirements

- **FR-1**: Both link forms resolve correctly, side by side: a plain relative target (`../foo.md`, `./bar.md`,
  `foo.md`) keeps resolving relative to the document's own directory exactly as today, and a target starting
  with `${workspaceFolder}/` resolves against the root of the workspace folder containing the linking document
  (the same folder whose crawl produced that doc) instead of relative to the document's own directory.
- **FR-2**: `${workspaceFolder}` resolution works correctly regardless of how deeply nested the linking
  document is within its workspace folder (e.g. a doc at `docs/FR-018/spec.v1.md` linking
  `${workspaceFolder}/docs/charter.md`).
- **FR-3**: A `${workspaceFolder}`-prefixed link whose target file exists is not flagged as a broken link and
  counts as a valid outgoing link for orphan detection, exactly like a resolvable relative link today.
- **FR-4**: A `${workspaceFolder}`-prefixed link whose target file does not exist is still flagged broken —
  this fix must not suppress genuine breakage, only fix false positives caused by the unrecognized syntax.

## Out of Scope

- `${workspaceFolder:<folderName>}` (naming a specific *other* workspace folder, for cross-repo links in a
  multi-root workspace) — not addressed here; existing relative paths (e.g. `../../../other-repo/docs/x.md`)
  remain the only supported way to link across repos.
- Any other VS Code predefined variable (`${file}`, `${fileDirname}`, `${workspaceFolderBasename}`, etc.) —
  only `${workspaceFolder}` is in scope.

## Assumptions

- `${workspaceFolder}` resolves to the workspace folder that contains the *linking* document (matching this
  repo's existing per-workspace-folder crawl model), not necessarily the first/primary folder in a multi-root
  workspace — consistent with VS Code's own per-file variable resolution.
- The substitution only applies when a link target starts with exactly `${workspaceFolder}/` (or is exactly
  `${workspaceFolder}`) — no partial-string replacement elsewhere in a target.

## Open Questions

- None.
