# FR-010: Central Doc History as a Source Control View

**Revision**: 1
**Status**: Approved
**Repos**: specmesh
**Created**: 2026-09-16
**Epic**: [EPIC-003: Multi-Repo Documentation Tracking](../epics/EPIC-003-multi-repo-doc-tracking.md)

## User Story

As a specmesh user with cross-repo central doc tracking enabled (FR-009), I want to see the central repo's
tracked docs and their sync status directly in VS Code's Source Control view — not only via a text log in the
output channel — so I can visually confirm which docs are under central tracking and whether a recent edit has
already been synced, the same way I'd check status for an ordinary git repo.

## Overview

Register a custom Source Control provider (`vscode.scm` API) representing `.specmesh/spec.git`. It lists every
doc file currently tracked in the central repo, flags any whose on-disk content hasn't been synced yet, and lets
the user diff a doc against its last-synced central version — all read-only status/browsing, since central sync
itself remains fully automatic (FR-009's debounced auto-commit, no manual staging).

## Functional Requirements

- **FR-1**: When central tracking is enabled (`.specmesh/spec.git` exists) — whether already enabled at
  extension activation or just enabled via `specmesh: Enable Cross-Repo Doc Tracking` — register a Source
  Control instance labeled "specmesh (central)".
- **FR-2**: If central tracking has never been enabled, no such Source Control entry exists at all.
- **FR-3**: The provider shows one resource group listing every doc path that specmesh currently tracks
  workspace-wide (per `crawlWorkspace()`), unioned with any path still recorded in the central repo's `HEAD`
  tree even if no longer matched locally, resolved to absolute paths under the central repo's work-tree root.
- **FR-4**: Each resource is flagged "not yet synced" when it has no committed blob at all yet, "pending sync"
  when its on-disk content's hash doesn't match the blob already committed for that path in `HEAD` (e.g.
  mid-debounce, or a prior sync failure), or shows no flag when it's up to date. A doc under a repo opted out via
  `specmesh: Untrack Repo from Central Tracking` is excluded entirely, not shown as perpetually pending.
- **FR-5**: Clicking a resource opens a diff between its last central-committed content and its current on-disk
  content.
- **FR-6**: The Source Control view shows a count badge equal to the number of centrally tracked docs.
- **FR-7**: The provider refreshes automatically right after each successful central sync commit (FR-009's
  `CentralSyncScheduler`), and via a manual "Refresh" title action.
- **FR-8**: The existing `specmesh: Show Central Doc History` output-channel command is unchanged; the new
  Source Control view adds a title action that invokes it, rather than re-implementing commit-log rendering.

## Out of Scope

- Any staging/unstaging or commit-via-input-box workflow — central sync stays fully automatic (FR-009); the
  input box is not wired to an accept-commit command.
- Branch, merge, push, pull, or any other remote operation on the central repo.
- Per-child-repo Source Control entries — this is one single entry for the whole central repo, matching FR-009's
  cross-repo scope.
- Rendering full commit-log history inside the Source Control view itself — that remains the existing
  output-channel-based command (FR-8 above just links to it).
- A teardown/disable flow for the Source Control entry — matches FR-009's existing lack of a central-tracking
  teardown command.

## Assumptions

- Provider id `"specmeshCentral"`, single resource group (flat list across all repos, not grouped per child
  repo) — central tracking is inherently cross-repo by design, so a flat list matches that intent.
- "Pending sync" is computed via `git hash-object --stdin` on the on-disk content (no working-tree write),
  compared against the SHA `ls-tree` already recorded for that path — avoids reading committed blob content into
  memory just to detect a match.
- Diff content for the "last synced" side is served through a small `TextDocumentContentProvider` registered
  under a dedicated URI scheme, fetching blob content via `git show <sha>`.
- `CentralSyncScheduler` (FR-009) gains a small `onDidSync` event, fired at the end of a successful commit, so
  this provider can refresh without polling.

## Open Questions

- None — scope is bounded by the choices above.
