# FR-014: Declared Repo Clone & Sync

**Revision**: 1
**Status**: Approved
**Repos**: specmesh
**Created**: 2026-09-18
**Epic**: [EPIC-003: Multi-Repo Documentation Tracking](../epics/EPIC-003-multi-repo-doc-tracking.md)

## User Story

As a specmesh user, once I've declared a child repo (or the central spec-tracking repo) in `.specmesh.yml`, I
want the extension to clone it for me instead of me running `git clone` by hand — whether that's right after I
add the entry, on demand via a command, or as part of bootstrapping a whole multi-repo workspace from someone
else's `.specmesh.yml` — so "which repos exist" (FR-008) becomes "which repos are actually on my disk" with
minimal manual git work.

## Overview

Adds clone automation on top of FR-008's `repos:` manifest and FR-009..012's central `.specmesh/spec.git`
tracking: a new `specmesh: Sync/Clone Repos` command that clones every missing declared child repo (and the
central spec repo itself, via a new `specRepoRemote` field), a prompt offered when a new `repos:` entry is
detected, and a prompt to optionally delete a repo's local folder when its entry is removed. Cloning is strictly
one-shot/presence-based — no ongoing pull/fetch/branch management of repos that already exist on disk.

## Functional Requirements

- **FR-1**: `.specmesh.yml` supports an optional top-level `specRepoRemote` string field — the git remote URL for
  the local `.specmesh/spec.git` central tracking repo (distinct from any individual `repos[].remote`). Parsed/
  validated in `repoConfig.ts` alongside `track:`/`repos:`; a non-string/empty value is dropped and reported via
  the same `repoErrors`-style diagnostic used for malformed `repos:` entries.
- **FR-2**: Adding, editing, or removing the central repo's remote via the existing "Manage Remotes…" command
  automatically writes the matching value into the root `.specmesh.yml`'s `specRepoRemote` field, so the two
  never drift apart from manual editing.
