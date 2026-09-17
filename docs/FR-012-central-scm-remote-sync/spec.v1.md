# FR-012: Remote Add/Remove/Edit, Push, Pull & Fetch in the Central SCM View

**Revision**: 1
**Status**: Approved
**Repos**: specmesh
**Created**: 2026-09-17
**Epic**: [EPIC-003: Multi-Repo Documentation Tracking](../epics/EPIC-003-multi-repo-doc-tracking.md)

## User Story

As a specmesh user with the "specmesh (central)" Source Control view (FR-010/FR-011) open, I want to configure a
git remote for `.specmesh/spec.git` and push/pull/fetch against it — e.g. a GitHub repo — so my central doc
history isn't only ever local, and I can back it up or share it like a normal git repo.

## Overview

Adds remote management (add/remove/edit a remote's URL) and push/pull/fetch actions to the central SCM view,
so `.specmesh/spec.git`'s commit history (built up via FR-011's stage/commit/branch UI) can be synced to a
remote such as GitHub, the same way any other local git repo would be.

## Functional Requirements

- **FR-1**: A "Manage Remotes…" action (in the view's "…" submenu) opens a `QuickPick` listing existing remotes
  (name + URL) plus an "$(add) Add remote…" entry.
- **FR-2**: Picking an existing remote from that list opens a second `QuickPick` with "Edit URL…" and "Remove"
  actions for that remote. "Edit URL…" prompts for a new URL and runs the equivalent of `remote set-url`.
  "Remove" runs `remote remove` after a confirmation prompt (destructive — removing a remote also drops its
  remote-tracking refs).
- **FR-3**: Picking "$(add) Add remote…" prompts for a name and a URL and runs the equivalent of `remote add`.
- **FR-4**: A "Push" action pushes the current branch to a remote. If no remote is configured yet, it opens the
  add-remote flow (FR-3) first. If more than one remote exists, it prompts which one via `QuickPick`; with
  exactly one remote it uses that one directly. The branch's first push to a given remote sets upstream
  tracking (equivalent to `push -u`); later pushes reuse the existing tracking relationship.
- **FR-5**: A "Pull" action pulls (fetch + merge) from the current branch's tracking remote/branch. If no
  upstream is configured yet, it prompts for a remote (same selection rules as FR-4) and branch name before
  pulling, then sets that as the upstream going forward.
- **FR-6**: A "Fetch" action fetches from the current branch's tracking remote (or prompts for one, same rules
  as FR-4/FR-5, if none is configured) without merging, then refreshes the view.
- **FR-7**: Any failure from these git operations (auth failure, no network, merge conflicts on pull, rejected
  non-fast-forward push, etc.) is surfaced as a warning notification containing git's own message, instead of
  only being logged to the output channel — consistent with FR-011's checkout-conflict handling.
- **FR-8**: All six new actions ("Manage Remotes…", "Push", "Pull", "Fetch") live in the existing
  `specmesh.centralScmActions` "…" submenu introduced in FR-011, grouped together and separated from the
  existing branch/refresh/history/undo-commit items.

## Out of Scope

- A status-bar "ahead/behind" sync indicator or a combined "Sync Changes" button — this FR only adds explicit
  Push/Pull/Fetch actions, not automatic/periodic syncing.
- Renaming an existing remote (`remote rename`) — "Edit" only changes a remote's URL.
- Force-push, or any other unsafe/destructive push variant.
- Merge-conflict resolution UI for `git pull` — conflicts are surfaced as a warning telling the user to resolve
  them manually (e.g. via a terminal), matching FR-011's existing conflict-resolution non-goal.
- Pushing/pulling/fetching all branches at once, or any branch other than the currently checked-out one.
- Authentication UI (credential prompts, PAT/SSH key setup) — relies entirely on git's own configured
  credential helper/SSH agent, the same as running `git push`/`pull`/`fetch` in a terminal would.

## Assumptions

- Remote state (name, URL, and each branch's upstream tracking ref) is read via `git remote -v` and
  `git for-each-ref --format=%(upstream:short) refs/heads/<branch>` (absence of an upstream ref is treated as
  "not configured yet", not an error) — same `execGit` plumbing style as FR-009/010/011, no new dependency.
- "Add remote" defaults the name to `origin` if the user leaves the name prompt blank and no remote named
  `origin` exists yet; otherwise the name field is required.
- Push/pull/fetch all operate with `--git-dir`/`--work-tree` pointed at `.specmesh/spec.git` and its external
  work-tree, matching every other git call in `centralScm.ts`/`specRepo.ts`.
- Pull uses a plain merge (no `--rebase`), matching git's default `pull.rebase=false` behavior unless the
  user's own global git config overrides it.

## Open Questions

- None — scope is bounded by the choices above.
