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
| TBD | Cross-repo detached doc tracking (central git-plumbing history) | Not started |

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