- **FR-3**: A new `specmesh: Sync/Clone Repos` command, available both from the Command Palette and as an entry
  in the Docs Explorer view's existing "More Actions" (`...`) menu (alongside `Refresh Docs Index`, `Show Missing
  Tracked Files`, etc.), that, per workspace folder with a `.specmesh.yml`:
  1. If `.specmesh/spec.git` isn't present locally but `specRepoRemote` is declared, clones it as a bare repo to
     `.specmesh/spec.git` first.
  2. Clones every declared `repos:` entry whose `path` doesn't yet exist on disk (`git clone <remote> <path>`).
     Entries whose `path` already exists are left untouched.
  3. After each child repo is freshly cloned, if central tracking is present, checks out that child's tracked
     paths from `.specmesh/spec.git`'s history into the new working tree, restoring any docs previously migrated
     to central-only tracking (FR-009's `migrateRepoToCentral`) that wouldn't otherwise exist in a fresh clone.
  4. Logs a per-repo cloned/skipped/failed summary to the output channel. One repo's failure doesn't stop the
     others from being attempted.
- **FR-4**: A failed clone (invalid URL, no access, network error) shows a warning with the underlying git error
  and a "Copy Terminal Command" action (same convention as the existing push/pull/fetch failure UX), so the user
  can fix `.specmesh.yml` or their credentials and re-run `Sync/Clone Repos` to retry. The command is naturally
  idempotent, so re-running it is the entire retry mechanism.
- **FR-5**: When `.specmesh.yml` is saved and one or more `repos:` entries appear that weren't present in the
  previously loaded config, and an entry's `path` doesn't already exist on disk, show a prompt per new entry:
  `New repo "<name>" declared in .specmesh.yml. Clone it now?` with `Clone Now` / `Not Now`. When several entries
  appear in the same save (e.g. a bulk edit), prompt once per entry, in declaration order. `Clone Now` runs the
  same single-repo clone-and-restore logic as FR-3.2/FR-3.3.
- **FR-6**: When `.specmesh.yml` is saved and one or more previously declared `repos:` entries are gone, and an
  entry's `path` still exists on disk, show a modal prompt per removed entry: `Repo "<name>" was removed from
  .specmesh.yml. Delete its local folder at "<path>"? This can't be undone.` with `Delete Folder` / `Keep
  Folder`. Dismissing the modal keeps the folder (safe default). Several entries removed in the same save are
  prompted one at a time, in declaration order.
- **FR-7**: Cloning is strictly one-shot and presence-based: specmesh never re-clones, fetches, pulls, or
  otherwise touches an already-present declared repo's branches/remotes/history. Any drift after the initial
  clone (including a branch later deleted upstream) is left entirely to that repo's own git tooling, consistent
  with the charter's existing "not a replacement for git" non-goal.
- **FR-8**: Editing an already-cloned repo's `remote` value (e.g. to an invalid or nonexistent URL) has no
  immediate effect — per FR-7, an already-present `path` is never re-touched, so the edited `remote` is simply
  inert until that entry is next treated as missing (e.g. its local folder is later deleted and it becomes a
  clone candidate again, at which point FR-4's failure handling applies normally).

## Out of Scope

- Seeding a newly-cloned, previously-empty child repo with scaffolded doc types/templates (roadmap Vector 3's
  "project docs onto newly-cloned repos") — restoring already-migrated central history (FR-3.3) is a distinct,
  narrower mechanism and is the only "projection" this FR does. Scaffolding a brand-new repo is a separate future
  FR.
- Any ongoing sync/pull/fetch/branch management of declared repos once they exist on disk (see FR-7).
- Deleting or tearing down `.specmesh/spec.git` itself — unrelated, already explicitly out of scope per the
  roadmap.
- Cloning the root/coordinator repo that itself contains `.specmesh.yml` — that repo is obtained the same way any
  repo is opened in VS Code (a normal manual `git clone`); only `.specmesh/spec.git` and declared `repos:`
  children are auto-clone candidates.
- URL format validation beyond "non-empty string" for `specRepoRemote` — matches how `repos[].remote` is already
  validated today (FR-008).
- Squiggly-line/diagnostic validation of whether a declared `remote` is actually reachable/authorized (would
  require a network round-trip per repo, e.g. `git ls-remote`), and any notion of a repo being "out of sync"
  with its remote — both explicitly excluded by FR-7's one-shot-only cloning. A future FR could add an on-demand
  "Validate Repo Remotes" check; this FR does not.

## Assumptions

- "Delete Folder" (FR-6) removes the entire local folder recursively. There's no separate "delete docs only" vs.
  "delete source only" choice, since a declared repo's docs and source are the same on-disk checkout — the user's
  own three-way framing (source / docs+source / nothing) collapses to a single folder to delete or keep.
- The "previously loaded config" baseline used to detect new/removed `repos:` entries (FR-5/FR-6) is only this
  session's last successful crawl/config load, not something persisted across VS Code restarts — so no prompt
  fires retroactively for a repo that was already missing or already removed before this session started. The
  always-available `Sync/Clone Repos` command and the existing "Declared Repos" tree category (FR-008) remain
  the way to notice and act on that case.
- `specRepoRemote` lives in the same `.specmesh.yml` that declares `repos:` (conventionally the workspace root's),
  not duplicated per child repo.
- A deleted-upstream-branch scenario for an *already-cloned* repo is explicitly not handled by specmesh at all
  (see FR-7) — not "handled by leaving the user on the branch," but genuinely out of scope, the same as any other
  post-clone git state of a declared repo.

## Testing Expectations

Automated tests must cover, at minimum:

- Adding one new `repos:` entry (missing on disk) → single clone prompt, correct wording, successful clone path.
- Adding one new `repos:` entry whose `path` already exists on disk → no prompt, no clone attempt (FR-5's
  "doesn't already exist on disk" condition).
- Adding multiple new `repos:` entries in one save → one prompt per entry, in declaration order.
- Adding multiple new `repos:` entries in one save where some paths already exist and some don't → prompts fire
  only for the missing ones, in declaration order; the already-present ones are left untouched.
- Removing one previously-declared entry whose folder still exists → single delete prompt, correct wording;
  both `Delete Folder` and `Keep Folder`/dismiss outcomes.
- Removing multiple previously-declared entries in one save → one prompt per removed entry.
- Removing multiple previously-declared entries in one save where some folders exist and some don't → prompts
  fire only for the ones whose folder still exists, in declaration order.
- Changing an existing entry's `remote` to an invalid/nonexistent URL while its `path` is already present on
  disk → no clone attempt, no error (FR-8).
- Changing an existing entry's `remote` to an invalid/nonexistent URL for an entry whose `path` is missing →
  clone attempt fails gracefully with the FR-4 warning + "Copy Terminal Command", and does not block other
  repos' clones in the same `Sync/Clone Repos` run.
- `specRepoRemote` parsing: present/absent/malformed, and that `Sync/Clone Repos` skips the bare central clone
  step when it's absent.

## Open Questions

- None — the scope cuts above (especially FR-7's one-shot-only cloning, and FR-6's single-folder framing) remove
  the ambiguity the original scenarios raised.
