# FR-011: Branch, Stage & Commit in the Central SCM View

**Revision**: 1
**Status**: Approved
**Repos**: specmesh
**Created**: 2026-09-17
**Epic**: [EPIC-003: Multi-Repo Documentation Tracking](../epics/EPIC-003-multi-repo-doc-tracking.md)

## User Story

As a specmesh user with the "specmesh (central)" Source Control view (FR-010) open, I want to actually stage,
commit, and switch branches in `.specmesh/spec.git` from that view — not just browse read-only sync status — so
the central doc history behaves like a normal git repo I can deliberately curate, instead of only ever
auto-committing every save.

## Overview

Turns the read-only "specmesh (central)" view from FR-010 into a working Source Control provider: a proper
Staged/Changes split computed against the index, per-file stage/unstage actions plus a Commit action wired to
the input box, and a branch switcher (checkout existing or create new). FR-009's debounced auto-commit-on-save
is removed — central sync becomes fully manual from here on.

## Functional Requirements

- **FR-1**: The view shows two resource groups instead of FR-010's single "Tracked docs" list: **Staged
  Changes** (index vs. `HEAD`) and **Changes** (working tree vs. index). A doc identical across all three
  (`HEAD`, index, working tree) appears in neither group.
- **FR-2**: Each entry in **Changes** has an inline "Stage Changes" action; the group also has a "Stage All
  Changes" title action. Each entry in **Staged Changes** has an inline "Unstage Changes" action; the group also
  has an "Unstage All Changes" title action.
- **FR-3**: The SCM input box accepts a commit message. A "Commit" title action (and the input box's own accept
  affordance) commits everything currently in **Staged Changes** to `.specmesh/spec.git` using that message,
  then clears the input box and refreshes both groups. Committing with nothing staged shows a warning instead
  of creating an empty commit.
- **FR-4**: A "Switch Branch" title action opens a `QuickPick` listing the central repo's existing branches
  (current branch marked) plus a "Create new branch…" entry. Picking an existing branch checks it out. Picking
  "Create new branch…" prompts for a name and runs the equivalent of `checkout -b`.
- **FR-5**: If checkout would overwrite on-disk doc files with unstaged local modifications, the checkout is
  rejected (git's own default safety behavior) and the resulting error is surfaced as a warning notification
  naming the affected doc(s) — telling the user to stage/commit or otherwise resolve those changes first,
  instead of only logging it to the output channel.
- **FR-6**: The view's title reflects the currently checked-out branch (e.g. as part of the Source Control
  instance's label), so the active branch is visible without opening the QuickPick.
- **FR-7**: FR-009's `CentralSyncScheduler` debounced auto-commit-on-save is removed. Saving a tracked doc no
  longer stages or commits anything automatically; it only triggers a refresh of the central view's Changes
  group, the same way any other on-disk edit would.
- **FR-8**: FR-010's diff-on-click behavior is preserved for both groups (diffing the on-disk/staged content
  against the relevant committed blob) using the same `specmesh-central:` content provider.
- **FR-9**: FR-010's existing "Refresh" and "Show Central Doc History" title actions continue to work unchanged.
- **FR-10**: An "Undo Last Commit" action (in the view's "..." submenu) reverses the most recent commit via a
  soft reset to its parent — the undone commit's changes land back in **Staged Changes** rather than being
  discarded. If there's no parent commit to reset to (already at the initial commit, or no commits at all),
  it shows a warning instead of erroring.

## Out of Scope

- Push, pull, fetch, merge, rebase, or any other remote/multi-branch-reconciliation operation.
- Deleting or renaming branches.
- Discarding/reverting working-tree changes (no "Discard Changes" action).
- Amending an existing commit.
- Undoing past the initial commit (making an unborn `HEAD` again) — "Undo Last Commit" only goes back to an
  existing parent commit.
- Conflict resolution UI — this repo's checkout/commit flows assume no merge conflicts arise (single bare
  repo, no remote in scope).

## Assumptions

- Staged vs. unstaged status is computed via `git diff-index --cached HEAD` (index vs. `HEAD`) and `git
  diff-files`/on-disk `hash-object` comparison against the index (working tree vs. index) — same `execGit`
  plumbing style as FR-009/FR-010, no new dependency.
- Stage/unstage act on individual paths (`update-index --add` / index reset to the `HEAD` blob, or removal from
  the index if never committed) — no partial/hunk staging.
- "Create new branch…" always branches from the current `HEAD`; there's no ref-picker for branching from an
  arbitrary point.
- An unborn `HEAD` (no commits yet) is treated as "no staged changes possible yet" rather than an error,
  consistent with FR-010's existing unborn-`HEAD` handling for `ls-tree`.

## Open Questions

- None — scope is bounded by the choices above.
