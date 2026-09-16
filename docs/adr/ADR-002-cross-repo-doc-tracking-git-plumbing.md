# ADR-002: Cross-Repo Doc History via a Detached Bare Repo + Git Plumbing

**Status**: Accepted
**Date**: 2026-09-16

## Context

[EPIC-003](../epics/EPIC-003-multi-repo-doc-tracking.md) requires every tracked doc file to be committed into one
central, detached git history spanning all of a workspace's child repos — regardless of which child repo the
file physically lives in — without copying the file's content anywhere else on disk, and without disturbing each
child repo's own history for its non-doc files. [charter.md](../charter.md)'s "not a replacement for git"
non-goal was narrowed specifically to allow this one exception.

Git's own boundary rules get in the way: a directory containing its own `.git` is opaque to any other repo's
`git add`. This was verified empirically before choosing a mechanism — from a separate central repo, running
`git --git-dir=central/.git --work-tree=. add child/docs/ADR-001.md` (where `child/` is an independently
`git init`'d repo) exits `0` but silently stages nothing; `git status` shows `child/` only as an untracked
directory, never descending into it. Naming the exact file path doesn't help — `git add`'s tree-walk treats any
path under a nested `.git` as an embedded repository and skips it, even with explicit `--git-dir`/`--work-tree`.

This is cross-cutting technical plumbing, not a user-facing feature, so it's captured as an ADR rather than an FR.

## Options Considered

1. **Copy/sync**: physically duplicate each doc's content into the central repo's own directory tree, commit
   from there. Rejected — introduces a second on-disk copy that can drift from the original, and duplication was
   explicitly ruled out for this design (docs must be edited in place, in the child repo, with zero copies).

2. **Symlinks**: store the file's only real copy in the central repo's own directory, symlink it into place
   inside each child repo. Rejected — Windows symlinks need dev mode/admin or `core.symlinks` to work reliably,
   adding real setup friction, and it still requires a separate central storage location rather than tracking
   the file where it already lives.

3. **Git submodules**: mount the central repo as a submodule inside each child repo. Rejected — submodule UX
   (explicit init/update, detached HEAD, staleness between the submodule's recorded commit and its actual tip)
   is heavyweight for what should be an invisible mechanism, and it inverts the model (child repos would need to
   embed the central repo, rather than the central repo tracking whatever child repos a `repos:` manifest names).

4. **Git plumbing against a bare central repo with `--work-tree` set to the shared workspace root.** Confirmed
   empirically: `git hash-object -w <path>` computes a blob and writes it into the central repo's object
   database directly from a file physically inside a different, independently-initialized nested repo, with
   zero copying. `git update-index --add --cacheinfo 100644,<sha>,<path>` then registers that blob in the
   central repo's index under the file's normal workspace-relative path (since `--work-tree` is the workspace
   root, no separate path-mapping scheme is needed). A committed snapshot correctly reflects the live file's
   content, and `git status` against that index correctly detects further edits to the file on disk — because
   `hash-object`/`update-index` bypass `git add`'s tree-walking embedded-repo check entirely; that check is a
   property of the `add` porcelain command, not of git's object model.

## Decision

Adopt **Option 4**. specmesh maintains a bare git repo at `.specmesh/spec.git`, with `--work-tree` pointed at
the workspace root (the common ancestor directory of every declared child repo). For each tracked doc file:

- On change, `git hash-object -w` the file into `.specmesh/spec.git`'s object store, then
  `git update-index --add --cacheinfo` (or `--remove` for deletions) to stage it under its workspace-relative
  path.
- Periodically (see the debounce/trigger design in the FR that implements this), commit the staged index to
  `.specmesh/spec.git`.
- `.specmesh/` itself must be excluded from every doc-type `glob` in `.specmesh.yml`, so the central repo's own
  storage directory is never mistaken for a tracked doc.
- Each child repo undergoes a one-time migration — `git rm --cached <doc-path>` (keeping the working-tree file)
  plus a `.gitignore` entry for the matched doc globs — so the child repo's own git stops tracking history for
  paths the central repo now owns exclusively (per EPIC-003's "central-only tracking" decision). Without this,
  the same file would have two independent, diverging histories.

## Consequences

- New runtime dependency: specmesh must shell out to the `git` CLI (or an equivalent plumbing-capable library)
  from the extension process — a new subprocess-execution surface that needs to handle a missing/unavailable
  `git` binary gracefully.
- `.specmesh/spec.git` can be pushed to its own remote and cloned standalone to reconstruct the entire
  multi-repo doc tree, with no child repo present — this is the "detached data layer" the epic requires.
- Each child repo needs its one-time `git rm --cached` + `.gitignore` migration before central tracking begins;
  the FR implementing this must include that migration step, not just the ongoing sync logic.
- The central repo's commit history is only ever a snapshot of doc content at sync time — it does not replace
  or read a child repo's own commit history for that file's pre-migration past.
