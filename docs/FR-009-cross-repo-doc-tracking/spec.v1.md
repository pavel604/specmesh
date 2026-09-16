# FR-009: Cross-Repo Detached Doc Tracking

**Revision**: 1
**Status**: Approved
**Repos**: specmesh
**Created**: 2026-09-16
**Epic**: [EPIC-003: Multi-Repo Documentation Tracking](../epics/EPIC-003-multi-repo-doc-tracking.md)

## User Story

As a specmesh user with docs scattered across a root repo and several child repos declared in `repos:`, I want
every tracked doc file committed into one detached, central git history spanning all of them — regardless of
which repo the file physically lives in — so that doc history survives independently of any single repo, without
duplicating file content on disk or disturbing each repo's own history for its non-doc files.

## Overview

Implements the mechanism decided in [ADR-002](../adr/ADR-002-cross-repo-doc-tracking-git-plumbing.md): a bare git
repo at `.specmesh/spec.git` with its work-tree set to the root workspace folder. Tracked doc files across the
root repo and its declared child repos ([FR-008](../FR-008-repo-manifest/spec.v1.md)) are snapshotted into this
central history via git plumbing (`hash-object`/`update-index`) on save, debounced and batch-committed. Central
tracking is enabled either explicitly or automatically as part of scaffolding a brand-new workspace. A pair of
per-repo commands — Migrate and its inverse, Untrack — move a repo's doc paths into (or back out of)
central-only tracking so history isn't duplicated/diverging across two places.

## Functional Requirements

- **FR-1**: A command (`specmesh: Enable Cross-Repo Doc Tracking`) initializes a bare git repo at
  `<root>/.specmesh/spec.git` (creating `.specmesh/` if needed), with the root folder as its work-tree, and adds
  a `.specmesh/` entry to the root repo's own `.gitignore` (creating it if missing) so the root repo's own git
  never treats `.specmesh/spec.git` as an untracked embedded repository. No-ops with an informational message if
  already enabled; if `.specmesh/spec.git` exists but isn't a valid git repo, offers to reinitialize it instead
  of failing silently forever.
- **FR-2**: `specmesh: Scaffold Spec-Driven Development Structure` also runs FR-1 (idempotently) at the end of
  scaffolding the root repo, so a brand-new workspace gets central tracking enabled automatically without a
  separate manual step. The standalone Enable command remains available for workspaces scaffolded before this
  feature existed.
- **FR-3**: `.specmesh/` is automatically excluded from doc-type glob matching, so `.specmesh/spec.git`'s own
  contents are never themselves treated as a tracked doc.
- **FR-4**: Once enabled, saving a tracked doc file (in the root repo or any `repos:`-declared child repo)
  schedules a sync: `git hash-object -w` then `git update-index --add --cacheinfo` against `.specmesh/spec.git`,
  keyed by the file's path relative to the root folder.
- **FR-5**: Deleting a tracked doc file schedules `git update-index --remove` for that path against
  `.specmesh/spec.git`.
- **FR-6**: Sync operations are debounced (same 500ms pattern as the existing crawl-refresh debounce in
  `extension.ts`) and batched into one commit per quiet period, with an auto-generated message listing the
  changed relative paths (or a count when there are many).
- **FR-7**: A command (`specmesh: Migrate Repo Docs to Central Tracking`), run against one repo (root or a
  declared child) at a time: for every currently-tracked doc path under that repo, runs `git rm --cached -f
  <path>` against that repo's own git (keeping the working-tree file untouched regardless of dirty state) and
  appends a `.gitignore` entry for the matched doc glob(s) (creating `.gitignore` if missing). Idempotent — running
  it again on an already-migrated repo is a safe no-op. Requires user confirmation before running.
- **FR-8**: A command (`specmesh: Untrack Repo from Central Tracking`) — the inverse of FR-7, run against one
  repo at a time: removes the `.gitignore` entries FR-7 added, `git add`s the previously-migrated doc paths back
  into that repo's own git (restoring normal per-repo tracking), and stops `.specmesh/spec.git` from continuing
  to update that repo's doc paths going forward. Does not rewrite or delete `.specmesh/spec.git`'s existing
  history for those paths — past central commits are untouched. Idempotent. Requires user confirmation.
- **FR-9**: If enabled but the `git` executable isn't available on PATH, sync operations fail with a single
  warning notification (not a silent no-op, not repeated spam on every subsequent save).
- **FR-10**: A command (`specmesh: Show Central Doc History`) prints `.specmesh/spec.git`'s recent commits to
  specmesh's existing output channel, so the sync isn't an entirely invisible background process.
- **FR-11**: Every git plumbing invocation against `.specmesh/spec.git` passes `--work-tree` explicitly as part
  of that invocation, rather than relying on a persisted `core.worktree` config value — so a relocated or
  renamed workspace root doesn't silently break tracking.

## Out of Scope

- Auto-cloning declared repos (future roadmap item, not this FR).
- Pushing `.specmesh/spec.git` to a remote or configuring one — left to the user's own `git` commands against
  that git-dir.
- Conflict resolution between simultaneous edits to the same doc from two machines/branches.
- A dedicated tree-view UI for central-repo status beyond the output-channel log in FR-10.
- Extending central tracking to arbitrary multi-root VS Code workspace folders that aren't declared via `repos:`
  — see Assumptions.
- Fully tearing down `.specmesh/spec.git` (deleting it outright, discarding all central history) is not a
  dedicated command — a user who wants that can delete `.specmesh/` manually. FR-8 (Untrack) deliberately
  preserves history instead.

## Assumptions

- "Root workspace folder" means the folder holding the `.specmesh.yml` that declares `repos:` (the same folder
  FR-008 treats as holding the charter/epics). Central tracking spans that root plus its declared `repos:`
  children — it does not attempt to span unrelated multi-root VS Code folders outside that manifest.
- Commits to `.specmesh/spec.git` use whatever global `git user.name`/`user.email` is already configured on the
  machine — no separate specmesh commit identity.
- All tracked doc types are synced uniformly; no per-type opt-out from central tracking in this FR.
- A file rename is handled as a delete (old path) + add (new path) — no special git rename-detection is needed
  since `update-index` naturally represents it that way.
- VS Code's file watcher isn't git-aware, so a migrated (gitignored) doc file continues to be watched and synced
  into the central repo exactly as before migration.
- Single-VS-Code-window usage is assumed; concurrent writers to `.specmesh/spec.git` from multiple windows/
  processes aren't addressed in this FR.

## Open Questions

- None — ADR-002 already settled the core mechanism; the remaining decisions above have reasonable defaults.
