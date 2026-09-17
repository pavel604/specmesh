# EPIC-003: Multi-Repo Documentation Tracking

**Status**: Active
**Created**: 2026-09-16

## Outcome

specmesh docs stop being scattered, per-repo artifacts with no shared history of their own. A workspace's child
repos become an explicit, declarative fact (`repos:` in the root `.specmesh.yml`) instead of something inferred
from VS Code's multi-root folders, and every tracked doc — regardless of which child repo it physically lives in
— is additionally committed into one detached, central (spec) git history spanning the whole workspace, without
duplicating the file on disk or disturbing each child repo's own git history for non-doc files.

## Stories

| FR  | Title | Status      |
| --- | ----- | ----------- |
| [FR-008](../FR-008-repo-manifest/spec.v1.md) | Declarative repo manifest (`repos:` in `.specmesh.yml`) | Done |
| [FR-009](../FR-009-cross-repo-doc-tracking/spec.v1.md) | Cross-repo detached doc tracking (central git-plumbing history) | Done |
| [FR-010](../FR-010-central-doc-history-scm-view/spec.v1.md) | Central doc history as a custom Source Control view | Done |
| [FR-011](../FR-011-central-scm-branch-commit/spec.v1.md) | Branch, stage & commit in the central SCM view | Done |
| [FR-012](../FR-012-central-scm-remote-sync/spec.v1.md) | Remote add/remove/edit, push, pull & fetch in the central SCM view | Done |

## Dependencies

- Builds on the existing per-workspace-folder config loading in
  [src/crawler/repoConfig.ts](../../src/crawler/repoConfig.ts).
- See [docs/roadmap.md](../roadmap.md) "Vector 3" for the full mechanism discussion this epic is drawn from.
- Requires the narrowed "not a replacement for git" non-goal in [docs/charter.md](../charter.md), which carves
  out an explicit exception for this detached, cross-repo doc commit history.
- The detached-tracking story is built on the mechanism decided in
  [ADR-002](../adr/ADR-002-cross-repo-doc-tracking-git-plumbing.md) (bare central repo + git plumbing).

## Changelog

- 2026-09-16: Epic created.
- 2026-09-16: Linked ADR-002 (detached-tracking mechanism decision).
- 2026-09-16: FR-009 done. Added FR-010 (custom Source Control view for central history) as a follow-up story —
  the built-in Git view can't render a bare repo with an externally-set `--work-tree`, so today's visibility is
  limited to the `Show Central Doc History` output-channel command.
- 2026-09-16: FR-010 done. Read-only "specmesh (central)" Source Control view listing every tracked doc's sync
  status, with diff-on-click. Kept intentionally read-only (no stage/commit/branch UI) per user confirmation.
- 2026-09-17: Added FR-011 to pick up the read-only view's postponed stage/commit/branch UI, replacing FR-009's
  auto-commit-on-save with fully manual central sync.
- 2026-09-17: FR-011 done. Staged/Changes groups with stage/unstage/commit/branch-switch, replacing FR-009's
  auto-commit-on-save. Fixed two review-round issues before sign-off: batched/parallelized git calls and
  crawl-result caching so stage/unstage/commit stopped re-crawling the whole workspace per action, and
  consolidated the duplicate branch-switch icon into a single "..." submenu (matching the built-in Git view's
  Commit-icon-plus-"..."-menu convention). Also added an "Undo Last Commit" action (soft reset to the parent
  commit) before final sign-off, and fixed a bug found while testing it: staging silently skipped docs inside
  child repos (`git add`'s submodule-boundary check), fixed by staging via low-level `hash-object`/
  `update-index --index-info` plumbing instead.
- 2026-09-17: Added FR-012 for remote add/remove/edit plus push/pull/fetch, so the central repo can sync to a
  remote such as GitHub — explicitly out of scope for FR-011.
- 2026-09-17: FR-012 done. "Manage Remotes…" (add/edit URL/remove) plus Push/Pull/Fetch actions in the "..."
  submenu; upstream is auto-resolved when configured, otherwise the user is prompted for (or can add) a
  remote. Also dropped the redundant `specmesh:` prefix from that submenu's command titles per user request.
  Fixed a bug found during live GitHub testing: a passphrase-protected SSH key (no unlocked agent) fails with
  `Permission denied (publickey)` since these git calls run in a non-interactive child process with no TTY for
  a passphrase prompt — fixed with a "Copy Terminal Command" button on the failure warning so the user can run
  the exact equivalent command interactively instead.
